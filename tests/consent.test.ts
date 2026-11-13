import { describe, expect, it } from "vitest";
import { ALL_CLIENTS } from "./clients.ts";
import { authenticate } from "./brokered-app.ts";

/**
 * Consent is required on every client, and this is where that is shown rather
 * than declared: the Broker puts a page in front of the Person that names the
 * application asking, and the flow only finishes once they accept it.
 *
 * The request carries `prompt=consent` because the Broker remembers a grant
 * per application: a Person sees the page once per application rather than
 * once per session, so the first flow of a fresh stack would see it and every
 * flow after it would not. `prompt=consent` is the standard way to ask for
 * the question again, and it is not a way of conjuring one — measured against
 * this pinned version, a client that does not require consent answers
 * `prompt=consent` by sending the Person straight back to the application
 * with no page at all. So a consent page here is evidence that this client
 * requires consent.
 */
describe.each(ALL_CLIENTS)(
  "the Broker asks a Person to consent before a %s Brokered App receives anything",
  (_shape, client) => {
    it("shows a consent page naming the application, and completes once accepted", async () => {
      const { asked, claims } = await authenticate(client, {
        params: { prompt: "consent" },
      });

      const consent = asked.find((question) => question.kind === "consent");
      expect(
        consent,
        "The Broker asked for no consent. Consent is what names the " +
          "application to the Person and lists what it will receive; " +
          "without it they hand over an identity to something unnamed.",
      ).toBeDefined();
      expect(consent?.html).toContain(client.name);
      // And the flow still finished, so requiring consent is not a wall: the
      // Person accepted and the application got its tokens.
      expect(claims.sub).toEqual(expect.any(String));
    });
  },
);
