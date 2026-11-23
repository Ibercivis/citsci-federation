import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CONFIDENTIAL_CLIENT } from "./clients.ts";
import {
  type Attempt,
  type AttemptOptions,
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
  aNewcomerWhoseAddressIsAffirmed,
  addressOf,
  arriving,
} from "./mock-source.ts";

/**
 * Arrive at an address a Person already holds and you become that Person: with
 * nothing asked, if the source you came from verified the address, and once
 * you have answered the Broker's mail if it did not (ADR-0004).
 *
 * **What stands between those two is the point.** Nothing in Keycloak asks the
 * question for free: the authenticator that performs the join reads the
 * address and never `email_verified`, so an Identity arriving with somebody
 * else's unverified address would simply become them — register somewhere that
 * checks nothing, wait for its owner to arrive. So what these cases are really
 * holding up is `broker/verified-email/` and the realm's `citsci first broker
 * login` flow. Take away either and they go red.
 *
 * Each case makes its own Person at an address of its own: the suite shares one
 * Broker, and a Person outlives the case that created them.
 */

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

/** The Person an arrival that should work comes back as. */
async function personFrom(arrival: AttemptOptions): Promise<string> {
  const { claims } = await authenticate(CONFIDENTIAL_CLIENT, arrival);
  expect(claims.sub).toMatch(PERSON_IDENTIFIER);
  return claims.sub as string;
}

/** A Person whose address was verified by their own Identity Source — the only
 *  kind the Broker joins an Identity to with nothing asked. */
const personArrivingWithAVerifiedEmail = (
  identity: MockIdentity,
): Promise<string> => personFrom(arriving(AFFIRMING_SOURCE_A, identity));

/**
 * The arrival this subflow holds back used to be turned away, told the service
 * it came from had not confirmed the address (`issue #149`). The mail is what
 * replaces that: ADR-0004 has already accepted that whoever reads a mailbox
 * can become its Person, so asking the mailbox adds no risk the decision has
 * not taken, and it turns the last closed door into the Person's own account.
 *
 * **A mail arriving is how these cases know the Broker stopped the join.** The
 * page saying so is Keycloak's own wording, and the flow could stop on a page
 * for reasons that have nothing to do with this rule — a missing `nonce`, for
 * instance. Nothing but this rule mails the address.
 */
describe("an unverified address joins no existing Person until its mail is answered", () => {
  it("mails an Identity whose own source does not affirm its address", async () => {
    const person = await personArrivingWithAVerifiedEmail("takeover-verified");
    const address = addressOf("takeover-unverified");
    const sent = await mailCountTo(address);

    // The same address, from a source that verifies addresses in general and
    // did not verify this one.
    const takeover = await attempt(
      CONFIDENTIAL_CLIENT,
      arriving(AFFIRMING_SOURCE_B, "takeover-unverified"),
    );

    // The dialogue stops on a page of the Broker's, and a mail is on its way
    // to the address itself. Waited for: the Broker sends it inside the
    // request that ended there, so counting straight away races the catcher.
    expect(takeover.outcome).toBe("refused-in-the-browser");
    await linkMailedTo(address, sent);
    expect(await mailCountTo(address)).toBe(sent + 1);
    // And nothing of that Person came back: no identifier, no token, no data.
    expect(JSON.stringify(takeover)).not.toContain(person);
  });

  it("mails an affirmed address when the Broker does not trust that source", async () => {
    // Trusting a source's word on addresses is one decision about one operator,
    // so it is set per source and never on the realm. A source nobody decided
    // to trust verifies nothing, whatever its claims say.
    const person = await personArrivingWithAVerifiedEmail("untrusted-verified");
    const address = addressOf("untrusted-verified");
    const sent = await mailCountTo(address);

    const throughUntrusted = await attempt(
      CONFIDENTIAL_CLIENT,
      arriving(SOURCE_AFFIRMING_NOTHING, "untrusted-verified"),
    );

    expect(throughUntrusted.outcome).toBe("refused-in-the-browser");
    await linkMailedTo(address, sent);
    expect(await mailCountTo(address)).toBe(sent + 1);
    expect(JSON.stringify(throughUntrusted)).not.toContain(person);
  });

  it("joins whoever answers that mail to the Person holding the address", async () => {
    // What the mail is for, and the only case here that finishes the join. A
    // fresh Identity per run, because an Identity that joined a Person once
    // never meets this flow again: `mock-source/README.md` says why that is
    // the one thing the fixed Identities above cannot stage.
    //
    // Unaffirmed here by the source not being trusted rather than by the
    // claim, because one username cannot carry both: the Person has to be made
    // at this address first, and that takes an arrival the Broker does affirm.
    // The condition reads the two facts as one, and the cases above cover the
    // claim.
    const newcomer = aNewcomerWhoseAddressIsAffirmed();
    const person = await personFrom(newcomer.through(AFFIRMING_SOURCE_A));
    const sent = await mailCountTo(newcomer.address);

    const browser = new Browser();
    const waiting = await attempt(CONFIDENTIAL_CLIENT, {
      browser,
      ...newcomer.through(SOURCE_AFFIRMING_NOTHING),
    });

    expect(waiting.outcome).toBe("refused-in-the-browser");

    // Answered, in the browser the Broker asked from.
    await follow(
      browser,
      await browser.get(await linkMailedTo(newcomer.address, sent)),
      CONFIDENTIAL_CLIENT,
    );

    // And now that Identity is one of this Person's: arriving through the
    // source that affirmed nothing reaches the Person who holds the address,
    // which is what the whole pilot is for.
    const joined = await authenticate(
      CONFIDENTIAL_CLIENT,
      newcomer.through(SOURCE_AFFIRMING_NOTHING),
    );

    expect(joined.claims.sub).toBe(person);

    // And the Person kept the address. `WithholdUnverifiedEmail` runs on this
    // path too, and taking the address off the Person it just joined would
    // leave the line above passing: the link is by Identity, not by address.
    // A third source affirming the same address is what reads it.
    const byAddress = await authenticate(
      CONFIDENTIAL_CLIENT,
      newcomer.through(AFFIRMING_SOURCE_B),
    );

    expect(byAddress.claims.sub).toBe(person);
  });

  it("leaves both of them where they were when the mail goes unanswered", async () => {
    // Two ways this could go wrong at once. A join that did not wait for the
    // click would hand the account over; and a Person whose address somebody
    // arrived badly at must still be able to sign in, or arriving badly often
    // enough is a way to lock them out.
    const person = await personArrivingWithAVerifiedEmail("takeover-verified");

    await attempt(
      CONFIDENTIAL_CLIENT,
      arriving(AFFIRMING_SOURCE_B, "takeover-unverified"),
    );
    const afterwards = await authenticate(
      CONFIDENTIAL_CLIENT,
      arriving(AFFIRMING_SOURCE_A, "takeover-verified"),
    );
    // The arrival that was mailed, coming back without having clicked: asked
    // again rather than let in, because it is still nobody.
    const unanswered = await attempt(
      CONFIDENTIAL_CLIENT,
      arriving(AFFIRMING_SOURCE_B, "takeover-unverified"),
    );

    expect(afterwards.claims.sub).toBe(person);
    expect(unanswered.outcome).toBe("refused-in-the-browser");
    expect(JSON.stringify(unanswered)).not.toContain(person);
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
    // What the pilot exists to demonstrate, and what the rule above must not
    // have cost. An enforcement that asked everyone for a mail, or turned them
    // away, would pass every case above (issue #25).
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
