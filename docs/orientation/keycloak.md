# Orientation — Keycloak against our vocabulary

For anyone meeting the Broker's implementation for the first time. **Why** the realm is declared the
way it is lives in `broker/README.md`, next to the realm file; this page only orients and translates.

## Keycloak is an OIDC server and an OIDC client at the same time

Towards a Brokered App it is the server: it publishes the `issuer`, the endpoints and the public
keys, and it issues the tokens. Towards Google and GitHub it is just another client, signing in with
a client id and a secret of its own. That is why a Brokered App cannot learn which Identity Source
was used — it was not in that second conversation.

You write no authentication code. You declare configuration, and Keycloak exposes standard
endpoints.

## The vocabulary, translated

Keycloak's documentation uses the words `GLOSSARY.md` avoids, so everything you read elsewhere
arrives in the left column. Our words go in the issues, the commits and the code.

| Keycloak says | We say |
|---|---|
| Realm | _(no term)_ the container for everything else; its URL is the `issuer` |
| Client | Brokered App |
| User | Person |
| Identity Provider | Identity Source |
| Federated identity link | Identity Link |
| `sub` | Person Identifier — but not the bare UUID Keycloak ships in it (ADR-0002) |
| Protocol mapper | _(mechanism)_ "put this value into this claim" |
| Authentication flow | _(mechanism)_ the tree of steps a sign-in walks |
| Account Console | the Broker's only user-facing surface: password, email, own Identities |

Two consequences of the table worth saying out loud. A realm is a closed world — nothing inside one
is visible from another, and `master` is for administering Keycloak, not for our things; the pilot
uses one realm. And a Person is created by their first federated sign-in with no password: the
Person Identifier lives in a user attribute, which protocol mappers copy into `sub` and
`voperson_id`.

## The URLs a Brokered App touches

Under `https://<host>/realms/<realm>/`:

```
.well-known/openid-configuration      discovery — the only one configured in the app
protocol/openid-connect/auth          starts the sign-in
protocol/openid-connect/token         exchanges the code
protocol/openid-connect/userinfo      the claims, queried separately
protocol/openid-connect/certs         the JWKS, for verifying signatures
protocol/openid-connect/token/introspect   RFC 7662, confidential clients only
protocol/openid-connect/logout        sign-out
```

In practice an application configures only the first: its OIDC library discovers the rest. That is
why moving the Broker is a configuration change there and not a data migration (ADR-0001).

Outside the realm path sit `/admin` (the console — for looking, not for changing) and the Admin REST
API under `/admin/realms/<realm>/`, which nothing in this repository calls.

## Read next

- `broker/README.md` — the realm, the defaults that had to be broken, and why
- `docs/orientation/pilot-architecture.md` — the shape the realm serves
