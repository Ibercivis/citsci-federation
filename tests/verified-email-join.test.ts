import { describe, expect, it } from "vitest";
import { CONFIDENTIAL_CLIENT } from "./clients.ts";
import {
  type Attempt,
  attempt,
  authenticate,
  createPkce,
} from "./brokered-app.ts";
import {
  AFFIRMING_SOURCE_A,
  AFFIRMING_SOURCE_B,
  MOCK_IDENTITIES,
  SOURCE_AFFIRMING_NOTHING,
  type MockIdentity,
} from "./mock-source.ts";

/**
 * ADR-0004 in both directions: an Identity arriving with a **Verified Email**
 * that a Person already holds becomes an Identity of that Person, and an
 * Identity arriving with anything else joins nothing, ever.
 *
 * The negative direction is the important one. It is the only thing standing
 * between the automatic merge and a one-minute account takeover — register
 * under somebody else's address at a source that affirms nothing and wait for
 * them to arrive — and it is the class of assertion that goes unwritten
 * because the happy path already worked.
 *
 * Nothing enforces it for free. Keycloak's `idp-auto-link`, which performs the
 * merge, matches on the address alone and never reads `email_verified`
 * (issue #75), and no condition it ships can see the arriving claim
 * (`docs/notes/conditional-subflow-and-brokered-email-verified.md`). What
 * enforces it is this repository's own condition, declared in the realm's
 * `citsci first broker login` flow and compiled from
 * `broker/verified-email/`. Remove either and these cases go red.
 *
 * Every case stages its own Person, at an address of its own, because the
 * suite shares one Broker and a Person outlives the case that made them.
 */

const PERSON_IDENTIFIER =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@ibercivis\.es$/;

/** An arrival: who signs in, and through which Identity Source. */
const arriving = (through: string, identity: MockIdentity) => ({
  as: {
    through,
    username: identity,
    password: MOCK_IDENTITIES[identity].password,
  },
  pkce: createPkce("S256"),
});

/**
 * What the Broker put in front of the Person, for a flow that ended on one of
 * its pages. Any other ending reports itself instead, so a case asserting on
 * the words the Broker used fails by naming what happened rather than by
 * asserting nothing at all.
 */
const whatThePersonWasTold = (result: Attempt): string =>
  result.outcome === "refused-in-the-browser"
    ? result.complaint
    : `no page: the flow ended as ${result.outcome}`;

/** A Person with a Verified Email, made the only way the Broker makes one:
 *  an Identity arriving from a source that affirms the address. */
async function personArrivingWithAVerifiedEmail(
  identity: MockIdentity,
): Promise<string> {
  const { claims } = await authenticate(
    CONFIDENTIAL_CLIENT,
    arriving(AFFIRMING_SOURCE_A, identity),
  );
  expect(claims.sub).toMatch(PERSON_IDENTIFIER);
  return claims.sub as string;
}

describe("an unverified address joins no existing Person", () => {
  it("refuses an Identity whose own source does not affirm its address", async () => {
    const person = await personArrivingWithAVerifiedEmail("takeover-verified");

    // The same address, through another source, which affirms addresses in
    // general and says nothing for this one.
    const takeover = await attempt(
      CONFIDENTIAL_CLIENT,
      arriving(AFFIRMING_SOURCE_B, "takeover-unverified"),
    );

    expect(takeover.outcome).toBe("refused-in-the-browser");
    // It reaches nothing of that Person: no identifier, no token, no data.
    expect(JSON.stringify(takeover)).not.toContain(person);
    // And the Broker says why, in the words the realm declares.
    expect(whatThePersonWasTold(takeover)).toMatch(
      /did not confirm your email address/i,
    );
  });

  it("refuses an affirmed address when the Broker does not trust that source", async () => {
    // `trustEmail` is one trust decision about one operator, taken per source
    // and never on the realm (ADR-0004). A source the Broker has not been
    // told to trust affirms nothing, whatever its claims say.
    const person = await personArrivingWithAVerifiedEmail("untrusted-verified");

    const throughUntrusted = await attempt(
      CONFIDENTIAL_CLIENT,
      arriving(SOURCE_AFFIRMING_NOTHING, "untrusted-verified"),
    );

    expect(throughUntrusted.outcome).toBe("refused-in-the-browser");
    expect(JSON.stringify(throughUntrusted)).not.toContain(person);
    // For the declared reason, and not because some other page stopped the
    // flow: a refusal in the browser is only "the Broker asked something this
    // stand-in app could not answer".
    expect(whatThePersonWasTold(throughUntrusted)).toMatch(
      /did not confirm your email address/i,
    );
  });

  it("leaves the Person it refused to join exactly as they were", async () => {
    // A refusal that damaged the Person would be a denial of service against
    // whoever holds the address: anyone could spend somebody else's account by
    // arriving badly.
    const person = await personArrivingWithAVerifiedEmail("takeover-verified");

    await attempt(
      CONFIDENTIAL_CLIENT,
      arriving(AFFIRMING_SOURCE_B, "takeover-unverified"),
    );
    const afterwards = await authenticate(
      CONFIDENTIAL_CLIENT,
      arriving(AFFIRMING_SOURCE_A, "takeover-verified"),
    );

    expect(afterwards.claims.sub).toBe(person);
  });
});

describe("a Verified Email joins the Person that holds it", () => {
  it("gives one Person Identifier to the same address through two sources", async () => {
    // The pilot's reason to exist, and the direction the refusal above must
    // not have cost us (ADR-0004, #25).
    const person = await personArrivingWithAVerifiedEmail("merge-verified");

    const second = await authenticate(
      CONFIDENTIAL_CLIENT,
      arriving(AFFIRMING_SOURCE_B, "merge-verified"),
    );

    expect(second.claims.sub).toBe(person);
  });

  it("asks the Person nothing in between", async () => {
    // No linking flow, nothing to confirm: ADR-0004 bought the merge by
    // giving that up, so a page appearing here is the decision undone.
    await personArrivingWithAVerifiedEmail("merge-verified");

    const { asked } = await authenticate(
      CONFIDENTIAL_CLIENT,
      arriving(AFFIRMING_SOURCE_B, "merge-verified"),
    );

    expect(asked.map((page) => page.kind)).toEqual([
      "choose-source",
      "sign-in",
    ]);
  });
});
