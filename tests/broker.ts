/**
 * The only two things a Federated App is allowed to know about the Broker: a
 * discovery URL and a client id. This module holds no more than that, and it
 * reads the first of the two from configuration rather than spelling it out,
 * because the issuer differs per environment (ADR-0001).
 */

import { join } from "node:path";

const ENV_FILE = join(import.meta.dirname, "..", ".env");

/**
 * The configured issuer.
 *
 * Read from the one place that declares it, and used as the whole string it
 * is: nothing here concatenates a hostname with a realm name to arrive at it,
 * and nothing persists it (ADR-0001). A Federated App validating a token does
 * exactly the same — it compares `iss` against the value it was configured
 * with, and needs nothing stored to do it.
 */
export const ISSUER = readIssuer();

function readIssuer(): string {
  if (!process.env.BROKER_ISSUER) process.loadEnvFile(ENV_FILE);
  const issuer = process.env.BROKER_ISSUER;
  if (!issuer) {
    throw new Error(
      `No BROKER_ISSUER in the environment and none declared in ${ENV_FILE}. ` +
        "The issuer is configuration (ADR-0001); there is no default to fall " +
        "back to, because a guessed issuer is the one thing a Federated App " +
        "cannot be lied to about.",
    );
  }
  return issuer;
}

/** Discovery, at the one path the specification puts it at. */
export const DISCOVERY_URL = `${ISSUER}/.well-known/openid-configuration`;

export interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

const NOT_RUNNING = [
  `The Broker is not answering at ${ISSUER}.`,
  "Start it with:  pnpm broker:up",
  "This suite never skips when the Broker is down: a silent skip reports",
  "green for behaviour that was never exercised.",
].join("\n");

/** Reads the discovery document, failing loudly when the Broker is down. */
export async function fetchDiscovery(): Promise<Discovery> {
  let response: Response;
  try {
    response = await fetch(DISCOVERY_URL);
  } catch (cause) {
    throw new Error(NOT_RUNNING, { cause });
  }
  if (!response.ok) {
    throw new Error(
      `${NOT_RUNNING}\n\nIt answered HTTP ${response.status} at ${DISCOVERY_URL}.\n` +
        "A 404 here usually means BROKER_ISSUER names a realm this " +
        "repository does not declare.",
    );
  }
  return (await response.json()) as Discovery;
}
