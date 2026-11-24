/**
 * The compose stack that is up, as `docker` reports it.
 *
 * Two stacks declare the Broker and they are different compose projects:
 * `pnpm broker:up` runs the Broker alone, `pnpm apps:up` runs it with every
 * Brokered App. A case that has to reach a container, or say how to recreate
 * what it found, asks this module which of the two it is looking at.
 */

import { execFileSync } from "node:child_process";
import { join } from "node:path";

/** This repository's root: where both compose files live, and where compose
 *  is run from so that it reads the `.env` beside them. */
export const ROOT = join(import.meta.dirname, "..");

/**
 * The environment to run `docker` in.
 *
 * Without `COMPOSE_PROFILES`, deliberately. `.env` declares it as
 * `${BROKER_MODE}`, and `broker.ts` loads that file into this process with
 * Node's own loader, which expands nothing — so an inherited literal
 * `${BROKER_MODE}` reaches compose as a profile name, every service gated
 * behind a profile disappears, and the project is refused as invalid because
 * something still depends on one of them. Compose reads `.env` itself, and
 * resolves it properly when nothing in the environment shadows it.
 *
 * Read when `docker` runs rather than when this module loads, because `.env`
 * may be loaded after it.
 */
function dockerEnv(): NodeJS.ProcessEnv {
  const { COMPOSE_PROFILES: _shadowed, ...env } = process.env;
  return env;
}

/** One of the two stacks this repository declares. */
export interface Stack {
  /** The compose files it is declared by, relative to ROOT. */
  files: ReadonlyArray<string>;
  /** The command that throws it away and brings it back as declared. */
  recreate: string;
}

export const BROKER_ONLY: Stack = {
  files: ["compose.yaml"],
  recreate: "pnpm broker:reset",
};

export const COMPOSITION: Stack = {
  files: ["compose.yaml", "compose.apps.yaml"],
  recreate: "pnpm apps:reset",
};

/** Runs `docker` from ROOT and returns what it printed. */
export function docker(...args: string[]): string {
  return execFileSync("docker", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: dockerEnv(),
  });
}

/** Runs `docker compose` against one stack's files. */
export function compose(stack: Stack, ...args: string[]): string {
  return docker(
    "compose",
    ...stack.files.flatMap((file) => ["-f", file]),
    ...args,
  );
}

/**
 * `docker compose` against one stack with every profile on, which is what
 * reading a stack this repository did not start requires: the composition is
 * a valid project only in the modes that run the mail catcher its
 * applications depend on, and outside them compose refuses to say anything
 * about it, even that nothing is running.
 */
function composeInAnyMode(stack: Stack, ...args: string[]): string {
  return compose(stack, "--profile", "*", ...args);
}

/** Whether one service of a stack has a container up now. */
function isRunning(stack: Stack, service: string): boolean {
  return (
    composeInAnyMode(
      stack,
      "ps",
      "--status",
      "running",
      "--quiet",
      service,
    ).trim() !== ""
  );
}

/**
 * The stack that is actually up.
 *
 * The Broker-only stack is the default, because that is what CI runs and what
 * most of the suite needs nothing more than.
 */
export function runningStack(): Stack {
  return isRunning(COMPOSITION, "keycloak") ? COMPOSITION : BROKER_ONLY;
}

/**
 * Runs a script in a service's own container and returns what it printed,
 * which is how a case observes the compose network from a container on it.
 *
 * `exec`, never `run`. A throwaway container of a service that waits on
 * another starts what it waits on, so a `run` against a stack that is down
 * leaves the project behind it — a healthy database and a volume, no realm —
 * under a name that belongs to this repository on the whole machine, where a
 * second checkout cannot tell it from somebody else's (issue #106). An `exec`
 * creates nothing: either the container is there or there is nothing to ask.
 *
 * Which is why the refusal below is worth its lines. A stack that is down is
 * what a developer meets before bringing anything up, and what they need told
 * is the stack and the command that starts it.
 */
export function inContainer(
  stack: Stack,
  service: string,
  script: string,
): string {
  if (!isRunning(stack, service)) {
    throw new Error(
      [
        `No container is running as ${service} in the stack ${stack.files.join(" and ")} declares, so there is nothing on the compose network to ask.`,
        `Bring it up with:  ${stack.recreate}`,
      ].join("\n"),
    );
  }
  return composeInAnyMode(stack, "exec", "-T", service, "sh", "-c", script);
}
