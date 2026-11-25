import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CONFIDENTIAL_CLIENT } from "./clients.ts";
import { PERSON_IDENTIFIER } from "./broker.ts";
import { Browser, attempt, authenticate, follow } from "./brokered-app.ts";
import { linkMailedTo, mailCountTo } from "./mailbox.ts";
import { declaredSource } from "./realm.ts";
import {
  AFFIRMING_SOURCE_A,
  AFFIRMING_SOURCE_B,
  aGitHubNewcomer,
  aNewcomerWhoseAddressIsAffirmed,
  arriving,
  arrivingThroughGitHub,
  primaryAddressOf,
} from "./mock-identity-source.ts";

/**
 * GitHub vouches for an address only when its own email list marks it
 * verified, and the Broker takes its word on that and on nothing less.
 *
 * GitHub is not an OpenID provider, so it sends no `email_verified`. Keycloak's
 * own GitHub provider takes the primary address and never reads the `verified`
 * beside it. These cases arrive through the Mock Identity Source's GitHub
 * imitation, which serves that list the way GitHub does.
 *
 * Each case uses an address of its own: the suite shares one Broker, and a
 * Person outlives the case that created them. A case that finishes a sign-in
 * it had to wait for uses a newcomer minted for the run, because a fixed
 * Identity would arrive the second time as the Person the first run made.
 */

describe("a GitHub Identity whose primary address GitHub verified", () => {
  it("joins the Person who already holds that address", async () => {
    const first = await authenticate(
      CONFIDENTIAL_CLIENT,
      arriving(AFFIRMING_SOURCE_A, "octocat-verified"),
    );
    expect(first.claims.sub).toMatch(PERSON_IDENTIFIER);

    const throughGitHub = await authenticate(
      CONFIDENTIAL_CLIENT,
      arrivingThroughGitHub("github-octocat"),
    );

    expect(throughGitHub.claims.sub).toBe(first.claims.sub);
  });

  it("is a Person straight away at an address nobody holds", async () => {
    const { claims } = await authenticate(
      CONFIDENTIAL_CLIENT,
      aGitHubNewcomer("verified").arriving(),
    );

    expect(claims.sub).toMatch(PERSON_IDENTIFIER);
  });
});

describe("a GitHub Identity whose primary address GitHub did not verify", () => {
  it("joins nobody who holds that address, and mails it instead", async () => {
    const holder = await authenticate(
      CONFIDENTIAL_CLIENT,
      arriving(AFFIRMING_SOURCE_A, "spoofed-verified"),
    );
    const address = primaryAddressOf("github-spoofer");
    const sent = await mailCountTo(address);

    const spoofer = await attempt(
      CONFIDENTIAL_CLIENT,
      arrivingThroughGitHub("github-spoofer"),
    );

    // Held on a page of the Broker's, with the link on its way to the address
    // itself: whoever answers it is the Person who holds it (ADR-0004).
    // Waited for, because the Broker sends it inside the request that ended
    // there.
    expect(spoofer.outcome).toBe("refused-in-the-browser");
    await linkMailedTo(address, sent);
    expect(JSON.stringify(spoofer)).not.toContain(holder.claims.sub);
  });

  it("joins whoever answers that mail to the Person holding the address", async () => {
    // What the mail is for. The holder is made through a source that affirms
    // the address, and a GitHub Identity minted at the same address arrives
    // with GitHub saying it did not verify it.
    const holder = aNewcomerWhoseAddressIsAffirmed();
    const person = await authenticate(
      CONFIDENTIAL_CLIENT,
      holder.through(AFFIRMING_SOURCE_A),
    );
    const gitHub = aGitHubNewcomer("unverified", holder.address);
    const sent = await mailCountTo(holder.address);

    const browser = new Browser();
    const waiting = await attempt(CONFIDENTIAL_CLIENT, {
      browser,
      ...gitHub.arriving(),
    });

    expect(waiting.outcome).toBe("refused-in-the-browser");

    // Answered, in the browser the Broker asked from.
    await follow(
      browser,
      await browser.get(await linkMailedTo(holder.address, sent)),
      CONFIDENTIAL_CLIENT,
    );

    // And now that GitHub Identity is one of this Person's.
    const joined = await authenticate(CONFIDENTIAL_CLIENT, gitHub.arriving());

    expect(joined.claims.sub).toBe(person.claims.sub);

    // And the Person kept the address: a third source affirming it reaches
    // them. The line above would pass either way, because the link is by
    // Identity and not by address.
    const byAddress = await authenticate(
      CONFIDENTIAL_CLIENT,
      holder.through(AFFIRMING_SOURCE_B),
    );

    expect(byAddress.claims.sub).toBe(person.claims.sub);
  });

  it("is not a Person until an address is confirmed by mail", async () => {
    // Nobody holds this address. The Broker keeps none it was not sure of,
    // asks for one on "Update email", and mails what is typed there. A
    // newcomer and an address per run: an Identity held once is not asked
    // again, so a second run would see no mail.
    //
    // This case passes on Keycloak's own GitHub provider too, which leaves
    // every GitHub arrival unaffirmed. The two verified cases above are what
    // tell that provider and ours apart.
    const address = `${randomUUID()}@newcomer.test`;

    const unconfirmed = await attempt(
      CONFIDENTIAL_CLIENT,
      aGitHubNewcomer("unverified").arriving(address),
    );

    // Signed straight in is what an address GitHub had verified would get,
    // through a source the Broker trusts. GitHub said it had not.
    expect(unconfirmed.outcome).toBe("refused-in-the-browser");
    await linkMailedTo(address);
    expect(await mailCountTo(address)).toBe(1);
  });
});

/**
 * What the Broker cannot read counts as unverified, whatever GitHub would have
 * said. Both Identities here are ones GitHub verified; the Broker just cannot
 * see that it did. Held, as an unverified newcomer is, rather than let in on a
 * verdict nobody read.
 */
describe("a GitHub Identity whose verdict the Broker cannot read", () => {
  it.each([
    ["an email list it cannot read", "unreadableEmails"],
    ["an address the list does not carry", "addressNotListed"],
  ] as const)("is held, with %s", async (_what, shape) => {
    const address = `${randomUUID()}@newcomer.test`;

    const arrival = await attempt(
      CONFIDENTIAL_CLIENT,
      aGitHubNewcomer(shape).arriving(address),
    );

    expect(arrival.outcome).toBe("refused-in-the-browser");
    await linkMailedTo(address);
    expect(await mailCountTo(address)).toBe(1);
  });
});

/**
 * What the cases above prove is proved through the Mock Identity Source's
 * GitHub imitation. It reaches the launch GitHub source, which no test can
 * sign in through, only because both name the same Keycloak provider — and
 * that provider is the stock id, which `issue #225` is why.
 *
 * The mark that id draws on the button is held in
 * `tests/launch-sources.test.ts`.
 */
describe("the provider these cases exercise", () => {
  it("is the one the launch GitHub source goes through", () => {
    expect(declaredSource("mock-identity-source-github").provider).toBe(
      declaredSource("github").provider,
    );
  });
});
