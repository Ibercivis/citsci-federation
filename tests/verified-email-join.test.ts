import { describe, expect, it } from "vitest";
import { CONFIDENTIAL_CLIENT } from "./clients.ts";
import { type Attempt, attempt, authenticate } from "./brokered-app.ts";
import { PERSON_IDENTIFIER } from "./broker.ts";
import {
  AFFIRMING_SOURCE_A,
  AFFIRMING_SOURCE_B,
  SOURCE_AFFIRMING_NOTHING,
  type MockIdentity,
  arriving,
} from "./mock-source.ts";
import { declaredRefusal } from "./realm.ts";

/**
 * Arrive at an address a Person already holds and you become that Person — but
 * only if the source you came from verified the address (ADR-0004).
 *
 * **The refusals below are the point.** Without them the Broker gives an
 * account away: register with somebody else's address somewhere that checks
 * nothing, wait for its owner to arrive. Nothing refuses it for free — the
 * authenticator that performs the join never reads `email_verified` — so what
 * these cases are really holding up is `broker/verified-email/` and the realm's
 * `citsci first broker login` flow. Take away either and they go red.
 *
 * Each case makes its own Person at an address of its own: the suite shares one
 * Broker, and a Person outlives the case that created them.
 */

/** The refusal as the realm words it. */
const REFUSAL = declaredRefusal("citsci-refuse-an-unverified-join");

/** What the Broker showed the Person. A flow that ended anywhere else says so,
 *  so a case asserting on the wording fails by naming what happened instead. */
const whatThePersonWasTold = (result: Attempt): string =>
  result.outcome === "refused-in-the-browser"
    ? result.complaint
    : `no page: the flow ended as ${result.outcome}`;

/** A Person whose address was verified — the only kind the Broker will join an
 *  Identity to. */
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

    // The same address, from a source that verifies addresses in general and
    // did not verify this one.
    const takeover = await attempt(
      CONFIDENTIAL_CLIENT,
      arriving(AFFIRMING_SOURCE_B, "takeover-unverified"),
    );

    expect(takeover.outcome).toBe("refused-in-the-browser");
    // Nothing of that Person came back: no identifier, no token, no data.
    expect(JSON.stringify(takeover)).not.toContain(person);
    // Refused for the declared reason. Without this, any page the stand-in app
    // could not answer would pass the case — a missing `nonce`, for instance.
    expect(whatThePersonWasTold(takeover)).toContain(REFUSAL);
  });

  it("refuses an affirmed address when the Broker does not trust that source", async () => {
    // Trusting a source's word on addresses is one decision about one operator,
    // so it is set per source and never on the realm. A source nobody decided
    // to trust verifies nothing, whatever its claims say.
    const person = await personArrivingWithAVerifiedEmail("untrusted-verified");

    const throughUntrusted = await attempt(
      CONFIDENTIAL_CLIENT,
      arriving(SOURCE_AFFIRMING_NOTHING, "untrusted-verified"),
    );

    expect(throughUntrusted.outcome).toBe("refused-in-the-browser");
    expect(JSON.stringify(throughUntrusted)).not.toContain(person);
    expect(whatThePersonWasTold(throughUntrusted)).toContain(REFUSAL);
  });

  it("leaves the Person it refused to join exactly as they were", async () => {
    // Otherwise the refusal is a way to break somebody else's account: arrive
    // badly at their address often enough and they can no longer get in.
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
    // What the pilot exists to demonstrate, and what the refusals above must
    // not have cost. An enforcement that turned everyone away would pass them
    // all (#25).
    const person = await personArrivingWithAVerifiedEmail("merge-verified");

    const second = await authenticate(
      CONFIDENTIAL_CLIENT,
      arriving(AFFIRMING_SOURCE_B, "merge-verified"),
    );

    expect(second.claims.sub).toBe(person);
  });

  it("asks the Person nothing in between", async () => {
    // Two pages: choosing the source, and signing in at it. A third one here
    // means the Broker started asking them to confirm the link, which is the
    // thing this design gave up in order to ship.
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
