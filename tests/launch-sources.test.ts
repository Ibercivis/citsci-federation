import { describe, expect, it } from "vitest";
import { ISSUER } from "./broker.ts";
import { ACCOUNT_CONSOLE } from "./clients.ts";
import {
  Browser,
  createPkce,
  follow,
  linksOn,
  type Page,
  requestAuthorization,
} from "./brokered-app.ts";
import { declaredSource } from "./realm.ts";

/**
 * Google and GitHub, the launch Identity Sources, as far as the Broker takes a
 * Person towards them: the button on the sign-in page, and the request it
 * sends them to. What happens at Google or GitHub needs a real account and the
 * real credentials, so it is walked by hand (`docs/trying-it-by-hand.md`).
 *
 * A credential nobody valued imports as `not-configured`, the default each
 * placeholder in the realm carries, and only a sign-in through that source
 * fails. Without that default Keycloak imports the literal `${NAME}`, and a
 * source sent that as its `client_id` refuses every Person with an error that
 * names nothing of ours. The request is where a dropped default would show.
 */

/**
 * `darkMark` is the login theme's own list, not a choice of ours:
 * `keycloak.v2` ships a second mark for a dark page for GitHub, Instagram and
 * Twitter, and a single file for every other source it knows. It chooses both
 * by the provider id and never by the alias, which is why the cases below read
 * the id from the realm.
 */
const LAUNCH_SOURCES = [
  {
    alias: "google",
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "openid email",
    /** The challenge method the Broker sends this source, or `null` for one
     *  that takes none. GitHub's OAuth has no PKCE, so what is worth holding
     *  there is the parameter's absence: it is what would notice a challenge
     *  arriving at a source that cannot bind a code with it. */
    pkceMethod: "S256",
    darkMark: false,
  },
  {
    alias: "github",
    authorize: "https://github.com/login/oauth/authorize",
    scope: "user:email",
    pkceMethod: null,
    darkMark: true,
  },
];

/** The Broker's sign-in page, and the browser that was shown it. From the
 *  Account Console, which every realm has, so these hold on a `production`
 *  Broker too. */
async function signInPage(): Promise<{ browser: Browser; page: Page }> {
  const browser = new Browser();
  const { challenge } = createPkce("S256");
  const landing = await follow(
    browser,
    await requestAuthorization(browser, ACCOUNT_CONSOLE, {
      nonce: "launch-sources",
      code_challenge: challenge,
      code_challenge_method: "S256",
    }),
    ACCOUNT_CONSOLE,
  );
  if (landing.at !== "a page") {
    throw new Error(
      "The Account Console was sent back without a sign-in page.",
    );
  }
  return { browser, page: landing.page };
}

/** One source's button, sliced out of the page by the id the login theme
 *  gives it. The mark it draws is in there, and nowhere else on the page. */
function buttonFor(page: Page, alias: string): string {
  const button = new RegExp(`<a[^>]*id="social-${alias}"[\\s\\S]*?</a>`).exec(
    page.html,
  );
  if (!button) {
    throw new Error(`The sign-in page offers no button for ${alias}.`);
  }
  return button[0];
}

/** Where the Broker sends a Person who pressed this source's button, read off
 *  the redirect and never followed. */
async function requestSentTo(name: string): Promise<URL> {
  const { browser, page } = await signInPage();
  const button = linksOn(page).find((link) => link.text.includes(name));
  if (!button) throw new Error(`The sign-in page offers no ${name}.`);
  const pressed = await browser.get(button.href);
  const location = pressed.headers.get("location");
  if (!location) {
    throw new Error(
      `Pressing ${name} answered ${pressed.status}, no redirect.`,
    );
  }
  return new URL(location);
}

describe.each(LAUNCH_SOURCES)(
  "the $alias button",
  ({ alias, authorize, scope, pkceMethod, darkMark }) => {
    const { name, provider } = declaredSource(alias);

    it("sends the Person to the source's own authorization page", async () => {
      const request = await requestSentTo(name);

      expect(`${request.origin}${request.pathname}`).toBe(authorize);
      expect(request.searchParams.get("response_type")).toBe("code");
      expect(request.searchParams.get("state")).toBeTruthy();
    });

    it("asks to be sent back to the Broker, and for the address alone", async () => {
      const request = await requestSentTo(name);

      expect(request.searchParams.get("redirect_uri")).toBe(
        `${ISSUER}/broker/${alias}/endpoint`,
      );
      expect(request.searchParams.get("scope")).toBe(scope);
    });

    it("sends the PKCE challenge this source accepts, and none where it accepts none", async () => {
      const request = await requestSentTo(name);

      expect(request.searchParams.get("code_challenge_method")).toBe(
        pkceMethod,
      );
      // A challenge is there exactly when a method is.
      expect(Boolean(request.searchParams.get("code_challenge"))).toBe(
        Boolean(pkceMethod),
      );
    });

    it("draws the source's own mark, never the theme's generic one", async () => {
      const { page } = await signInPage();
      const button = buttonFor(page, alias);

      expect(button).toContain(`img/social/${provider}.svg`);
      expect(button).not.toContain("img/social/default");
    });

    it.runIf(darkMark)("draws a mark made for a dark page too", async () => {
      const { page } = await signInPage();

      expect(buttonFor(page, alias)).toContain(
        `img/social/${provider}-light.svg`,
      );
    });

    it("names a client id, never the placeholder's literal text", async () => {
      const request = await requestSentTo(name);
      const clientId = request.searchParams.get("client_id") ?? "";

      expect(clientId).not.toBe("");
      expect(clientId).not.toContain("${");
    });
  },
);
