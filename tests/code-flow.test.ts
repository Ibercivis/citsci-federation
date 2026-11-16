import { describe, expect, it } from "vitest";
import { ALL_CLIENTS } from "./clients.ts";
import { authenticate } from "./brokered-app.ts";
import { ISSUER } from "./broker.ts";

/**
 * The tracer: a Person arrives through the Broker and a Brokered App
 * receives valid tokens. Everything the pilot adds later rests on this.
 *
 * Both shapes of client run the same flow, because a pilot that works only
 * for a single-page application or only for a server-rendered backend serves
 * half the applications it exists for.
 */
describe.each(ALL_CLIENTS)(
  "a %s Brokered App authenticates a Person at the Broker",
  (_shape, client) => {
    it("completes an authorization code flow with PKCE S256", async () => {
      const { claims } = await authenticate(client);

      expect(claims.sub).toEqual(expect.any(String));
      expect(claims.aud).toBe(client.id);
    });

    it("issues tokens whose iss is the configured issuer", async () => {
      // The token verified against keys fetched from the issuer's own
      // discovery document, and against the issuer string this repository
      // configures — which is all a Brokered App holds (ADR-0001). It
      // persisted nothing to get here.
      const { claims } = await authenticate(client);

      expect(claims.iss).toBe(ISSUER);
    });
  },
);
