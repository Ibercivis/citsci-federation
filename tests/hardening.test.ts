import { describe, expect, it } from "vitest";
import { CLIENT_TYPES } from "./clients.ts";
import { attempt, createPkce } from "./brokered-app.ts";

/**
 * The flows the pilot refuses, refused rather than merely unused: a client
 * registered carelessly tomorrow must not be able to switch one back on.
 *
 * Every case reads what a Brokered App receives — where the Broker turned the
 * request away and the error it gave — and nothing of how the Broker is
 * configured to do it. A test that read the configuration would keep passing
 * with another provider that refuses nothing.
 */
describe.each(CLIENT_TYPES)(
  "the Broker refuses an unsafe request from the %s client",
  (_shape, client) => {
    it("refuses an authorization request that carries no nonce", async () => {
      const result = await attempt(client, {
        pkce: createPkce("S256"),
        nonce: null,
      });

      expect(result).toEqual({
        outcome: "refused-at-authorization",
        error: "invalid_request",
      });
    });
  },
);
