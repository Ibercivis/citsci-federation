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

/**
 * What this source says about one Identity, per destination: the ID token gets
 * one set of claims and the userinfo response another.
 *
 * `email_verified` is optional on userinfo because a source may hand over an
 * address with no verdict attached, which is the shape `advisory-silent`
 * stages. The ID token always carries one: that is what the Broker reads to
 * create a Person.
 */
export interface DeclaredIdentity {
  /** The `sub` it is known by, where that is not the username it signs in
   *  with. Only a relocating newcomer has one: see `aRelocatingNewcomer`. */
  subject?: string;
  password: string;
  idToken: { email: string; email_verified: boolean };
  userinfo: { email: string; email_verified?: boolean };
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
 *
 * Exported for `github.ts`, whose newcomers are another set under the same
 * rule.
 */
export function refuseOverlappingPrefixes(
  shapes: ReadonlyArray<{ usernamePrefix: string }>,
): void {
  for (const shape of shapes) {
    const inside = shapes.find(
      (other) =>
        other !== shape &&
        shape.usernamePrefix.startsWith(other.usernamePrefix),
    );
    if (inside) {
      throw new Error(
        `The newcomer prefix ${shape.usernamePrefix} begins with ` +
          `${inside.usernamePrefix}, so a username under the first is also ` +
          "under the second.",
      );
    }
  }
}

refuseOverlappingPrefixes(Object.values(NEWCOMERS));

/**
 * The declared claims with this username written into them, whichever
 * destination they are for.
 *
 * Generic rather than typed as the ID token's claims, which it is also called
 * with userinfo's. The two no longer carry the same claims — `advisory-silent`
 * hands over an address with no verdict — so typing one as the other would put
 * the error here rather than on the source that declared it.
 */
const filledIn = <Claims extends { email: string }>(
  claims: Claims,
  username: string,
): Claims => ({
  ...claims,
  email: claims.email.replaceAll("{username}", username),
});

/**
 * The `sub` a username signs in as, where its shape declares that the two
 * differ, and nothing where it does not.
 *
 * A shape carrying `subjectEndsAt` is one whose every username carries it: the
 * part before it is the `sub`, the part after picks the address. A username
 * under such a shape that is missing it names no `sub`, and signing in under
 * the whole username would arrive as a `sub` of its own, at a third address
 * neither label asked for. So it stops here, the way the prefix check above
 * does, rather than let a case assert the opposite of what it meant.
 */
function subjectOf(
  shape: NewcomerShape,
  username: string,
): { subject?: string } {
  if (!("subjectEndsAt" in shape)) return {};
  const ending = username.indexOf(shape.subjectEndsAt);
  if (ending === -1) {
    throw new Error(
      `The username ${username} falls under the newcomer prefix ` +
        `${shape.usernamePrefix}, whose subject ends at ` +
        `${shape.subjectEndsAt}, but the username does not carry it, so it ` +
        "names no subject.",
    );
  }
  return { subject: username.slice(0, ending) };
}

/** The Identity a username stands for, or nothing at all for one under none of
 *  the prefixes. */
export function newcomerNamed(username: string): DeclaredIdentity | undefined {
  const shape = Object.values(NEWCOMERS).find((candidate) =>
    username.startsWith(candidate.usernamePrefix),
  );
  if (!shape) return undefined;
  return {
    ...subjectOf(shape, username),
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

/**
 * One Identity whose source changes the address it gives between two sign-ins,
 * the way a Person changes the address on their account upstream.
 *
 * Signed in as `username(label)`, it is the same `sub` whatever the label, and
 * the label is in the address. So a case changes the address by signing in
 * under another label, and asks the source to remember nothing but which one
 * it used last (`server.ts`).
 */
export function aRelocatingNewcomer(): {
  subject: string;
  password: string;
  username: (label: string) => string;
  address: (label: string) => string;
} {
  const shape = NEWCOMERS.relocating;
  const subject = `${shape.usernamePrefix}${randomUUID()}`;
  const username = (label: string) =>
    `${subject}${shape.subjectEndsAt}${label}`;
  return {
    subject,
    password: shape.password,
    username,
    address: (label) => filledIn(shape.idToken, username(label)).email,
  };
}
