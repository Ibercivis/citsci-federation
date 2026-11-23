/**
 * The Mock Identity Source: an OpenID provider that says exactly what
 * `mock.json` tells it to, and nothing it was not told.
 *
 * It exists for the tests, and only for them. What it asserts about an
 * Identity's address is declared per Identity and **per destination**: the ID
 * token gets one set of claims and the userinfo response another, so a case
 * can make the two disagree on purpose. That is the condition the reported
 * `trustEmail` advisory needs (ADR-0004), and no real source can be told to
 * produce it.
 *
 * Everything here is a development constant, because nothing here vouches for
 * anybody.
 */

import { type webcrypto, createECDH, createHash } from "node:crypto";
import { type IncomingMessage, createServer } from "node:http";
import { type KoaContextWithOIDC, Provider } from "oidc-provider";
import declaration from "./mock.json" with { type: "json" };
import { type DeclaredIdentity, newcomerNamed } from "./newcomers.ts";

const IDENTITIES: Record<string, DeclaredIdentity> = declaration.identities;

/** The Identity behind a username: one the declaration names, or one this
 *  source has never served before (`newcomers.ts`). */
const identityNamed = (username: string): DeclaredIdentity | undefined =>
  IDENTITIES[username] ?? newcomerNamed(username);

/** What each scope releases. The grant below gives every one of them, so the
 *  scopes are spelled here once. `profile` is what `mock-affirming-named`
 *  asks for, the way a launch source would the day the Broker wants names;
 *  it releases only what an Identity declares. */
const CLAIMS = {
  openid: ["sub"],
  email: ["email", "email_verified"],
  profile: ["name", "preferred_username"],
};

function required(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`${name} is not set; compose.yaml passes it from .env.`);
  return value;
}

const ISSUER = required("MOCK_ISSUER");
/**
 * The one client it serves is the Broker, which calls back at a path per
 * Identity Source alias. This server stands behind every alias `mock.json`
 * declares, because a callback it does not serve is a source no sign-in can
 * finish through.
 *
 * Several, because a Person cannot hold two Identities from the same source:
 * `federated_identity` refuses the second by primary key, before any rule of
 * ours is reached.
 */
const BROKER_CALLBACKS = declaration.sources.map(
  (alias) => `${required("BROKER_ISSUER")}/broker/${alias}/endpoint`,
);

/**
 * The signing key, the same on every start: derived from a declared seed, so
 * that nothing resembling a private key is committed and nothing is stored.
 *
 * A key generated at start-up was tried first and is a trap. The Broker caches
 * a source's keys and will not fetch them again for a while after it last did,
 * so a source that restarted with a new key fails every sign-in through it
 * until that window passes, with an error that names no key.
 */
function derivedSigningKey(seed: string): webcrypto.JsonWebKey {
  const d = createHash("sha256").update(seed).digest();
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(d);
  // An uncompressed point: one marker byte, then x, then y.
  const point = ecdh.getPublicKey();
  return {
    kty: "EC",
    crv: "P-256",
    d: d.toString("base64url"),
    x: point.subarray(1, 33).toString("base64url"),
    y: point.subarray(33).toString("base64url"),
  };
}

const signingKey = derivedSigningKey("mock-source-development-signing-key");

const provider = new Provider(ISSUER, {
  clients: [
    {
      client_id: declaration.client.id,
      client_secret: declaration.client.secret,
      redirect_uris: BROKER_CALLBACKS,
      token_endpoint_auth_method: "client_secret_post",
      id_token_signed_response_alg: "ES256",
    },
  ],
  jwks: { keys: [{ ...signingKey, alg: "ES256", use: "sig" }] },
  cookies: { keys: ["mock-source-development-cookie-key"] },
  claims: CLAIMS,
  // By default the ID token carries only `sub` when an access token is issued
  // alongside it, and the scope's claims are left to userinfo. Off, so the ID
  // token carries what is declared for it and the two can be compared.
  conformIdTokenClaims: false,
  findAccount: (_ctx, sub) => {
    const identity = identityNamed(sub);
    if (!identity) return undefined;
    return {
      accountId: sub,
      claims: (use) => ({
        sub,
        ...(use === "id_token" ? identity.idToken : identity.userinfo),
      }),
    };
  },
  // No consent page: the only client is the Broker, and a page nobody needs to
  // read is a page every test would have to click through.
  loadExistingGrant: async (ctx: KoaContextWithOIDC) => {
    const accountId = ctx.oidc.session?.accountId;
    const clientId = ctx.oidc.client?.clientId;
    if (!accountId || !clientId) return undefined;
    const grant = new ctx.oidc.provider.Grant({ accountId, clientId });
    grant.addOIDCScope(Object.keys(CLAIMS).join(" "));
    await grant.save();
    return grant;
  },
  interactions: {
    url: (_ctx, interaction) => `/interaction/${interaction.uid}`,
  },
  features: { devInteractions: { enabled: false } },
});

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** What this server calls itself, rather than any one source's name: it
 *  answers for all of them, and the Person has already chosen. */
const OWN_NAME = "Mock Identity Source (not for launch)";

/** The sign-in page. It says what it is, so nobody mistakes it for a real one. */
const signInPage = (uid: string, complaint = ""): string => `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(OWN_NAME)}</title></head>
<body>
<h1>${escapeHtml(OWN_NAME)}</h1>
<p>A test Identity Source. It vouches for nobody.</p>
${complaint ? `<p role="alert">${escapeHtml(complaint)}</p>` : ""}
<form method="post" action="/interaction/${escapeHtml(uid)}">
<label>Username <input type="text" name="username"></label>
<label>Password <input type="password" name="password"></label>
<button type="submit" name="login">Sign in</button>
</form>
</body>
</html>`;

async function formBody(req: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return new URLSearchParams(Buffer.concat(chunks).toString());
}

const handleProtocol = provider.callback();

const server = createServer((req, res) => {
  const { pathname } = new URL(req.url ?? "/", ISSUER);
  const interaction = /^\/interaction\/([^/]+)$/.exec(pathname);
  if (!interaction) {
    void handleProtocol(req, res);
    return;
  }

  const answer = async (): Promise<void> => {
    const { uid } = await provider.interactionDetails(req, res);
    if (req.method !== "POST") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(signInPage(uid));
      return;
    }
    const form = await formBody(req);
    const username = form.get("username") ?? "";
    if (identityNamed(username)?.password !== form.get("password")) {
      res.writeHead(401, { "content-type": "text/html; charset=utf-8" });
      res.end(
        signInPage(uid, "No mock Identity with that username and password."),
      );
      return;
    }
    await provider.interactionFinished(req, res, {
      login: { accountId: username },
    });
  };

  answer().catch((error: unknown) => {
    console.error(error);
    if (!res.headersSent) res.writeHead(400, { "content-type": "text/plain" });
    res.end(error instanceof Error ? error.message : "interaction failed");
  });
});

server.listen(Number(new URL(ISSUER).port || 80), () => {
  console.log(`Mock Identity Source answering as ${ISSUER}`);
});
