/**
 * The one step between the Broker's declaration and what Keycloak imports.
 *
 * Keycloak imports one complete realm per file and cannot layer two, so the
 * layering happens here, inside the image build (`broker/Dockerfile`):
 *
 *   node derive.ts <testing|production> <MOCK_ISSUER> > realm-citsci.json
 *
 * `base.json` is the whole Broker anywhere it runs. `testing.json` only adds
 * to it, and only in `testing`. `user-profile.json` becomes the realm's user
 * profile. In `testing`, the Mock Identity Source's issuer is written into the
 * layer here, so the build fails without it rather than importing endpoints
 * with nothing in front of them. What comes out is never written into this
 * repository, so there is nothing to edit by hand. `broker/README.md` says
 * which layer an addition belongs in.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Realm = Record<string, unknown>;

export interface Declaration {
  base: Realm;
  testing: Realm;
  userProfile: object;
}

/** The two ways the Broker runs. Anything else is refused, so a typo cannot
 *  quietly build the base alone. */
const MODES = ["testing", "production"];

export function derive(
  mode: string,
  declaration: Declaration,
  mockIssuer = "",
): Realm {
  if (!MODES.includes(mode)) {
    throw new Error(
      `Unknown BROKER_MODE "${mode}": it is "testing" or "production".`,
    );
  }
  if ("components" in declaration.base) {
    throw new Error(
      'The base declares "components", which derive.ts builds from user-profile.json. Declare a component by changing derive.ts.',
    );
  }
  const realm: Realm = { ...declaration.base };
  if (mode === "testing") {
    if (mockIssuer === "") {
      throw new Error(
        "No MOCK_ISSUER: the testing layer's Mock Identity Sources are reached at it. Declare it in .env.",
      );
    }
    const layer = withIssuer(declaration.testing, mockIssuer) as Realm;
    for (const [field, entries] of Object.entries(layer)) {
      realm[field] = appendLayer(field, realm[field] ?? [], entries);
    }
  }
  realm["components"] = userProfileComponent(declaration.userProfile);
  return realm;
}

/** The base's entries with the layer's after them, refusing what "A layer
 *  only adds" in `broker/README.md` rules out. */
function appendLayer(field: string, base: unknown, layer: unknown): unknown[] {
  if (!Array.isArray(layer) || !Array.isArray(base)) {
    throw new Error(
      `The testing layer sets "${field}", which is not a list of entries. A layer only adds.`,
    );
  }
  const taken = new Set(base.map(keyOf));
  for (const entry of layer) {
    const key = keyOf(entry);
    if (key !== undefined && taken.has(key)) {
      throw new Error(
        `The testing layer re-declares ${field} "${key}", which the base declares. A layer only adds.`,
      );
    }
  }
  return [...base, ...layer];
}

/** The field an entry of the realm is known by, whichever kind it is. `name`
 *  comes last: a client carries one too, but is known by its `clientId`. */
function keyOf(entry: unknown): string | undefined {
  const fields = entry as Record<string, unknown>;
  const key =
    fields["clientId"] ??
    fields["alias"] ??
    fields["username"] ??
    fields["name"];
  return typeof key === "string" ? key : undefined;
}

/** Every `${MOCK_ISSUER}` in the layer's strings, replaced by the issuer. */
function withIssuer(value: unknown, issuer: string): unknown {
  if (typeof value === "string") {
    return value.replaceAll("${MOCK_ISSUER}", issuer);
  }
  if (Array.isArray(value)) {
    return value.map((item) => withIssuer(item, issuer));
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        withIssuer(item, issuer),
      ]),
    );
  }
  return value;
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
  const realm = derive(
    process.argv[2] ?? "",
    {
      base: read("base.json"),
      testing: read("testing.json"),
      userProfile: read("user-profile.json"),
    },
    process.argv[3],
  );
  process.stdout.write(`${JSON.stringify(realm, null, 2)}\n`);
}
