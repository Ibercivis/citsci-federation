import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type Realm, derive, readDeclaration } from "../broker/realm/derive.ts";
import { renderFlowTree } from "../broker/realm/flows.ts";

/**
 * The step that turns the Broker's declaration into the one realm Keycloak
 * imports. It runs inside the image build, so these cases are the only place
 * it is exercised without building one.
 */

const ISSUER = "http://mock.localhost:8090";

const PROFILE = { attributes: [{ name: "email" }] };

const BASE = {
  realm: "citsci",
  clients: [{ clientId: "brokered-app-public" }],
  identityProviders: [],
};

const TESTING = {
  clients: [{ clientId: "misconfigured-client" }],
  users: [{ username: "demo" }],
};

const declaration = (testing: Realm = TESTING) => ({
  base: BASE,
  testing,
  userProfile: PROFILE,
});

describe("deriving the realm Keycloak imports", () => {
  it("builds the base alone in production, with the user profile as its components entry", () => {
    expect(derive("production", declaration())).toEqual({
      realm: "citsci",
      clients: [{ clientId: "brokered-app-public" }],
      identityProviders: [],
      components: {
        "org.keycloak.userprofile.UserProfileProvider": [
          {
            providerId: "declarative-user-profile",
            subComponents: {},
            config: {
              "kc.user.profile.config": ['{"attributes":[{"name":"email"}]}'],
            },
          },
        ],
      },
    });
  });

  it("appends the testing layer's entries to the base's in testing", () => {
    const realm = derive("testing", declaration(), ISSUER);

    expect(realm["clients"]).toEqual([
      { clientId: "brokered-app-public" },
      { clientId: "misconfigured-client" },
    ]);
    expect(realm["users"]).toEqual([{ username: "demo" }]);
    expect(realm["identityProviders"]).toEqual([]);
  });

  it("refuses a mode it does not know, rather than building the base alone", () => {
    expect(() => derive("testng", declaration())).toThrow(
      'Unknown BROKER_MODE "testng": it is "testing" or "production".',
    );
  });

  it("refuses a testing layer that re-declares an entry the base declares", () => {
    const redeclaring = {
      clients: [{ clientId: "brokered-app-public", implicitFlowEnabled: true }],
    };

    expect(() => derive("testing", declaration(redeclaring), ISSUER)).toThrow(
      'The testing layer re-declares clients "brokered-app-public", which the base declares. A layer only adds.',
    );
  });

  it("refuses a testing layer that re-declares an entry known only by its name", () => {
    const base = { ...BASE, clientScopes: [{ name: "voperson_id" }] };
    const redeclaring = { clientScopes: [{ name: "voperson_id" }] };

    expect(() =>
      derive(
        "testing",
        {
          base,
          testing: redeclaring,
          userProfile: PROFILE,
        },
        ISSUER,
      ),
    ).toThrow(
      'The testing layer re-declares clientScopes "voperson_id", which the base declares. A layer only adds.',
    );
  });

  it("writes the Mock Identity Source's issuer into the testing layer's endpoints", () => {
    const withMock = {
      identityProviders: [
        {
          alias: "mock",
          config: {
            issuer: "${MOCK_ISSUER}",
            tokenUrl: "${MOCK_ISSUER}/token",
          },
        },
      ],
    };

    expect(
      derive("testing", declaration(withMock), ISSUER)["identityProviders"],
    ).toEqual([
      {
        alias: "mock",
        config: { issuer: ISSUER, tokenUrl: `${ISSUER}/token` },
      },
    ]);
  });

  it("refuses a testing build without the Mock Identity Source's issuer", () => {
    expect(() => derive("testing", declaration(), "")).toThrow(
      "No MOCK_ISSUER: the testing layer's Mock Identity Sources are reached at it. Declare it in .env.",
    );
  });

  it("builds production without the Mock Identity Source's issuer", () => {
    expect(() => derive("production", declaration(), "")).not.toThrow();
  });

  it("refuses a base that declares components, which the user profile would overwrite", () => {
    const base = {
      ...BASE,
      components: { "org.keycloak.keys.KeyProvider": [] },
    };

    expect(() =>
      derive("production", { base, testing: TESTING, userProfile: PROFILE }),
    ).toThrow(
      'The base declares "components", which derive.ts builds from user-profile.json. Declare a component by changing derive.ts.',
    );
  });

  it("refuses a testing layer that sets a value rather than adding entries", () => {
    expect(() =>
      derive("testing", declaration({ loginWithEmailAllowed: false }), ISSUER),
    ).toThrow(
      'The testing layer sets "loginWithEmailAllowed", which is not a list of entries. A layer only adds.',
    );
  });
});

/** A declaration whose base declares flows, which only these cases and the
 *  real one do. */
const declaringFlows = (authenticationFlows: unknown[]) => ({
  base: { ...BASE, authenticationFlows },
  testing: TESTING,
  userProfile: PROFILE,
});

/** The flow every case below hangs its graph from, since only a top-level one
 *  is reached from nothing. */
const TOP_LEVEL_FLOW = {
  alias: "citsci first broker login",
  topLevel: true,
};

describe("refusing a flow graph Keycloak would import anyway", () => {
  it("refuses a flow holding a subflow no flow declares", () => {
    const typo = declaringFlows([
      {
        ...TOP_LEVEL_FLOW,
        authenticationExecutions: [
          {
            flowAlias: "citsci join the Person holding this adress",
            priority: 10,
          },
        ],
      },
    ]);

    expect(() => derive("production", typo)).toThrow(
      'Flow "citsci first broker login" holds a subflow "citsci join the Person holding this adress", which no flow declares.',
    );
  });

  it("refuses two executions of one flow sharing a priority", () => {
    const tied = declaringFlows([
      {
        ...TOP_LEVEL_FLOW,
        authenticationExecutions: [
          { authenticator: "idp-review-profile", priority: 10 },
          { authenticator: "idp-auto-link", priority: 10 },
        ],
      },
    ]);

    expect(() => derive("production", tied)).toThrow(
      'Flow "citsci first broker login" gives two executions the priority 10, which leaves their order to Keycloak.',
    );
  });

  it("refuses a declared subflow nothing holds, which reads as live", () => {
    const dead = declaringFlows([
      { ...TOP_LEVEL_FLOW, authenticationExecutions: [] },
      { alias: "citsci refuse an unverified address", topLevel: false },
    ]);

    expect(() => derive("production", dead)).toThrow(
      'Flow "citsci refuse an unverified address" is declared and nothing holds it, so it is dead. A subflow is reached from one execution; a flow reached from none is topLevel.',
    );
  });

  it("refuses a subflow two executions hold, whose order is then two orders", () => {
    const twice = declaringFlows([
      {
        ...TOP_LEVEL_FLOW,
        authenticationExecutions: [
          { flowAlias: "citsci refuse an unverified address", priority: 10 },
          { flowAlias: "citsci refuse an unverified address", priority: 20 },
        ],
      },
      { alias: "citsci refuse an unverified address", topLevel: false },
    ]);

    expect(() => derive("production", twice)).toThrow(
      'Flow "citsci refuse an unverified address" is held by 2 executions, and a subflow is reached from one.',
    );
  });

  it("derives the declaration this repository holds", () => {
    expect(() => derive("production", readDeclaration())).not.toThrow();
  });
});

describe("the first broker login flow, drawn", () => {
  it("draws the tree broker/README.md carries", () => {
    const { base } = readDeclaration();
    const root = base["firstBrokerLoginFlow"] as string;

    expect(fencedTree(root)).toBe(renderFlowTree(base, root));
  });
});

/**
 * The fenced block in `broker/README.md` whose first line names the flow. That
 * first line is how the block is found, so the drawing identifies itself and
 * nothing in the prose has to mark it.
 */
function fencedTree(rootAlias: string): string {
  const readme = readFileSync(
    join(import.meta.dirname, "../broker/README.md"),
    "utf8",
  );
  const [drawn, ...also] = [...readme.matchAll(/```text\n([\s\S]*?)```/g)]
    .map((block) => (block[1] ?? "").trimEnd())
    .filter((block) => block.startsWith(`${rootAlias}\n`));
  if (drawn === undefined || also.length > 0) {
    throw new Error(
      `broker/README.md holds ${also.length + (drawn === undefined ? 0 : 1)} fenced blocks beginning "${rootAlias}", and the case below compares one.`,
    );
  }
  return drawn;
}
