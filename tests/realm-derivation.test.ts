import { describe, expect, it } from "vitest";
import { derive } from "../broker/realm/derive.ts";

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

describe("deriving the realm Keycloak imports", () => {
  it("builds the realm with the user profile as its components entry", () => {
    expect(derive({ base: BASE, userProfile: PROFILE })).toEqual({
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
});
