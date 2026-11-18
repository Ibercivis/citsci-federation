/**
 * The clients the realm registers. With the discovery URL, this is the whole
 * of what a Brokered App may know about the Broker.
 *
 * A **client** here is the registration the Broker knows an application by,
 * never the application itself: the glossary keeps "Brokered App" for that,
 * and these constants are named for the registration so the two do not blur.
 *
 * Two of them, because the pilot has to serve both shapes a Brokered App
 * comes in: a single-page application that cannot hold a secret, and a
 * server-rendered backend that can. They are stand-ins, declared in the
 * realm's testing layer — the real applications register their own in the
 * base, with their own redirect URIs, when they are integrated. No Brokered App's infrastructure is declared here or in
 * `compose.yaml`.
 */

/** A client as registered in the realm. Confidential clients carry a secret. */
export interface Client {
  id: string;
  /** The name the realm gives it, which is the name a Person is shown when
   *  the Broker asks them to consent. */
  name: string;
  secret?: string;
  redirectUri: string;
}

/** The public shape: a browser application, with PKCE S256 and no secret. */
export const PUBLIC_CLIENT: Client = {
  id: "brokered-app-public",
  name: "Brokered App (public)",
  redirectUri: "http://localhost:3000/auth/callback",
};

/** The confidential shape: a server-rendered backend holding a secret. The
 *  callback is the shape django-allauth serves, which is what the Django
 *  applications of the pilot use. */
export const CONFIDENTIAL_CLIENT: Client = {
  id: "brokered-app-confidential",
  name: "Brokered App (confidential)",
  secret: "brokered-app-confidential-development-secret",
  redirectUri: "http://localhost:8000/accounts/oidc/broker/login/callback/",
};

/** The public and the confidential client, for cases that hold for both. */
export const CLIENT_TYPES: ReadonlyArray<[string, Client]> = [
  ["public", PUBLIC_CLIENT],
  ["confidential", CONFIDENTIAL_CLIENT],
];

/**
 * Not a Brokered App: a client registered carelessly on purpose, with no PKCE
 * method and the implicit flow switched on. Every refusal in
 * `hardening.test.ts` runs against it, and it is the only client there whose
 * refusals come from the realm's policy rather than from its own settings.
 * Drop it from those cases and nothing shows the policy works.
 *
 * It is declared in the testing layer, `broker/realm/testing.json`, so a
 * Broker built for `production` does not have it.
 */
export const MISCONFIGURED_CLIENT: Client = {
  id: "misconfigured-client",
  name: "Misconfigured client",
  redirectUri: "http://localhost:3001/auth/callback",
};

/** Every client the realm registers, for the refusals that must hold whatever
 *  a client's own settings say. */
export const EVERY_REGISTERED_CLIENT: ReadonlyArray<[string, Client]> = [
  ...CLIENT_TYPES,
  ["misconfigured", MISCONFIGURED_CLIENT],
];

/** The one Identity the testing layer declares, so a flow has someone to
 *  authenticate. */
export const DEMO_IDENTITY = {
  username: "demo",
  password: "demo",
  email: "demo@example.org",
} as const;
