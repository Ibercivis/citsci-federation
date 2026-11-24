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
 * The stack that is actually up.
 *
 * The Broker-only stack is the default, because that is what CI runs and what
 * most of the suite needs nothing more than.
 *
 * Every profile on, because the composition is a valid project only in the
 * modes that run the mail catcher its applications depend on. Outside them
 * compose refuses to say anything about it, even that nothing is running.
 */
export function runningStack(): Stack {
  const keycloak = compose(
    COMPOSITION,
    "--profile",
    "*",
    "ps",
    "--status",
    "running",
    "--quiet",
    "keycloak",
  ).trim();
  return keycloak ? COMPOSITION : BROKER_ONLY;
}
