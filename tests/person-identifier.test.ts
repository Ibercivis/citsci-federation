import { describe, expect, it } from "vitest";
import { CLIENT_TYPES, CONFIDENTIAL_CLIENT, PUBLIC_CLIENT } from "./clients.ts";
import { authenticate, everyPlace, introspect } from "./brokered-app.ts";
import { PERSON_IDENTIFIER } from "./broker.ts";
import { AFFIRMING_SOURCE_A, arriving } from "./mock-identity-source.ts";

/*
 * The Person Identifier (ADR-0002) is all a Brokered App ever stores about
 * who signed in. Shown here the only way a Brokered App could see it: in what
 * the Broker hands over.
 */

const NOT_SCOPED =
  "The Person Identifier is not <uuid>@ibercivis.es. A bare UUID here means " +
  "the Person Identifier mapper did not run: the realm declares a mapper " +
  "type the running Keycloak does not have, which Keycloak accepts without " +
  "a word. Rebuild the Broker with `pnpm broker:reset`.";

/**
 * Claims that would mean authorisation is coming from the Broker. It emits
 * none (ADR-0003): roles stay local to each Brokered App.
 */
const AUTHORISATION_CLAIMS = [
  "roles",
  "realm_access",
  "resource_access",
  "groups",
  "entitlements",
  "eduperson_entitlement",
];

/**
 * OpenID Connect's standard Profile claims. A Profile is not the Broker's to
 * hold or hand out, and an application that read one from a token would
 * foreclose the Profile service (ADR-0002).
 */
const PROFILE_CLAIMS = [
  "name",
  "given_name",
  "family_name",
  "middle_name",
  "nickname",
  "preferred_username",
  "profile",
  "picture",
  "website",
  "gender",
  "birthdate",
  "zoneinfo",
  "locale",
  "updated_at",
  "address",
  "phone_number",
];

/**
 * Claims that would tell a Brokered App which identity source the Person
 * signed in with. An application stores every claim it is handed, so the
 * Broker is where this has to hold.
 */
const SOURCE_CLAIMS = [
  "identity_provider",
  "identity_provider_identity",
  "idp",
];

describe.each(CLIENT_TYPES)(
  "a %s Brokered App knows the Person by their Person Identifier",
  (_shape, client) => {
    it("receives it in sub and in voperson_id, scoped with the organisation's domain", async () => {
      const { claims } = await authenticate(client);

      expect(claims.sub, NOT_SCOPED).toMatch(PERSON_IDENTIFIER);
      expect(claims.voperson_id).toBe(claims.sub);
    });

    it("receives the same one everywhere it can look", async () => {
      const { idToken, places } = await everyPlace(client);

      for (const [place, body] of places) {
        expect(body.sub, `sub in ${place}`).toBe(idToken.sub);
        expect(body.voperson_id, `voperson_id in ${place}`).toBe(idToken.sub);
      }
    });

    it("receives the same one each time the Person arrives", async () => {
      // Two separate browsers, so two separate sessions at the Broker:
      // nothing carries over between the arrivals but the Person.
      const first = await authenticate(client);
      const second = await authenticate(client);

      expect(second.claims.sub).toBe(first.claims.sub);
    });

    it("receives no role and no entitlement, anywhere", async () => {
      const { places } = await everyPlace(client);

      for (const [place, body] of places) {
        for (const claim of AUTHORISATION_CLAIMS) {
          expect(body, `${claim} in ${place}`).not.toHaveProperty(claim);
        }
      }
    });

    it("receives no Profile, anywhere", async () => {
      const { places } = await everyPlace(client);

      for (const [place, body] of places) {
        for (const claim of PROFILE_CLAIMS) {
          expect(body, `${claim} in ${place}`).not.toHaveProperty(claim);
        }
      }
    });

    it("receives nothing about how the Person signed in, anywhere", async () => {
      // Through an Identity Source too: only then does Keycloak have an
      // identity_provider it could hand over.
      const arrivals = [
        ["with a Local Credential", {}],
        [
          "through an Identity Source",
          arriving(AFFIRMING_SOURCE_A, "merge-verified"),
        ],
      ] as const;

      for (const [how, options] of arrivals) {
        const { places } = await everyPlace(client, options);
        for (const [place, body] of places) {
          for (const claim of SOURCE_CLAIMS) {
            expect(
              body,
              `${claim} in ${place}, arriving ${how}`,
            ).not.toHaveProperty(claim);
          }
        }
      }
    });
  },
);

/**
 * Introspection is a confidential client's, and only for its own tokens: each
 * client is the audience of the access tokens issued to it and of no other's.
 */
describe("a confidential Brokered App introspects its own tokens", () => {
  it("is told the token is active, and whose it is", async () => {
    const { claims, accessToken } = await authenticate(CONFIDENTIAL_CLIENT);

    const { status, body } = await introspect(CONFIDENTIAL_CLIENT, accessToken);

    expect(status).toBe(200);
    expect(body.active).toBe(true);
    expect(body.sub).toBe(claims.sub);
  });

  it("is told nothing about a token issued to another application", async () => {
    const { accessToken } = await authenticate(PUBLIC_CLIENT);

    const { body } = await introspect(CONFIDENTIAL_CLIENT, accessToken);

    expect(body.active).toBe(false);
    expect(body).not.toHaveProperty("sub");
  });
});
