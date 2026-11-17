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
  MOCK_IDENTITIES,
  MOCK_SOURCE,
  MOCK_SOURCES,
  type MockIdentity,
  signInAtMock,
} from "./mock-source.ts";

/**
 * The Mock Identity Source: an Identity Source this repository declares
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

const arrivingAs = (identity: MockIdentity) => ({
  as: {
    through: MOCK_SOURCE.name,
    username: identity,
    password: MOCK_IDENTITIES[identity].password,
  },
});

describe("a Person arriving through the Mock Identity Source", () => {
  it("reaches a Brokered App with valid tokens and a Person Identifier", async () => {
    const { claims } = await authenticate(
      CONFIDENTIAL_CLIENT,
      arrivingAs("mock-verified"),
    );

    expect(claims.sub).toMatch(PERSON_IDENTIFIER);
    expect(claims.voperson_id).toBe(claims.sub);
  });

  it("is the same Person each time they arrive", async () => {
    // Two browsers, so two sessions at the Broker and two at the source:
    // nothing carries over between the arrivals but the Identity.
    const first = await authenticate(
      CONFIDENTIAL_CLIENT,
      arrivingAs("mock-verified"),
    );
    const second = await authenticate(
      CONFIDENTIAL_CLIENT,
      arrivingAs("mock-verified"),
    );

    expect(second.claims.sub).toBe(first.claims.sub);
  });

  it("is never known to a Brokered App by the source's own identifier", async () => {
    // The source knows this Identity as its username; a Brokered App must
    // never see that, anywhere, or it would key data against one Identity
    // instead of against the Person (ADR-0002).
    const sourceSub = "mock-verified";
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

describe("the Mock Identity Source on the Broker's sign-in page", () => {
  it("tells a Person every one of them is not a launch source", async () => {
    // Several, because ADR-0004's merge and its refusal can only be staged
    // across two sources, and one of the three affirms no address at all.
    // Whichever a Person is offered, it has to say so in the name they read:
    // this source vouches for nobody.
    const { asked } = await authenticate(CONFIDENTIAL_CLIENT);
    const signInPage = asked.find((page) => page.kind === "sign-in");

    const offered = linkTextsOn(signInPage?.html ?? "").filter((text) =>
      /mock/i.test(text),
    );

    expect(offered).toHaveLength(Object.keys(MOCK_SOURCES).length);
    for (const name of offered) expect(name).toMatch(/not for launch/i);
  });

  it("offers each of them under the name the mock declares", async () => {
    // The realm file spells these names a second time, because JSON can
    // import nothing. This is what notices when the two drift — a Person
    // choosing a source reads the realm's name, and a case looking for a
    // source by the mock's name would otherwise silently find nothing.
    const { asked } = await authenticate(CONFIDENTIAL_CLIENT);
    const signInPage = asked.find((page) => page.kind === "sign-in");

    const offered = linkTextsOn(signInPage?.html ?? "");

    for (const source of Object.values(MOCK_SOURCES)) {
      expect(offered.some((text) => text.includes(source.name))).toBe(true);
    }
  });
});

/**
 * The source held to its own declaration, at its own seam: what it says about
 * an address is decided per Identity, and separately for the ID token and for
 * userinfo. The case that checks the reported `trustEmail` advisory needs the
 * two to disagree, and a source that quietly said the same thing in both would
 * let that case pass without ever staging what it is about.
 */
describe("the Mock Identity Source says what it is told to", () => {
  it("can present an address as unverified", async () => {
    const { idToken, userinfo: fromUserinfo } =
      await signInAtMock("mock-unverified");

    for (const claims of [idToken, fromUserinfo]) {
      expect(claims).toMatchObject({
        email: "shared@mock.test",
        email_verified: false,
      });
    }
  });

  it("can say one thing about an address in the ID token and another in userinfo", async () => {
    const { idToken, userinfo: fromUserinfo } =
      await signInAtMock("mock-split");

    expect(idToken).toMatchObject({
      email: "split@mock.test",
      email_verified: true,
    });
    expect(fromUserinfo).toMatchObject({
      email: "shared@mock.test",
      email_verified: false,
    });
  });
});
