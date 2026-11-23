/**
 * The Mock Identity Source as the tests know it: where it answers, the
 * Identities it declares, and what the Broker was told about it.
 *
 * Split by who decides what. `mock-source/mock.json` is the file the source
 * itself serves, so it owns the aliases it stands behind and the Identities
 * that exist. What each source is *called* and whether its word on an address
 * is trusted are the Broker's configuration, so those are read from the realm
 * (`./realm.ts`). Neither fact is written twice, so neither can drift.
 */

import { randomUUID } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  type Discovery,
  ISSUER as BROKER_ISSUER,
  configured,
} from "./broker.ts";
import type { Client } from "./clients.ts";
import { Browser, createPkce, follow, formsOn } from "./brokered-app.ts";
import declaration from "../mock-source/mock.json" with { type: "json" };
import { declaredSource } from "./realm.ts";

/**
 * Every Identity Source this one server stands behind: the alias it answers
 * for, joined to what the realm says that alias is called and whether its word
 * on an address is trusted.
 *
 * Several, because a Person cannot hold two Identities from the same source —
 * `federated_identity` keeps one link per source per Person — and the join is
 * about their second one.
 */
export const MOCK_SOURCES = declaration.sources.map((alias) => ({
  alias,
  ...declaredSource(alias),
}));

/**
 * A source by the name a Person reads, asked for by what it does with
 * addresses rather than by its alias.
 *
 * The guard is what a case gets instead of a silent swap. Ask for a source that
 * affirms addresses and the realm says that one does not, and this says so —
 * at import, naming the alias — rather than letting the case go on to assert
 * the opposite of what it meant. Flipping a `trustEmail` in the realm is caught
 * here, by the thing that claims to catch it.
 */
function sourceNamed(alias: string, affirming: boolean): string {
  const source = declaredSource(alias);
  if (source.affirmsAddresses !== affirming) {
    throw new Error(
      `The realm says ${alias} ` +
        `${source.affirmsAddresses ? "affirms" : "does not affirm"} addresses, ` +
        `and this case asked for one that ${affirming ? "does" : "does not"}.`,
    );
  }
  return source.name;
}

/** The two sources that affirm addresses, named A and B because what the
 *  cases need of them is only that they are two. */
export const AFFIRMING_SOURCE_A = sourceNamed("mock-affirming-a", true);
export const AFFIRMING_SOURCE_B = sourceNamed("mock-affirming-b", true);

/**
 * The one source the Broker asks for `profile` as well: `broker/README.md`
 * says why.
 *
 * Guarded like `sourceNamed`, and for the same reason. An arrival with names
 * in its ID token is only a different case from one without while the realm
 * asks this source for `profile`. Take that scope out and the pair would both
 * still pass, asserting the same thing twice, so the realm is held to it here
 * rather than in a comment.
 */
function sourceAskingForNames(alias: string): string {
  const name = sourceNamed(alias, true);
  const { asksFor } = declaredSource(alias);
  if (!asksFor.includes("profile")) {
    throw new Error(
      `The realm has the Broker ask ${alias} for ${asksFor}, and this case ` +
        "asked for the source that is also asked for names.",
    );
  }
  return name;
}

export const AFFIRMING_SOURCE_ASKING_FOR_NAMES = sourceAskingForNames(
  "mock-affirming-named",
);

/** What the Broker asks that source for. A case at the source's own seam
 *  sends this rather than spelling a scope, so what it asks for cannot drift
 *  from what the Broker asks for. */
export const SCOPE_ASKING_FOR_NAMES = declaredSource(
  "mock-affirming-named",
).asksFor;

/** The source that affirms nothing: every address arriving through it is
 *  unverified, whatever its claims say. */
export const SOURCE_AFFIRMING_NOTHING = sourceNamed("mock", false);

export const MOCK_SOURCE = {
  /** The source that affirms nothing, which is what the older cases arrive
   *  through. */
  name: SOURCE_AFFIRMING_NOTHING,
  issuer: configured("MOCK_ISSUER"),
} as const;

/** The mock Identities, each with what the source says about its address
 *  in the ID token and, separately, in userinfo. */
export const MOCK_IDENTITIES = declaration.identities;

export type MockIdentity = keyof typeof MOCK_IDENTITIES;

/** An arrival: who signs in, and through which Identity Source. */
export const arriving = (through: string, identity: MockIdentity) => ({
  as: {
    through,
    username: identity,
    password: MOCK_IDENTITIES[identity].password,
  },
  pkce: createPkce("S256"),
});

/**
 * An arrival from an Identity the Broker has never met, at an address of its
 * own that nobody affirmed, giving `address` when the Broker asks for one. A
 * fresh one per run, which is what a case about a **first** arrival needs:
 * `mock-source/README.md` says why.
 */
export const aNewcomerArriving = (through: string, address: string) => ({
  as: {
    through,
    username: `${declaration.newcomer.usernamePrefix}${randomUUID()}`,
    password: declaration.newcomer.password,
    address,
  },
  pkce: createPkce("S256"),
});

/**
 * The Broker as the source knows it: a client, registered with a callback.
 *
 * The callback is Keycloak's path for an Identity Source with the alias
 * `mock`. That is the one place a test here names a Keycloak path, and
 * it asserts nothing about the Broker with it: it is the address this source
 * was told to send the Broker's codes to, so signing in at the source as the
 * Broker would means asking for that address.
 */
const THE_BROKER_AS_CLIENT: Client = {
  id: declaration.client.id,
  name: "the Broker",
  secret: declaration.client.secret,
  redirectUri: `${BROKER_ISSUER}/broker/mock/endpoint`,
};

/** What the source handed over for one sign-in, in the two places it can say
 *  something about an address. */
export interface MockAnswer {
  idToken: Record<string, unknown>;
  userinfo: Record<string, unknown>;
}

type SourceDiscovery = Pick<
  Discovery,
  "authorization_endpoint" | "token_endpoint" | "jwks_uri" | "userinfo_endpoint"
>;

/**
 * Signs in at the Mock Identity Source directly, as the Broker would:
 * its client registration, its callback, PKCE. The callback is never visited —
 * the code is read off the redirect to it and redeemed here, so the Broker
 * never learns this sign-in happened.
 *
 * This is the seam where the source itself is held to its declaration. Every
 * other case sees it only through the Broker, which passes on its own claims
 * and not the source's.
 */
export async function signInAtMock(
  identity: MockIdentity,
  /** What the Broker asks the source for, read from the realm: what most
   *  sources are asked for, unless the case is about the one asked for
   *  more. */
  scope = declaredSource("mock").asksFor,
): Promise<MockAnswer> {
  const discovery = (await (
    await fetch(`${MOCK_SOURCE.issuer}/.well-known/openid-configuration`)
  ).json()) as SourceDiscovery;
  const client = THE_BROKER_AS_CLIENT;
  const browser = new Browser();
  const pkce = createPkce();

  const query = new URLSearchParams({
    client_id: client.id,
    redirect_uri: client.redirectUri,
    response_type: "code",
    scope,
    state: "mock",
    nonce: "mock",
    code_challenge: pkce.challenge,
    code_challenge_method: pkce.method,
  });
  const shown = await follow(
    browser,
    await browser.get(
      `${discovery.authorization_endpoint}?${query.toString()}`,
    ),
    client,
  );
  if (shown.at !== "a page")
    throw new Error("The source showed no sign-in page.");
  const [signIn] = formsOn(shown.page);
  if (!signIn) throw new Error("The source's sign-in page carries no form.");

  const back = await follow(
    browser,
    await browser.postForm(signIn.action, {
      username: identity,
      password: MOCK_IDENTITIES[identity].password,
    }),
    client,
  );
  const code =
    back.at === "the application"
      ? new URL(back.location).searchParams.get("code")
      : null;
  if (!code) throw new Error(`The source issued no code for ${identity}.`);

  const tokens = (await (
    await fetch(discovery.token_endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: client.redirectUri,
        client_id: client.id,
        client_secret: client.secret ?? "",
        code_verifier: pkce.verifier,
      }).toString(),
    })
  ).json()) as Record<string, string>;
  const { payload } = await jwtVerify(
    tokens.id_token ?? "",
    createRemoteJWKSet(new URL(discovery.jwks_uri)),
    { issuer: MOCK_SOURCE.issuer, audience: client.id },
  );
  const userinfo = (await (
    await fetch(discovery.userinfo_endpoint, {
      headers: { authorization: `Bearer ${tokens.access_token ?? ""}` },
    })
  ).json()) as Record<string, unknown>;
  return { idToken: payload, userinfo };
}
