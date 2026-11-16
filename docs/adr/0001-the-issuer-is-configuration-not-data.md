# The issuer is configuration, not data

The Broker's `issuer` differs per environment and its final production hostname is not chosen yet, so
the `issuer` is read from configuration, is never persisted in any database, and is never
reconstructed by concatenating parts. This keeps the hostname choice deferrable: changing it later
costs a coordinated configuration change across the Brokered Apps and one forced re-login, not a
data migration.

## Considered Options

The textbook approach — and the one the earlier effort took, keying identities by
`<sub>@<issuer-domain>` — stores the issuer alongside each identity. Rejected because it turns the
issuer into load-bearing user data, which is what makes the hostname irreversible. Someone will
propose it again, because it is the conventional answer.

## Consequences

A reverse proxy sits in front of Keycloak in **every** environment, including local, so that the
`issuer` has the same shape everywhere. The reason is parity of form rather than the string itself:
cookie, TLS, redirect-URI and CORS failures that depend on the shape otherwise appear for the first
time in production.

`/realms/<name>` stays in the path. Stripping it fights Keycloak's multi-realm design, and with this
ADR and ADR-0002 in place it protects nothing that is still at risk.
