import { describe, expect, it } from "vitest";
import { configured } from "./broker.ts";
import { type Client, PUBLIC_CLIENT } from "./clients.ts";
import {
  Browser,
  attempt,
  createPkce,
  follow,
  formsOn,
  linkTextsOn,
  requestAuthorization,
} from "./brokered-app.ts";
import base from "../broker/realm/base.json" with { type: "json" };
import testing from "../broker/realm/testing.json" with { type: "json" };

/**
 * Seam 2: the running Broker is the declaration this stack claims to be.
 *
 * The claim is BROKER_MODE: `testing` is the base plus the testing layer, and
 * `production` is the base alone. Each entry the two layers declare is looked
 * for the way a Brokered App or a Person would meet it, and expected exactly
 * when its layer is claimed. So a testing layer present where it should be
 * absent fails here, and so does one missing where it should be present —
 * including a realm left in the database by a stack built in the other mode,
 * which `--import-realm` does not replace.
 *
 * The entries are read from the layer files, so an entry added to either is
 * covered without touching this file.
 */

const MODE = configured("BROKER_MODE");
const TESTING_CLAIMED = MODE === "testing";

interface Layer {
  clients?: ReadonlyArray<{
    clientId: string;
    name?: string;
    redirectUris?: ReadonlyArray<string>;
  }>;
  identityProviders?: ReadonlyArray<{ alias: string; displayName: string }>;
  users?: ReadonlyArray<{
    username: string;
    credentials?: ReadonlyArray<{ type: string; value: string }>;
  }>;
}

const LAYERS: ReadonlyArray<[string, Layer, boolean]> = [
  ["base", base, true],
  ["testing", testing, TESTING_CLAIMED],
];

const presence = (expected: boolean) => (expected ? "present" : "absent");

/** Whether an authorization request from this client reaches a sign-in form.
 *  A client the Broker does not know gets an error page, and no form. */
async function offersSignIn(client: Client): Promise<boolean> {
  const browser = new Browser();
  const { challenge } = createPkce("S256");
  const response = await requestAuthorization(browser, client, {
    nonce: "seam-2",
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  const landing = await follow(browser, response, client);
  if (landing.at !== "a page") return false;
  return formsOn(landing.page).some(
    (form) => "username" in form.fields && "password" in form.fields,
  );
}

/** The link texts on the sign-in page a Person meets, which is where the
 *  Identity Sources are offered. */
async function signInPageLinks(): Promise<string[]> {
  const browser = new Browser();
  const { challenge } = createPkce("S256");
  const response = await requestAuthorization(browser, PUBLIC_CLIENT, {
    nonce: "seam-2",
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  const landing = await follow(browser, response, PUBLIC_CLIENT);
  if (landing.at !== "a page") {
    throw new Error("The public client was sent back without a sign-in page.");
  }
  return linkTextsOn(landing.page.html);
}

describe(`the running Broker is the ${MODE} declaration`, () => {
  describe.each(LAYERS)("the %s layer", (_layer, layer, expected) => {
    const clients = layer.clients ?? [];
    const sources = layer.identityProviders ?? [];
    const users = layer.users ?? [];

    it.runIf(clients.length > 0).each(clients)(
      `has client $clientId ${presence(expected)}`,
      async (declared) => {
        const client: Client = {
          id: declared.clientId,
          name: declared.name ?? declared.clientId,
          redirectUri: declared.redirectUris?.[0] ?? "",
        };
        expect(await offersSignIn(client)).toBe(expected);
      },
    );

    it.runIf(sources.length > 0).each(sources)(
      `has Identity Source $alias ${presence(expected)} on the sign-in page`,
      async (declared) => {
        const links = await signInPageLinks();
        expect(links.some((text) => text.includes(declared.displayName))).toBe(
          expected,
        );
      },
    );

    it.runIf(users.length > 0).each(users)(
      `has Identity $username ${presence(expected)}`,
      async (declared) => {
        const password =
          declared.credentials?.find((c) => c.type === "password")?.value ?? "";
        const result = await attempt(PUBLIC_CLIENT, {
          pkce: createPkce("S256"),
          as: { username: declared.username, password },
        });
        expect(result.outcome === "authenticated").toBe(expected);
      },
    );
  });
});
