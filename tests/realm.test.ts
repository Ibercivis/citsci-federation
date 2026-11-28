import { describe, expect, it } from "vitest";
import { asImported, declaredCredentials, declaredSource } from "./realm.ts";
import base from "../broker/realm/base.json" with { type: "json" };
import testing from "../broker/realm/testing.json" with { type: "json" };

/**
 * How the readers in `realm.ts` refuse an alias the realm declares nothing
 * under. The alias below is this file's own: a case about a refusal has
 * nothing to learn from the realm's aliases, and would go stale with them.
 */

const UNDECLARED = "no-identity-source-is-declared-under-this";

describe("an alias the realm declares no Identity Source under", () => {
  it("is refused in the same words by either reader", () => {
    const refusal = new Error(
      `The realm declares no Identity Source under ${UNDECLARED}: either ` +
        "that alias moved, or the source was never added to the realm.",
    );

    expect(() => declaredSource(UNDECLARED)).toThrow(refusal);
    expect(() => declaredCredentials(UNDECLARED)).toThrow(refusal);
  });
});

/**
 * Keycloak's own columns, which the realm file can overrun without saying so.
 *
 * `clients.description` is `varchar(255)`. A longer one does not import: the
 * whole realm fails with `value too long for type character varying(255)`,
 * naming no client and no field, and the Broker then does not start at all —
 * so every case in every other file fails for a reason none of them mentions.
 * A client added with 335 characters of description is what wrote this.
 *
 * Read as imported, because a `${NAME}` is substituted before Keycloak sees it.
 */

const KEYCLOAK_VARCHAR = 255;

const declaredClients = [base, testing].flatMap((layer) =>
  (layer.clients ?? []).map((client) => ({
    clientId: asImported(client.clientId),
    name: asImported(client.name ?? ""),
    description: asImported(client.description ?? ""),
  })),
);

describe("every client the realm declares", () => {
  it.each(declaredClients)(
    "fits Keycloak's columns: $clientId",
    ({ clientId, name, description }) => {
      const tooLong = Object.entries({ clientId, name, description })
        .filter(([, value]) => value.length > KEYCLOAK_VARCHAR)
        .map(([field, value]) => `${field} is ${value.length} characters`);

      expect(tooLong).toEqual([]);
    },
  );
});
