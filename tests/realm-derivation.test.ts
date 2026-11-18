import { describe, expect, it } from "vitest";
import { type Realm, derive } from "../broker/realm/derive.ts";

/**
 * The step that turns the Broker's declaration into the one realm Keycloak
 * imports. It runs inside the image build, so these cases are the only place
 * it is exercised without building one.
 */

const PROFILE = { attributes: [{ name: "email" }] };

const BASE = {
  realm: "citsci",
  clients: [{ clientId: "brokered-app-public" }],
  identityProviders: [],
};

const TESTING = {
  clients: [{ clientId: "misconfigured-client" }],
  users: [{ username: "demo" }],
};

const declaration = (testing: Realm = TESTING) => ({
  base: BASE,
  testing,
  userProfile: PROFILE,
});

describe("deriving the realm Keycloak imports", () => {
  it("builds the base alone in production, with the user profile as its components entry", () => {
    expect(derive("production", declaration())).toEqual({
      realm: "citsci",
      clients: [{ clientId: "brokered-app-public" }],
      identityProviders: [],
      components: {
        "org.keycloak.userprofile.UserProfileProvider": [
          {
            providerId: "declarative-user-profile",
            subComponents: {},
            config: {
              "kc.user.profile.config": ['{"attributes":[{"name":"email"}]}'],
            },
          },
        ],
      },
    });
  });

  it("appends the testing layer's entries to the base's in testing", () => {
    const realm = derive("testing", declaration());

    expect(realm["clients"]).toEqual([
      { clientId: "brokered-app-public" },
      { clientId: "misconfigured-client" },
    ]);
    expect(realm["users"]).toEqual([{ username: "demo" }]);
    expect(realm["identityProviders"]).toEqual([]);
  });

  it("refuses a mode it does not know, rather than building the base alone", () => {
    expect(() => derive("testng", declaration())).toThrow(
      'Unknown BROKER_MODE "testng": it is "testing" or "production".',
    );
  });

  it("refuses a testing layer that re-declares an entry the base declares", () => {
    const redeclaring = {
      clients: [{ clientId: "brokered-app-public", implicitFlowEnabled: true }],
    };

    expect(() => derive("testing", declaration(redeclaring))).toThrow(
      'The testing layer re-declares clients "brokered-app-public", which the base declares. A layer only adds.',
    );
  });

  it("refuses a testing layer that re-declares an entry known only by its name", () => {
    const base = { ...BASE, clientScopes: [{ name: "voperson_id" }] };
    const redeclaring = { clientScopes: [{ name: "voperson_id" }] };

    expect(() =>
      derive("testing", {
        base,
        testing: redeclaring,
        userProfile: PROFILE,
      }),
    ).toThrow(
      'The testing layer re-declares clientScopes "voperson_id", which the base declares. A layer only adds.',
    );
  });

  it("refuses a testing layer that sets a value rather than adding entries", () => {
    expect(() =>
      derive("testing", declaration({ loginWithEmailAllowed: false })),
    ).toThrow(
      'The testing layer sets "loginWithEmailAllowed", which is not a list of entries. A layer only adds.',
    );
  });
});
