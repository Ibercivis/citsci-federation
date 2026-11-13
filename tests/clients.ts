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
 * server-rendered backend that can. They are stand-ins — the real
 * applications register their own, with their own redirect URIs, when they
 * are integrated. No Brokered App's infrastructure is declared here or in
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

/** Every client in the realm, for the cases that must hold for both shapes. */
export const ALL_CLIENTS: ReadonlyArray<[string, Client]> = [
  ["public", PUBLIC_CLIENT],
  ["confidential", CONFIDENTIAL_CLIENT],
];

/** The one Identity the realm declares, so a flow has someone to authenticate. */
export const DEMO_IDENTITY = {
  username: "demo",
  password: "demo",
  email: "demo@example.org",
} as const;
