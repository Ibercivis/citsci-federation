import { describe, expect, it } from "vitest";
import { ISSUER } from "./broker.ts";
import { PUBLIC_CLIENT } from "./clients.ts";
import {
  Browser,
  createPkce,
  follow,
  linksOn,
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

const LAUNCH_SOURCES = [
  {
    alias: "google",
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "openid email",
    pkce: true,
  },
  {
    alias: "github",
    authorize: "https://github.com/login/oauth/authorize",
    scope: "user:email",
    pkce: false,
  },
];

/** Where the Broker sends a Person who pressed this source's button, read off
 *  the redirect and never followed. */
async function requestSentTo(name: string): Promise<URL> {
  const browser = new Browser();
  const { challenge } = createPkce("S256");
  const landing = await follow(
    browser,
    await requestAuthorization(browser, PUBLIC_CLIENT, {
      nonce: "launch-sources",
      code_challenge: challenge,
      code_challenge_method: "S256",
    }),
    PUBLIC_CLIENT,
  );
  if (landing.at !== "a page") {
    throw new Error("The public client was sent back without a sign-in page.");
  }
  const button = linksOn(landing.page).find((link) => link.text.includes(name));
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
  ({ alias, authorize, scope, pkce }) => {
    const { name } = declaredSource(alias);

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

    it.runIf(pkce)("binds the code to this request with PKCE", async () => {
      const request = await requestSentTo(name);

      expect(request.searchParams.get("code_challenge_method")).toBe("S256");
      expect(request.searchParams.get("code_challenge")).toBeTruthy();
    });

    it("names a client id, never the placeholder's literal text", async () => {
      const request = await requestSentTo(name);
      const clientId = request.searchParams.get("client_id") ?? "";

      expect(clientId).not.toBe("");
      expect(clientId).not.toContain("${");
    });
  },
);
