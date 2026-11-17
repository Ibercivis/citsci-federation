import { describe, expect, it } from "vitest";
import { CONFIDENTIAL_CLIENT } from "./clients.ts";
import {
  authenticate,
  introspect,
  linkTextsOn,
  userinfo,
  verifyAccessToken,
} from "./brokered-app.ts";
import {
  LABORATORY_IDENTITIES,
  LABORATORY_SOURCE,
  type LaboratoryIdentity,
  signInAtLaboratory,
} from "./laboratory-source.ts";

/**
 * The Laboratory Identity Source: an Identity Source this repository declares
 * and runs itself, so that what a source says about an address can be decided
 * by hand. Google and GitHub cannot be driven from a test, and the cases that
 * hold ADR-0004 up need an Identity to arrive later, through another source,
 * saying exactly what the case requires about its address.
 *
 * Asserted at two seams. Through the Broker, only as a Brokered App sees it:
 * a sign-in that went through the source, and what came back. And at the
 * source's own, because the Broker passes on its own claims and never the
 * source's, so what the source says can only be read from the source.
 */

const PERSON_IDENTIFIER =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@ibercivis\.es$/;

const arrivingAs = (identity: LaboratoryIdentity) => ({
  as: {
    through: LABORATORY_SOURCE.name,
    username: identity,
    password: LABORATORY_IDENTITIES[identity].password,
  },
});

describe("a Person arriving through the Laboratory Identity Source", () => {
  it("reaches a Brokered App with valid tokens and a Person Identifier", async () => {
    const { claims } = await authenticate(
      CONFIDENTIAL_CLIENT,
      arrivingAs("lab-verified"),
    );

    expect(claims.sub).toMatch(PERSON_IDENTIFIER);
    expect(claims.voperson_id).toBe(claims.sub);
  });

  it("is the same Person each time they arrive", async () => {
    // Two browsers, so two sessions at the Broker and two at the source:
    // nothing carries over between the arrivals but the Identity.
    const first = await authenticate(
      CONFIDENTIAL_CLIENT,
      arrivingAs("lab-verified"),
    );
    const second = await authenticate(
      CONFIDENTIAL_CLIENT,
      arrivingAs("lab-verified"),
    );

    expect(second.claims.sub).toBe(first.claims.sub);
  });

  it("is never known to a Brokered App by the source's own identifier", async () => {
    // The source knows this Identity as its username; a Brokered App must
    // never see that, anywhere, or it would key data against one Identity
    // instead of against the Person (ADR-0002).
    const sourceSub = "lab-verified";
    const { claims, accessToken } = await authenticate(
      CONFIDENTIAL_CLIENT,
      arrivingAs(sourceSub),
    );
    const places: Array<[string, unknown]> = [
      ["the ID token", claims],
      [
        "the access token",
        await verifyAccessToken(accessToken, CONFIDENTIAL_CLIENT),
      ],
      ["the userinfo response", (await userinfo(accessToken)).body],
      [
        "the introspection response",
        (await introspect(CONFIDENTIAL_CLIENT, accessToken)).body,
      ],
    ];

    for (const [place, body] of places) {
      expect(JSON.stringify(body), place).not.toContain(sourceSub);
    }
  });
});

describe("the Laboratory Identity Source on the Broker's sign-in page", () => {
  it("tells a Person it is not a launch source", async () => {
    const { asked } = await authenticate(CONFIDENTIAL_CLIENT);
    const signInPage = asked.find((page) => page.kind === "sign-in");

    const offered = linkTextsOn(signInPage?.html ?? "").filter((text) =>
      /laborator/i.test(text),
    );

    expect(offered).toHaveLength(1);
    expect(offered[0]).toMatch(/not for launch/i);
  });
});

/**
 * The source held to its own declaration, at its own seam: what it says about
 * an address is decided per Identity, and separately for the ID token and for
 * userinfo. The case that checks the reported `trustEmail` advisory needs the
 * two to disagree, and a source that quietly said the same thing in both would
 * let that case pass without ever staging what it is about.
 */
describe("the Laboratory Identity Source says what it is told to", () => {
  it("can present an address as unverified", async () => {
    const { idToken, userinfo: fromUserinfo } =
      await signInAtLaboratory("lab-unverified");

    for (const claims of [idToken, fromUserinfo]) {
      expect(claims).toMatchObject({
        email: "shared@laboratory.test",
        email_verified: false,
      });
    }
  });

  it("can say one thing about an address in the ID token and another in userinfo", async () => {
    const { idToken, userinfo: fromUserinfo } =
      await signInAtLaboratory("lab-split");

    expect(idToken).toMatchObject({
      email: "split@laboratory.test",
      email_verified: true,
    });
    expect(fromUserinfo).toMatchObject({
      email: "shared@laboratory.test",
      email_verified: false,
    });
  });
});
