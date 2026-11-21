import { describe, expect, it } from "vitest";
import {
  CONFIDENTIAL_CLIENT,
  EVERY_REGISTERED_CLIENT,
  MISCONFIGURED_CLIENT,
  PUBLIC_CLIENT,
} from "./clients.ts";
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

    it("refuses to redeem a code with a verifier that does not match the challenge", async () => {
      // The code was issued, so the Person signed in; it is the redemption
      // that proves whoever holds the code is whoever asked for it.
      const result = await attempt(client, {
        pkce: createPkce("S256"),
        verifier: createPkce("S256").verifier,
      });

      expect(result).toEqual({
        outcome: "refused-at-token",
        status: 400,
        error: "invalid_grant",
      });
    });

    it("refuses to redeem a code with no verifier at all", async () => {
      // Whoever intercepted a code has no verifier, so they send none. A
      // Broker that checks a verifier only when one is offered has made PKCE
      // optional at the token endpoint.
      const result = await attempt(client, {
        pkce: createPkce("S256"),
        verifier: null,
      });

      expect(result).toEqual({
        outcome: "refused-at-token",
        status: 400,
        error: "invalid_grant",
      });
    });

    // Every response type that hands a token to the browser at the
    // authorization endpoint, where it lands in a URL: the implicit ones, and
    // the hybrid ones. `code id_token` is here although it returns no access
    // token, because the pilot allows the code flow and nothing beside it.
    it.each([
      "token",
      "id_token",
      "id_token token",
      "code token",
      "code id_token",
      "code id_token token",
    ])("refuses response_type=%s", async (responseType) => {
      const result = await attempt(client, {
        pkce: createPkce("S256"),
        params: { response_type: responseType },
      });

      // Either code is a refusal, and which one arrives says only which of
      // the Broker's checks caught the request first: a client that does not
      // allow the flow is `unauthorized_client`, and the realm's rule against
      // it is `invalid_request`. What matters is that an error came back and
      // a token did not.
      expect(result).toEqual({
        outcome: "refused-at-authorization",
        error: expect.stringMatching(/^(unauthorized_client|invalid_request)$/),
      });
    });
  },
);

describe("the Broker holds a public Brokered App to a nonce", () => {
  // A nonce is copied into the id_token, and the application compares it with
  // what it stored. That binding is worth having where the id_token reaches a
  // browser, which is what a public client is: no secret to hold, so the
  // tokens are handled where a script can see them.
  //
  // The misconfigured client is public too, and it is the one whose refusal
  // can only come from the realm's policy.
  it.each([
    ["public", PUBLIC_CLIENT],
    ["misconfigured", MISCONFIGURED_CLIENT],
  ])(
    "refuses the %s client an authorization request with no nonce",
    async (_shape, client) => {
      const result = await attempt(client, {
        pkce: createPkce("S256"),
        nonce: null,
      });

      expect(result).toEqual({
        outcome: "refused-at-authorization",
        error: "invalid_request",
      });
    },
  );
});

describe("the Broker takes a confidential Brokered App as the libraries write it", () => {
  // The other half of hardening, and the half a refusal cannot show: that
  // what is refused is unsafe requests and not ordinary ones.
  //
  // This is the request a mainstream library sends — `state`, PKCE S256, the
  // scopes the client was granted, and no nonce, because no release of
  // django-allauth sends one for OpenID Connect and it offers no hook that
  // would check one. A confidential client fetches the id_token itself from
  // the token endpoint, over a channel no browser is on, so there is nothing
  // for a nonce to bind; `state`, which the library does send and does verify,
  // binds the response to the session (ADR-0016).
  //
  // Without this case, tightening the realm would lock out every Django
  // Brokered App and nothing here would say so until somebody tried to
  // integrate one. That is how `issue #104` was found.
  //
  // Geonity (`issue #31`) sends this request too: its web app asks for the
  // code and its API redeems it, but the Broker cannot tell the halves apart.
  it("authenticates a code flow that carries no nonce", async () => {
    const result = await attempt(CONFIDENTIAL_CLIENT, {
      pkce: createPkce("S256"),
      nonce: null,
      params: { scope: "openid email" },
    });

    expect(result).toMatchObject({ outcome: "authenticated" });
    if (result.outcome !== "authenticated") return;
    expect(result.claims).toHaveProperty("email");
  });
});

describe("the Broker refuses to redeem a confidential Brokered App's code without its secret", () => {
  // The secret is what makes a confidential client confidential. A code it
  // obtained is redeemed only by the client proving it holds the secret, so a
  // code intercepted on its way back to the application is worthless.
  const { secret: _secret, ...unauthenticated } = CONFIDENTIAL_CLIENT;

  // RFC 6749 names a failed client authentication `invalid_client`; this
  // provider answers `unauthorized_client`. Either is the refusal.
  const clientNotAuthenticated = {
    outcome: "refused-at-token",
    status: 401,
    error: expect.stringMatching(/^(invalid_client|unauthorized_client)$/),
  };

  it("refuses a redemption that carries no secret", async () => {
    const result = await attempt(unauthenticated, { pkce: createPkce("S256") });

    expect(result).toEqual(clientNotAuthenticated);
  });

  it("refuses a redemption that carries the wrong secret", async () => {
    const result = await attempt(
      { ...CONFIDENTIAL_CLIENT, secret: "not-the-secret" },
      { pkce: createPkce("S256") },
    );

    expect(result).toEqual(clientNotAuthenticated);
  });
});
