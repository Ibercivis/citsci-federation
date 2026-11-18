/**
 * The one step between the Broker's declaration and what Keycloak imports.
 *
 * It runs inside the image build (`broker/Dockerfile`):
 *
 *   node derive.ts > realm-citsci.json
 *
 * `base.json` is the realm, and `user-profile.json` becomes its user profile.
 * What comes out is never written into this repository, so there is nothing
 * to edit by hand.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Realm = Record<string, unknown>;

export interface Declaration {
  base: Realm;
  userProfile: object;
}

export function derive(declaration: Declaration): Realm {
  return {
    ...declaration.base,
    components: userProfileComponent(declaration.userProfile),
  };
}

/**
 * The realm format has no field of its own for a user profile. It takes one
 * only as a component whose value is the whole profile as a single string,
 * which nobody can review in a diff. So the profile is kept readable in
 * `user-profile.json`, and the string is made here.
 */
function userProfileComponent(profile: object) {
  return {
    "org.keycloak.userprofile.UserProfileProvider": [
      {
        providerId: "declarative-user-profile",
        subComponents: {},
        config: { "kc.user.profile.config": [JSON.stringify(profile)] },
      },
    ],
  };
}

const read = (name: string) =>
  JSON.parse(readFileSync(join(import.meta.dirname, name), "utf8"));

if (import.meta.main) {
  const realm = derive({
    base: read("base.json"),
    userProfile: read("user-profile.json"),
  });
  process.stdout.write(`${JSON.stringify(realm, null, 2)}\n`);
}
