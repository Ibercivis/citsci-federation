import { describe, expect, it } from "vitest";
import { configured } from "./broker.ts";
import { type Client, PUBLIC_CLIENT } from "./clients.ts";
import { asImported } from "./realm.ts";
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
 * covered without touching this file — for the kinds in LOOKED_FOR. The
 * testing layer may declare no other, so a new kind there fails until this
 * file learns how to look for it.
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

/** The kinds of entry this file knows how to look for. */
const LOOKED_FOR: ReadonlyArray<keyof Layer> = [
  "clients",
  "identityProviders",
  "users",
];

const LAYERS: ReadonlyArray<[string, Layer, boolean]> = [
  ["base", base, true],
  ["testing", testing, TESTING_CLAIMED],
];

/** The layers holding something to look for. Vitest refuses a suite with no
 *  case in it, so a layer emptied of every kind above drops out rather than
 *  failing the file. */
const LOOKED_FOR_IN = LAYERS.filter(([, layer]) =>
  LOOKED_FOR.some((kind) => (layer[kind]?.length ?? 0) > 0),
);

const presence = (expected: boolean) => (expected ? "present" : "absent");

/** Where an authorization request from this client lands, in a fresh browser. */
async function landingFor(client: Client) {
  const browser = new Browser();
  const { challenge } = createPkce("S256");
  const response = await requestAuthorization(browser, client, {
    nonce: "seam-2",
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return follow(browser, response, client);
}

/** Whether an authorization request from this client reaches a sign-in form.
 *  A client the Broker does not know gets an error page, and no form. */
async function offersSignIn(client: Client): Promise<boolean> {
  const landing = await landingFor(client);
  if (landing.at !== "a page") return false;
  return formsOn(landing.page).some(
    (form) => "username" in form.fields && "password" in form.fields,
  );
}

/** The link texts on the sign-in page a Person meets, which is where the
 *  Identity Sources are offered. */
async function signInPageLinks(): Promise<string[]> {
  const landing = await landingFor(PUBLIC_CLIENT);
  if (landing.at !== "a page") {
    throw new Error("The public client was sent back without a sign-in page.");
  }
  return linkTextsOn(landing.page.html);
}

describe(`the running Broker is the ${MODE} declaration`, () => {
  it("knows how to look for every kind of entry the testing layer declares", () => {
    const unknown = Object.keys(testing).filter(
      (kind) => !(LOOKED_FOR as ReadonlyArray<string>).includes(kind),
    );
    expect(
      unknown,
      "The testing layer declares a kind seam 2 cannot look for. Teach tests/declaration.test.ts to find it the way a Brokered App or a Person would.",
    ).toEqual([]);
  });

  describe.each(LOOKED_FOR_IN)("the %s layer", (_layer, layer, expected) => {
    // Read as Keycloak imported them, so a client the layer references by
    // `${NAME}` is looked for under the id and the address `.env` declares.
    const clients = (layer.clients ?? []).map((declared) => ({
      ...declared,
      clientId: asImported(declared.clientId),
      redirectUris: declared.redirectUris?.map(asImported),
    }));
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
