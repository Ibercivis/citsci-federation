# Citizen Science Federation

The **Broker**: one place where a **Person** proves who they are, which every
**Brokered App** delegates to. A Person signs in through an **Identity
Source** and every application recognises them by a single **Person
Identifier**, without holding a password of its own.

- What it is for, and what it does not do: [`docs/specs/spec-shared-identification-pilot.md`](docs/specs/spec-shared-identification-pilot.md)
- The decisions, and what they cost: [`docs/adr/`](docs/adr/)
- The words, used in one sense each: [`GLOSSARY.md`](GLOSSARY.md)

## Running the Broker

Requires Docker, and Node with pnpm for the checks and the test suite.

```sh
pnpm install
pnpm broker:up      # Keycloak, its PostgreSQL and the reverse proxy in front
pnpm test           # drives the real OIDC protocol against it
pnpm broker:down    # and removes the volume
```

The Broker then answers at the issuer declared in [`.env`](.env), realm path
included. Nothing else is needed: the realm, the clients and the one demo
Identity are declared in this repository and applied at start-up.

## What is declared here, and what is not

`compose.yaml` declares the Broker and nothing else: the reverse proxy, the
OpenID provider behind it, and that provider's own database. The proxy is in
front **in every environment, including local** — the reason is parity of
form, since the cookie, TLS, redirect-URI and CORS failures that depend on
deployment shape otherwise appear for the first time in production (ADR-0001).

No Brokered App's infrastructure is declared here. A Brokered App's
development environment lives in its own repository, and what this one holds
about an application is the client the Broker knows it by.

The Keycloak version is **pinned**, because a security property of the design
rests on how it treats a verified email address (ADR-0004). It does not move
on its own.

## How this is tested

Over HTTP, exactly as a Brokered App would: a stand-in app in
[`tests/brokered-app.ts`](tests/brokered-app.ts) generates a PKCE pair,
builds the authorization request, carries cookies through the Broker's own
pages, signs in, grants consent, redeems the code and verifies the ID token
against keys fetched from discovery.

No case reads Keycloak's database, calls its Admin API to assert, or asserts
the shape of its configuration as a substitute for behaviour. The test applied
to the tests: **they would still be meaningful if Keycloak were replaced by
another provider.**

The suite never skips when the Broker is down. A silent skip reports green for
behaviour that was never exercised.

## Licence

The code is licensed under the [EUPL-1.2](LICENSE), and the documentation —
the ADRs, the spec, the glossary, the notes and every Markdown file — under
[CC BY 4.0](LICENSES/CC-BY-4.0.txt). [`REUSE.toml`](REUSE.toml) says which
covers each file, and `pnpm check` runs `reuse lint` against it.

The OpenID Federation plugin for Keycloak, once it exists, is licensed under
Apache-2.0 and carries its own licence in its own directory, so that it can
become a project of its own (ADR-0013).
