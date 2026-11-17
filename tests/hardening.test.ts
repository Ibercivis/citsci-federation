import { describe, expect, it } from "vitest";
import { EVERY_REGISTERED_CLIENT } from "./clients.ts";
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
describe.each(EVERY_REGISTERED_CLIENT)(
  "the Broker refuses an unsafe request from the %s client",
  (_shape, client) => {
    it("refuses an authorization request that offers no PKCE", async () => {
      const result = await attempt(client, { pkce: null });

      expect(result).toEqual({
        outcome: "refused-at-authorization",
        error: "invalid_request",
      });
    });

    it("refuses a PKCE challenge sent with a method it does not define", async () => {
      const { challenge } = createPkce("S256");
      const result = await attempt(client, {
        pkce: null,
        params: { code_challenge: challenge, code_challenge_method: "S512" },
      });

      expect(result).toEqual({
        outcome: "refused-at-authorization",
        error: "invalid_request",
      });
    });

    it("refuses a PKCE challenge sent with the plain method", async () => {
      // `plain` sends the verifier itself as the challenge, so anyone who
      // reads the authorization request can redeem the code.
      const result = await attempt(client, { pkce: createPkce("plain") });

      expect(result).toEqual({
        outcome: "refused-at-authorization",
        error: "invalid_request",
      });
    });

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
