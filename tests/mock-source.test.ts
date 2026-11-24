import { describe, expect, it } from "vitest";
import { CONFIDENTIAL_CLIENT } from "./clients.ts";
import {
  authenticate,
  everyPlace,
  introspect,
  linkTextsOn,
  userinfo,
  verifyAccessToken,
} from "./brokered-app.ts";
import { PERSON_IDENTIFIER } from "./broker.ts";
import {
  AFFIRMING_SOURCE_A,
  AFFIRMING_SOURCE_B,
  MOCK_SOURCES,
  SCOPE_ASKING_FOR_NAMES,
  type MockIdentity,
  aRelocatingIdentity,
  arriving,
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

/** Through a source whose word on the address is trusted. Through one whose
 *  word is not, the Broker first confirms the address by mail (ADR-0004), and
 *  these cases are about arriving, not about that. */
const arrivingAs = (identity: MockIdentity) =>
  arriving(AFFIRMING_SOURCE_A, identity);

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

describe("a Person arriving through either of two sources", () => {
  it("leaves a Brokered App unable to tell which one they used", async () => {
    // The same Person, through two sources that affirm the address, so the
    // second arrival joins the first. A Brokered App that
    // could tell the two apart would come to depend on it, and adding or
    // removing a source would become its problem.
    const throughA = await everyPlace(
      CONFIDENTIAL_CLIENT,
      arriving(AFFIRMING_SOURCE_A, "either-verified"),
    );
    const throughB = await everyPlace(
      CONFIDENTIAL_CLIENT,
      arriving(AFFIRMING_SOURCE_B, "either-verified"),
    );
    expect(throughB.idToken.sub).toBe(throughA.idToken.sub);

    const address = String(throughA.idToken.email);
    const sourceNames = MOCK_SOURCES.flatMap((source) => [
      source.alias,
      source.name,
    ]);
    for (const [index, [place, body]] of throughA.places.entries()) {
      const [, other] = throughB.places[index] ?? [place, {}];
      expect(Object.keys(other).toSorted(), place).toEqual(
        Object.keys(body).toSorted(),
      );
      for (const seen of [body, other]) {
        // Without the address, wherever it appears: it is the Person's own,
        // the same through both, and `mock` is part of its domain.
        const text = JSON.stringify(seen).replaceAll(address, "");
        for (const name of sourceNames) {
          expect(text, place).not.toContain(name);
        }
      }
    }
  });
});

describe("the Mock Identity Source on the Broker's sign-in page", () => {
  it("tells a Person every one of them is not a launch source", async () => {
    // There are several of them now. Whichever one a Person is offered has to
    // say in the name they read that it vouches for nobody.
    const { asked } = await authenticate(CONFIDENTIAL_CLIENT);
    const signInPage = asked.find((page) => page.kind === "sign-in");

    const offered = linkTextsOn(signInPage?.html ?? "").filter((text) =>
      /mock/i.test(text),
    );

    expect(offered).toHaveLength(MOCK_SOURCES.length);
    for (const name of offered) expect(name).toMatch(/not for launch/i);
  });

  it("offers every source the mock stands behind", async () => {
    // Nothing here guards a second spelling of the names any more: a case reads
    // them from the realm that decides them. What is still worth asserting is
    // that each alias the mock answers for reaches a Person at all — an alias
    // the realm disabled, or never enabled, is a sign-in nobody can start.
    const { asked } = await authenticate(CONFIDENTIAL_CLIENT);
    const signInPage = asked.find((page) => page.kind === "sign-in");

    const offered = linkTextsOn(signInPage?.html ?? "");

    for (const source of MOCK_SOURCES) {
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

  it("puts a name in the ID token when asked for profile, and only then", async () => {
    // Asked for what `mock-affirming-named` asks for, and then for what the
    // other sources ask for. Without the second half a source that always sent
    // names would let every case pass as the named one.
    const named = await signInAtMock(
      "advisory-split-named",
      SCOPE_ASKING_FOR_NAMES,
    );
    const unnamed = await signInAtMock("advisory-split-named");

    expect(named.idToken).toMatchObject({
      name: "Advisory Split",
      preferred_username: "advisory-split",
    });
    expect(named.userinfo).not.toHaveProperty("name");
    expect(unnamed.idToken).not.toHaveProperty("name");
  });

  it("can give an address in userinfo and say nothing about whether it is verified", async () => {
    const { idToken, userinfo: fromUserinfo } =
      await signInAtMock("advisory-silent");

    expect(idToken).toMatchObject({
      email: "advisory@mock.test",
      email_verified: false,
    });
    expect(fromUserinfo).toMatchObject({ email: "advisory@mock.test" });
    expect(fromUserinfo).not.toHaveProperty("email_verified");
  });

  it("can give one Identity another address the next time it signs in", async () => {
    // The same `sub` both times, or the second sign-in is a second Identity
    // and the case about an address changing upstream stages nothing.
    const identity = aRelocatingIdentity();

    const before = await signInAtMock(identity.credentials("before"));
    const after = await signInAtMock(identity.credentials("after"));

    for (const [answer, label] of [
      [before, "before"],
      [after, "after"],
    ] as const) {
      for (const claims of [answer.idToken, answer.userinfo]) {
        expect(claims).toMatchObject({
          sub: identity.subject,
          email: identity.address(label),
          email_verified: true,
        });
      }
    }
    expect(identity.address("after")).not.toBe(identity.address("before"));
  });
});
