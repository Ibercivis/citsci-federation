import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { derive, readDeclaration } from "../broker/realm/derive.ts";
import { configured } from "./broker.ts";
import {
  BROKER_ONLY,
  COMPOSITION,
  ROOT,
  type Stack,
  compose,
  docker,
  inContainer,
  runningStack,
} from "./stack.ts";

/**
 * Seam 2: the stack being exercised is the one this repository declares.
 *
 * Every other case in the suite trusts that, and none of them can see it. It
 * has already failed once: an experiment brought up as an override borrowed
 * this project's name and outlived the session, and the stack spent hours
 * configured by a file in a directory that gets recycled. That one was
 * harmless; the next one decides whether a case passes.
 *
 * So nothing here asserts the Broker's behaviour. It compares what compose
 * says is running with what compose reads from this repository now, and every
 * failure says how to bring the declared stack back — which is what the last
 * describe holds `tests/stack.ts` itself to.
 */

const STACK: Stack = runningStack();

/** What compose stamps on every container it starts. */
interface Container {
  name: string;
  service: string;
  configFiles: string;
  workingDir: string;
  configHash: string;
  /** The version the image says it carries. Compose adds no such label: it
   *  comes down from the base image, which is the thing that was pinned. */
  imageVersion: string;
}

/** The project the declared stack's files name. An override that borrows the
 *  name lands its containers here, whichever files it was started from. */
function projectName(): string {
  return (
    JSON.parse(compose(STACK, "config", "--format", "json")) as {
      name: string;
    }
  ).name;
}

/** Every long-running container of that project. `docker compose run` leaves
 *  one-off containers behind it when it is interrupted, and those are no part
 *  of what is declared. */
function containersOf(project: string): Container[] {
  const ids = docker(
    "ps",
    "--quiet",
    "--filter",
    `label=com.docker.compose.project=${project}`,
    "--filter",
    "label=com.docker.compose.oneoff=False",
  )
    .split("\n")
    .filter(Boolean);
  if (ids.length === 0) return [];
  const inspected = JSON.parse(docker("inspect", ...ids)) as ReadonlyArray<{
    Name: string;
    Config: { Labels: Record<string, string> };
  }>;
  return inspected.map(({ Name, Config: { Labels: labels } }) => ({
    name: Name.replace(/^\//, ""),
    service: labels["com.docker.compose.service"] ?? "",
    configFiles: labels["com.docker.compose.project.config_files"] ?? "",
    workingDir: labels["com.docker.compose.project.working_dir"] ?? "",
    configHash: labels["com.docker.compose.config-hash"] ?? "",
    imageVersion: labels["org.opencontainers.image.version"] ?? "",
  }));
}

/** Each declared service's configuration hash, as compose computes it from
 *  the files and `.env` today, for the services this mode starts. */
function declaredHashes(): Record<string, string> {
  return Object.fromEntries(
    compose(STACK, "config", "--hash", "*")
      .split("\n")
      .filter(Boolean)
      .map((line) => line.split(" ") as [string, string]),
  );
}

const RECREATE = `Recreate the declared stack with:  ${STACK.recreate}`;

describe(`the running stack is the one declared by ${STACK.files.join(" and ")}`, () => {
  let running: Container[];
  let declared: Record<string, string>;

  beforeAll(() => {
    running = containersOf(projectName());
    declared = declaredHashes();
  });

  it("was started from this repository's compose files, and no others", () => {
    const ours = STACK.files.map((file) => join(ROOT, file)).join(",");
    const foreign = running
      .filter(
        (container) =>
          container.configFiles !== ours || container.workingDir !== ROOT,
      )
      .map(
        (container) =>
          `${container.name}: started from ${container.configFiles} in ${container.workingDir}`,
      );

    expect(
      foreign,
      `Something other than ${ours} is configuring this stack: an override, or a copy of this repository elsewhere. ${RECREATE}`,
    ).toEqual([]);
  });

  it("runs every service it declares, and nothing else", () => {
    expect(
      running.map((container) => container.service).toSorted(),
      `The services up are not the ones declared for this BROKER_MODE. ${RECREATE}`,
    ).toEqual(Object.keys(declared).toSorted());
  });

  it("runs each service as it is declared today", () => {
    const stale = running
      .filter(
        (container) => container.configHash !== declared[container.service],
      )
      .map((container) => container.service);

    expect(
      stale,
      `These services were started from a configuration that is no longer the declared one: compose.yaml or .env changed since. ${RECREATE}`,
    ).toEqual([]);
  });
});

/** The Keycloak version `broker/Dockerfile` builds the Broker on. */
function pinnedKeycloak(): string {
  const dockerfile = readFileSync(join(ROOT, "broker", "Dockerfile"), "utf8");
  const pin = /^FROM quay\.io\/keycloak\/keycloak:(\S+)$/m.exec(
    dockerfile,
  )?.[1];
  if (!pin) {
    throw new Error(
      "broker/Dockerfile builds on no quay.io/keycloak/keycloak:<version>, so there is no pin to compare the running Broker with.",
    );
  }
  return pin;
}

describe("the Keycloak running", () => {
  it("is the version broker/Dockerfile pins", () => {
    const keycloak = containersOf(projectName()).find(
      (container) => container.service === "keycloak",
    );

    expect(
      keycloak?.imageVersion,
      `The Broker runs a Keycloak other than the one broker/Dockerfile pins: an image built before the pin moved. ${RECREATE}`,
    ).toBe(pinnedKeycloak());
  });
});

/**
 * The realm running is the one `broker/realm/` declares for this mode, and so
 * is everything in it that only a reset brings back — the password policy
 * first among them. Seam 1 shows that policy at work; this is what says the
 * Broker it was shown on holds the declaration as it stands.
 *
 * Two steps stand between the two, and either can be left behind. The image
 * carries the realm derived when it was built, so an edit to `broker/realm/`
 * reaches it only through a build. The database keeps the realm it was first
 * given, because `--import-realm` skips a realm that already exists, so a
 * new image or a new `.env` reaches it only through a reset.
 */
describe("the realm running", () => {
  const MODE = configured("BROKER_MODE");
  const declared = derive(
    MODE,
    readDeclaration(),
    MODE === "testing" ? configured("MOCK_IDENTITY_SOURCE_ISSUER") : "",
  );

  it("is what the image carries, derived from broker/realm/ as it stands", () => {
    const carried: unknown = JSON.parse(
      compose(
        STACK,
        "exec",
        "-T",
        "keycloak",
        "cat",
        "/opt/keycloak/data/import/realm-citsci.json",
      ),
    );

    expect(
      carried,
      `The Broker's image carries a realm derived from an earlier broker/realm/, or for another BROKER_MODE. ${RECREATE}`,
    ).toEqual(declared);
  });

  it("was imported by the Keycloak container running now", () => {
    // Keycloak says so once per import, and says nothing of the kind when it
    // finds the realm already in the database. A container recreated over
    // the same volume — a new image, a changed `.env` — finds it there.
    const realm = `Realm '${String(declared["realm"])}'`;
    const verdicts = compose(STACK, "logs", "--no-log-prefix", "keycloak")
      .split("\n")
      .filter((line) => line.includes(realm))
      .map((line) => line.slice(line.indexOf(realm)));

    expect(
      verdicts,
      `The realm in the database was imported by an earlier container, from an image or a .env that may no longer be the declared one, and --import-realm does not replace it. ${RECREATE}`,
    ).toContain(`${realm} imported`);
  });
});

/**
 * What a case gets when it has to observe the compose network from a
 * container on it. `tests/stack.ts` says why asking a stack that is down has
 * to create nothing; this is what holds it to saying so instead (issue #106).
 */
describe("a shell inside a stack's container", () => {
  /** The stack that is not up: one proxy, one port 8080 between them, so
   *  whichever of the two `runningStack()` did not pick has nothing running.
   *  With neither up it picks the Broker-only one anyway, which leaves this
   *  case asking after the composition — down either way. */
  const NOT_UP = STACK === COMPOSITION ? BROKER_ONLY : COMPOSITION;

  it("refuses a stack that is down, naming the command that brings it back", () => {
    expect(() => inContainer(NOT_UP, "keycloak", "echo reached")).toThrow(
      NOT_UP.recreate,
    );
  });
});
