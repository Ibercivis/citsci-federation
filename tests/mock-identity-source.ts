/**
 * The Mock Identity Source as the tests know it: where it answers, the
 * Identities it declares, and what the Broker was told about it.
 *
 * Split by who decides what. `mock-identity-source/mock.json` is the file the
 * source itself serves, so it owns the aliases it stands behind and the
 * Identities that exist. What each source is *called* and whether its word on
 * an address is trusted are the Broker's configuration, so those are read from
 * the realm (`./realm.ts`). Neither fact is written twice, so neither can
 * drift.
 *
 * An Identity the source has never served is minted by the source's own
 * module for the same reason: the address such a username will arrive at is
 * that module's to derive (`mock-identity-source/newcomers.ts`), never this
 * one's.
 */

import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  type Discovery,
  ISSUER as BROKER_ISSUER,
  configured,
} from "./broker.ts";
import type { Client } from "./clients.ts";
import { Browser, createPkce, follow, formsOn } from "./brokered-app.ts";
import declaration from "../mock-identity-source/mock.json" with { type: "json" };
import {
  NEWCOMERS,
  aNewcomerUnder,
  aRelocatingNewcomer,
} from "../mock-identity-source/newcomers.ts";
import {
  GITHUB_NEWCOMERS,
  aGitHubNewcomerUnder,
} from "../mock-identity-source/github.ts";
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
export const MOCK_IDENTITY_SOURCES = [
  ...declaration.sources,
  declaration.github.source,
].map((alias) => ({
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
export const AFFIRMING_SOURCE_A = sourceNamed(
  "mock-identity-source-affirming-a",
  true,
);
export const AFFIRMING_SOURCE_B = sourceNamed(
  "mock-identity-source-affirming-b",
  true,
);

/**
 * The one source the Broker also asks for `profile`. `broker/README.md` says
 * why.
 *
 * Guarded, like `sourceNamed`. The guard matters: names in the ID token are
 * the only thing that makes `advisory-split-named` a different case from
 * `advisory-split`, and names arrive only if the realm asks for `profile`.
 * Take the scope out and both cases still pass, asserting the same thing
 * twice. So the realm is held to it here, not in a comment.
 */
function sourceAskingForNames(alias: string): string {
  const name = sourceNamed(alias, true);
  const { asksFor } = declaredSource(alias);
  if (!asksFor.includes("profile")) {
    throw new Error(
      `This case wants the source the Broker asks for names. The realm ` +
        `asks ${alias} for ${asksFor}, which brings no names.`,
    );
  }
  return name;
}

export const AFFIRMING_SOURCE_ASKING_FOR_NAMES = sourceAskingForNames(
  "mock-identity-source-affirming-named",
);

/**
 * The one source the Broker asks for no address at all.
 *
 * Guarded on both facts a case needs of it. It must not be asked for `email`:
 * the scope is what makes the source release neither the address nor a verdict
 * about one, which is how an arrival reaches `idp-review-profile` with nothing
 * to fill the field in from. And it must affirm addresses, so that a case
 * through it cannot be read as passing merely because the Broker distrusts the
 * source — what nobody affirmed is the address typed on the page (issue #182).
 */
function sourceAskedForNoAddress(alias: string): string {
  const name = sourceNamed(alias, true);
  const { asksFor } = declaredSource(alias);
  if (asksFor.includes("email")) {
    throw new Error(
      `This case wants the source the Broker asks for no address. The realm ` +
        `asks ${alias} for ${asksFor}, which brings one.`,
    );
  }
  return name;
}

export const AFFIRMING_SOURCE_SENDING_NO_ADDRESS = sourceAskedForNoAddress(
  "mock-identity-source-sending-no-address",
);

/** What the Broker asks that source for. A case at the source's own seam
 *  sends this instead of spelling a scope, so the two cannot drift apart. */
export const SCOPE_ASKING_FOR_NAMES = declaredSource(
  "mock-identity-source-affirming-named",
).asksFor;

/** The source that affirms nothing: every address arriving through it is
 *  unverified, whatever its claims say. */
export const SOURCE_AFFIRMING_NOTHING = sourceNamed(
  "mock-identity-source",
  false,
);

/** The source imitating GitHub, whose word on an address the Broker trusts as
 *  it trusts GitHub's. What GitHub says about an address is a field of its
 *  email list rather than a claim, so its Identities are declared apart. */
export const GITHUB_SOURCE = sourceNamed(declaration.github.source, true);

export type GitHubIdentity = keyof typeof declaration.github.identities;

/** An arrival through the GitHub imitation, as one of its Identities. */
export const arrivingThroughGitHub = (identity: GitHubIdentity) => ({
  as: {
    through: GITHUB_SOURCE,
    username: identity,
    password: declaration.github.identities[identity].password,
  },
  pkce: createPkce("S256"),
});

/**
 * An arrival through the GitHub imitation from an Identity the Broker has
 * never met, whose primary address GitHub did or did not verify, and that
 * address. `gives` is what it answers if the Broker asks for an address of
 * its own.
 */
export function aGitHubNewcomer(verified: boolean) {
  const { address, ...credentials } = aGitHubNewcomerUnder(
    verified ? GITHUB_NEWCOMERS.verified : GITHUB_NEWCOMERS.unverified,
  );
  return {
    address,
    arriving: (gives?: string) => ({
      as: {
        through: GITHUB_SOURCE,
        ...credentials,
        ...(gives === undefined ? {} : { address: gives }),
      },
      pkce: createPkce("S256"),
    }),
  };
}

/** The primary address GitHub hands over for one of the imitation's
 *  Identities, which is where the Broker's mail goes. */
export const primaryAddressOf = (identity: GitHubIdentity): string => {
  const primary = declaration.github.identities[identity].emails.find(
    (entry) => entry.primary,
  );
  if (!primary) throw new Error(`${identity} declares no primary address.`);
  return primary.email;
};

export const MOCK_IDENTITY_SOURCE = {
  /** The source that affirms nothing, which is what the older cases arrive
   *  through. */
  name: SOURCE_AFFIRMING_NOTHING,
  issuer: configured("MOCK_IDENTITY_SOURCE_ISSUER"),
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
 * The address an Identity arrives with, read from what the declaration puts in
 * its ID token. A case that waits for the Broker's mail has to know where the
 * Broker will send it, and reading it here keeps the address out of the case.
 *
 * `mock-split` is the one Identity whose two destinations disagree on purpose,
 * so a case about that one says which of them it means rather than asking
 * here.
 */
export const addressOf = (identity: MockIdentity): string =>
  MOCK_IDENTITIES[identity].idToken.email;

/**
 * An arrival from an Identity the Broker has never met, at an address of its
 * own that nobody affirmed, giving `address` when the Broker asks for one.
 */
export const aNewcomerArriving = (through: string, address: string) => ({
  as: { through, ...aNewcomerUnder(NEWCOMERS.unverified), address },
  pkce: createPkce("S256"),
});

/**
 * An Identity the Broker has never met whose source says it verified the
 * address it carries, and that address.
 *
 * Which source it arrives through is the caller's, because this is what one
 * address arriving twice needs: affirmed, through a source the Broker takes
 * the word of on addresses, and then unaffirmed through one it does not — the
 * same claim, read through `trustEmail` instead of a second Identity.
 */
export function aNewcomerWhoseAddressIsAffirmed() {
  const { address, ...credentials } = aNewcomerUnder(NEWCOMERS.verified);
  return {
    address,
    through: (source: string) => ({
      as: { through: source, ...credentials },
      pkce: createPkce("S256"),
    }),
  };
}

/**
 * An Identity the Broker has never met whose source affirms an address that is
 * no address at all, returned as a function of how it arrives.
 *
 * One of the two ways to reach `idp-review-profile` from the declaration
 * alone: the page shows when a required field is missing or will not validate,
 * and the realm requires `email` and nothing else. This is the half that will
 * not validate, and the one that matters to the condition — the Identity a
 * case uses to type an address the source never sent, with `email_verified`
 * still saying `true` about the one it did (`issue #182`). The other half is a
 * missing address, which `aNewcomerWhoseSourceSendsNoAddress` stages and which
 * carries no verdict to misread.
 *
 * A function because such a case arrives twice as the same Identity: once
 * typing an address, and once afterwards to see which Person it reaches.
 */
export function aNewcomerWhoseAffirmedAddressIsUnusable() {
  const { username, password } = aNewcomerUnder(NEWCOMERS.affirmedButNoAddress);
  return (arrival: {
    through: string;
    /** What it types over the unusable address, on the review page. */
    typesOnReview?: string;
    /** What it gives the Broker if the Broker asks for an address of its
     *  own, which is a different page and a different question. */
    address?: string;
  }) => ({
    as: { username, password, ...arrival },
    pkce: createPkce("S256"),
  });
}

/**
 * An Identity the Broker has never met arriving through the source the Broker
 * asks for no address, returned as a function of how it arrives.
 *
 * The other way to reach `idp-review-profile`, and the one the body of
 * `issue #182` reports: the page shows because `email` is required and nothing
 * arrived to fill it. The shape is `verified` deliberately — the most its
 * source could affirm — because the scope releases neither `email` nor
 * `email_verified`, so what the declaration says about this Identity's address
 * never leaves the source. A case through here cannot be passing on a claim.
 *
 * A function for the same reason as the unusable-address newcomer above: such
 * a case arrives twice as the same Identity.
 */
export function aNewcomerWhoseSourceSendsNoAddress() {
  const { username, password } = aNewcomerUnder(NEWCOMERS.verified);
  return (arrival: {
    through: string;
    /** What it types into the field nothing arrived to fill, on the review
     *  page. */
    typesOnReview?: string;
    /** What it gives the Broker if the Broker asks for an address of its own,
     *  which is a different page and a different question. */
    address?: string;
  }) => ({
    as: { username, password, ...arrival },
    pkce: createPkce("S256"),
  });
}

/**
 * An Identity the Broker has never met whose source verifies its address, and
 * can be made to give another one: `as` names the address this sign-in
 * arrives with, and it is the same Identity whichever it names.
 *
 * What a case about an address changing upstream needs, after the Identity
 * has already arrived once.
 */
export function aRelocatingIdentity() {
  const { subject, password, username, address } = aRelocatingNewcomer();
  return {
    subject,
    address,
    credentials: (as: string) => ({ username: username(as), password }),
    through: (source: string, as: string) => ({
      as: { through: source, username: username(as), password },
      pkce: createPkce("S256"),
    }),
  };
}

/**
 * The Broker as the source knows it: a client, registered with a callback.
 *
 * The callback is Keycloak's path for an Identity Source with the alias
 * `mock-identity-source`. That is the one place a test here names a Keycloak
 * path, and it asserts nothing about the Broker with it: it is the address this
 * source was told to send the Broker's codes to, so signing in at the source as
 * the Broker would means asking for that address.
 */
const THE_BROKER_AS_CLIENT: Client = {
  id: declaration.client.id,
  name: "the Broker",
  secret: declaration.client.secret,
  redirectUri: `${BROKER_ISSUER}/broker/mock-identity-source/endpoint`,
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
  /** A declared Identity, or the credentials of one the source mints. */
  identity: MockIdentity | { username: string; password: string },
  /** What the Broker asks the source for, read from the realm. Defaults to
   *  what most sources get; pass `SCOPE_ASKING_FOR_NAMES` for the other. */
  scope = declaredSource("mock-identity-source").asksFor,
): Promise<MockAnswer> {
  const discovery = (await (
    await fetch(
      `${MOCK_IDENTITY_SOURCE.issuer}/.well-known/openid-configuration`,
    )
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

  const credentials =
    typeof identity === "string"
      ? { username: identity, password: MOCK_IDENTITIES[identity].password }
      : identity;
  const back = await follow(
    browser,
    await browser.postForm(signIn.action, credentials),
    client,
  );
  const code =
    back.at === "the application"
      ? new URL(back.location).searchParams.get("code")
      : null;
  if (!code)
    throw new Error(`The source issued no code for ${credentials.username}.`);

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
    { issuer: MOCK_IDENTITY_SOURCE.issuer, audience: client.id },
  );
  const userinfo = (await (
    await fetch(discovery.userinfo_endpoint, {
      headers: { authorization: `Bearer ${tokens.access_token ?? ""}` },
    })
  ).json()) as Record<string, unknown>;
  return { idToken: payload, userinfo };
}
