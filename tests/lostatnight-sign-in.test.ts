import { describe, expect, it } from "vitest";
import { Browser, formsOn, type Page } from "./brokered-app.ts";
import { PERSON_IDENTIFIER, configured } from "./broker.ts";
import { DEMO_IDENTITY } from "./clients.ts";

/**
 * A Brokered App signing a Person in, driven as a browser drives it.
 *
 * Every other case here acts as the Brokered App itself: it builds the
 * authorization request, redeems the code and reads the token. This one acts
 * as the Person instead, and the application is LostAtNight — so what it
 * proves is the half no protocol case can reach. That the button exists, that
 * the application's own OpenID Connect library asks for what the realm
 * requires, that it redeems the code with its own secret, and that the session
 * it leaves behind carries the Person Identifier onto a page.
 *
 * It needs the Brokered App up, which `pnpm broker:up` alone does not start,
 * so it skips rather than fails when the composition is not running.
 * `pnpm apps:up` is what makes it run.
 *
 * One application is not single sign-on. Arriving at a *second* application
 * already signed in is what the pilot exists to demonstrate, and it waits on
 * the other integrations (`issue #30`, `issue #31`).
 */

const APP = configured("LOSTATNIGHT_BASE_URL");

/** Where the application's own library serves the provider it was configured
 *  with. Written out rather than discovered: the realm registers this path as
 *  a redirect URI, so the two cannot change apart without this failing. */
const SIGN_IN_PATH = "/accounts/oidc/ibercivis/login/";

const answering = await fetch(`${APP}/accounts/login/`, {
  redirect: "manual",
  signal: AbortSignal.timeout(5_000),
})
  .then((response) => response.ok)
  .catch(() => false);

/** Follows redirects by hand, across both hosts, until a page is served.
 *  `follow` in brokered-app.ts stops at the application's callback, because
 *  there it is the application; here the application answers for itself. */
async function land(browser: Browser, response: Response): Promise<Page> {
  let current = response;
  for (let hop = 0; hop < 12; hop += 1) {
    const location = current.headers.get("location");
    if (!location) return { url: current.url, html: await current.text() };
    current = await browser.get(new URL(location, current.url).href);
  }
  throw new Error(
    "More than twelve redirects without a page. A loop is not a refusal, so " +
      "this says so rather than reporting one.",
  );
}

/** Submits a form the way a browser does: its own fields, plus the one
 *  control pressed. */
async function press(
  browser: Browser,
  page: Page,
  form: { action: string; fields: Record<string, string> },
  pressed: Record<string, string> = {},
): Promise<Page> {
  const action = new URL(form.action, page.url).href;
  return land(
    browser,
    await browser.postForm(action, { ...form.fields, ...pressed }),
  );
}

describe.skipIf(!answering)(
  "LostAtNight, signed in with an Ibercivis account",
  () => {
    it("sends a Person to the Broker and brings them back signed in", async () => {
      const browser = new Browser();

      const login = await land(
        browser,
        await browser.get(`${APP}/accounts/login/`),
      );
      expect(
        login.html,
        "the sign-in page offers an Ibercivis account",
      ).toContain(SIGN_IN_PATH);
      // ADR-0007, asserted rather than checked by hand: the page a newcomer
      // reaches invites them to the Broker and nowhere else. The address it no
      // longer links still answers -- it explains itself -- so this reads the
      // page rather than the status of that path.
      expect(
        login.html,
        "and no longer offers to create an account here",
      ).not.toContain("/accounts/signup/");

      const broker = await land(
        browser,
        await browser.get(`${APP}${SIGN_IN_PATH}?process=login`),
      );
      expect(
        new URL(broker.url).host,
        "the Broker's own page, nobody else's",
      ).toBe(new URL(configured("BROKER_ISSUER")).host);

      const form = formsOn(broker).find(
        (candidate) => "password" in candidate.fields,
      );
      expect(form, "a sign-in form on the Broker's page").toBeDefined();
      let page = await press(browser, broker, form!, {
        username: DEMO_IDENTITY.username,
        password: DEMO_IDENTITY.password,
      });

      // Consent is the realm's decision, not this application's: the client is
      // declared `consentRequired`, and a Person who has already consented is
      // not asked again. Either way the sign-in finishes.
      const consent = formsOn(page).find(
        (candidate) => "accept" in candidate.controls,
      );
      if (consent) {
        page = await press(browser, page, consent, {
          accept: consent.controls.accept!,
        });
      }

      expect(new URL(page.url).host, "back on the application").toBe(
        new URL(APP).host,
      );
      // ADR-0004 and this ticket's second trap: the Broker confirmed the
      // address, so the application must not ask again. It would ask by
      // serving /accounts/confirm-email/ instead of signing the Person in.
      expect(page.url, "not asked to confirm the address again").not.toContain(
        "confirm-email",
      );
      expect(page.html).toContain(DEMO_IDENTITY.username);

      const profile = await land(
        browser,
        await browser.get(`${APP}/user-profile/`),
      );
      expect(profile.url, "the personal area, not the sign-in page").toContain(
        "/user-profile/",
      );
      const shown = /ibercivis-account-id">([^<]+)</
        .exec(profile.html)?.[1]
        ?.trim();
      expect(shown, "the identifier the Broker minted, on the page").toMatch(
        PERSON_IDENTIFIER,
      );
    });
  },
);
