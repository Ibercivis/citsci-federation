/**
 * The Identities this source has never served before: any username under one
 * of the prefixes `mock.json` declares, carrying the claims that prefix
 * declares with `{username}` filled in.
 *
 * A file of its own because the tests need the address the source will mint
 * for a username, and a harness that worked it out a second way would go red
 * for a change in this templating rather than for anything the Broker did.
 * `server.ts` cannot be imported for it: it listens on a port as it loads.
 *
 * Why a case needs an Identity nobody has met: `README.md`.
 */

import { randomUUID } from "node:crypto";
import declaration from "./mock.json" with { type: "json" };

/** What this source says about one Identity, per destination: the ID token
 *  gets one set of claims and the userinfo response another. */
export interface DeclaredIdentity {
  password: string;
  idToken: { email: string; email_verified: boolean };
  userinfo: { email: string; email_verified: boolean };
}

/**
 * The newcomer shapes, by what their claims say about the address: one per
 * thing a source can assert about one, because that is what a case about a
 * **first** arrival is usually about.
 */
export const NEWCOMERS = declaration.newcomers;

export type NewcomerShape = (typeof NEWCOMERS)[keyof typeof NEWCOMERS];

/**
 * A username falls under a shape by its prefix, so a prefix beginning with
 * another would make which shape it is depend on the order they are read in.
 * Checked as this module loads: the source refuses to start and the suite
 * refuses to run, rather than one case deciding another's outcome.
 */
for (const shape of Object.values(NEWCOMERS)) {
  const inside = Object.values(NEWCOMERS).find(
    (other) =>
      other !== shape && shape.usernamePrefix.startsWith(other.usernamePrefix),
  );
  if (inside) {
    throw new Error(
      `The newcomer prefix ${shape.usernamePrefix} begins with ` +
        `${inside.usernamePrefix}, so a username under the first is also ` +
        "under the second.",
    );
  }
}

/**
 * The declared claims with this username written into them, whichever
 * destination they are for.
 *
 * Generic rather than typed as the ID token's claims, which it is also called
 * with userinfo's. The two carry the same claims today and the lie costs
 * nothing; it costs something the moment a source declares a userinfo that
 * says less, because the error lands here rather than where that source is.
 */
const filledIn = <Claims extends { email: string }>(
  claims: Claims,
  username: string,
): Claims => ({
  ...claims,
  email: claims.email.replaceAll("{username}", username),
});

/** The Identity a username stands for, or nothing at all for one under none of
 *  the prefixes. */
export function newcomerNamed(username: string): DeclaredIdentity | undefined {
  const shape = Object.values(NEWCOMERS).find((candidate) =>
    username.startsWith(candidate.usernamePrefix),
  );
  if (!shape) return undefined;
  return {
    password: shape.password,
    idToken: filledIn(shape.idToken, username),
    userinfo: filledIn(shape.userinfo, username),
  };
}

/**
 * One newcomer of that shape: a username no Identity Source has served before,
 * and the address it will arrive with. Fresh per run, because the second run
 * of a case that finished would otherwise sign in as the Person the first one
 * made — `README.md` says what that cannot stage.
 */
export function aNewcomerUnder(shape: NewcomerShape): {
  username: string;
  password: string;
  address: string;
} {
  const username = `${shape.usernamePrefix}${randomUUID()}`;
  return {
    username,
    password: shape.password,
    address: filledIn(shape.idToken, username).email,
  };
}
