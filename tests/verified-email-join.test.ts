import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CONFIDENTIAL_CLIENT } from "./clients.ts";
import {
  type Attempt,
  Browser,
  attempt,
  authenticate,
  follow,
} from "./brokered-app.ts";
import { PERSON_IDENTIFIER } from "./broker.ts";
import { linkMailedTo, mailCountTo } from "./mailbox.ts";
import {
  AFFIRMING_SOURCE_A,
  AFFIRMING_SOURCE_B,
  AFFIRMING_SOURCE_ASKING_FOR_NAMES,
  SOURCE_AFFIRMING_NOTHING,
  type MockIdentity,
  aNewcomerArriving,
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

/** Somebody taking an address at a source whose word on one the Broker does not
 *  take. Whatever the Broker gives them, it must not be the address. */
const takeTheAddressFirst = (identity: MockIdentity) =>
  attempt(CONFIDENTIAL_CLIENT, arriving(SOURCE_AFFIRMING_NOTHING, identity));

/** Somebody taking an address through a source the Broker trusts, whose
 *  userinfo says nothing about verifying it. */
const arriveSilentlyFirst = () =>
  attempt(CONFIDENTIAL_CLIENT, arriving(AFFIRMING_SOURCE_B, "silent-squat"));

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

  /**
   * The reported advisory: with `trustEmail` on, the address is read from
   * userinfo while `email_verified` is read from the ID token. Real up to
   * Keycloak 26.7.1: a source could verify one address in its ID token and hand
   * over another in userinfo, and the Broker would join the Person holding the
   * second. Each
   * arrival below goes to the Person at `advisory@mock.test` if it is.
   * `docs/notes/2026-11-23-trust-email-and-userinfo.md` has what 26.8.1 does.
   */
  it.each([
    {
      what: "an address from userinfo, verified only in the ID token for another",
      through: AFFIRMING_SOURCE_B,
      identity: "advisory-split",
    },
    {
      what: "the same, with names in the ID token",
      through: AFFIRMING_SOURCE_ASKING_FOR_NAMES,
      identity: "advisory-split-named",
    },
    {
      what: "an address from userinfo that says nothing about verifying it",
      through: AFFIRMING_SOURCE_B,
      identity: "advisory-silent",
    },
  ] as const)("refuses $what", async ({ through, identity }) => {
    const person = await personArrivingWithAVerifiedEmail("advisory-verified");

    const split = await attempt(
      CONFIDENTIAL_CLIENT,
      arriving(through, identity),
    );

    expect(split.outcome).toBe("refused-in-the-browser");
    expect(JSON.stringify(split)).not.toContain(person);
    expect(whatThePersonWasTold(split)).toContain(REFUSAL);
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

/**
 * The mirror of the rule above, and why the rule is applied before the Broker
 * decides whether to create a Person or join one.
 *
 * Guarding the join alone leaves the same takeover working by arriving
 * *first*: take an address at a source that affirms nothing, and the genuine
 * holder's verified arrival lands on the Person you made (issue #88). Nothing in
 * Keycloak asks whether the Person being joined holds that address affirmed —
 * `idp-create-user-if-unique` matches on the address alone, exactly as
 * `idp-auto-link` does.
 */
describe("a Person is never created at an address nobody affirmed", () => {
  it("lets the holder of an address in, whoever arrived at it first", async () => {
    // Refusing the verified arrival instead would trade a takeover for a
    // lockout of the same victim: seed the Person, and the real holder of the
    // address can never sign in. That is not a fix, so this case is what any
    // enforcement has to survive.
    await takeTheAddressFirst("lockout-untrusted");

    const genuine = await personArrivingWithAVerifiedEmail("lockout-verified");

    expect(genuine).toMatch(PERSON_IDENTIFIER);
  });

  it("does not hand the holder of an address to whoever arrived at it first", async () => {
    await takeTheAddressFirst("squat-untrusted");

    const genuine = await personArrivingWithAVerifiedEmail("squat-verified");

    // Back through the source that affirmed nothing. Whatever the Broker gave
    // that arrival, it is not the Person who holds the address.
    const squatter = await takeTheAddressFirst("squat-untrusted");

    expect(JSON.stringify(squatter)).not.toContain(genuine);
    // And left where the rule leaves them: on a Person of their own, with the
    // Broker asking for an address it will confirm itself. Without this, a
    // retry that broke for any other reason would satisfy the line above.
    expect(whatThePersonWasTold(squatter)).toContain("Asks for field: email");
  });

  it("does not hand the holder of an address to whoever arrived first with a silent userinfo", async () => {
    // A source the Broker trusts, whose ID token says unverified and whose
    // userinfo gives the address without a verdict. Keycloak 26.8 loses the
    // verdict and would store the Person verified; only our condition, reading
    // the lost verdict as unaffirmed, keeps the address off them.
    // `docs/notes/2026-11-23-trust-email-and-userinfo.md` has the measurement.
    await arriveSilentlyFirst();

    const genuine = await personArrivingWithAVerifiedEmail(
      "silent-squat-verified",
    );

    const squatter = await arriveSilentlyFirst();

    expect(JSON.stringify(squatter)).not.toContain(genuine);
    expect(whatThePersonWasTold(squatter)).toContain("Asks for field: email");
  });

  it("gives a Person of their own to an arrival its source affirmed nothing about, once the Broker's mail is answered", async () => {
    // The other half of the rule, and what makes it something other than a
    // closed door: the Broker asks for an address and confirms it itself
    // (ADR-0004). Without this case the rule above would be satisfied by
    // turning every such Person away, which is what it used to do.
    const address = `${randomUUID()}@newcomer.test`;
    const browser = new Browser();
    const newcomer = aNewcomerArriving(SOURCE_AFFIRMING_NOTHING, address);

    const waiting = await attempt(CONFIDENTIAL_CLIENT, {
      browser,
      ...newcomer,
    });

    // Asked, not taken. The dialogue stops on a page of the Broker's, so no
    // Brokered App has heard of this Person, and the address is nobody's
    // until the mailbox answers.
    expect(waiting.outcome).toBe("refused-in-the-browser");
    expect(await mailCountTo(address)).toBe(1);

    // Answered, in the browser the Broker asked from.
    await follow(
      browser,
      await browser.get(await linkMailedTo(address)),
      CONFIDENTIAL_CLIENT,
    );

    // And now they are a Person like any other: the sign-in that could not
    // finish a moment ago reaches a Brokered App.
    const { claims } = await authenticate(CONFIDENTIAL_CLIENT, {
      as: newcomer.as,
    });

    expect(claims.sub).toMatch(PERSON_IDENTIFIER);
  });
});
