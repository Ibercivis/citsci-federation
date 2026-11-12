# The Broker's OpenID provider

Keycloak at a pinned version, behind the reverse proxy `compose.yaml` puts in
front of it, configured entirely by `realm-citsci.json`.

```sh
pnpm broker:up      # docker compose up -d --wait
pnpm test           # drives the real protocol against it
pnpm broker:reset   # throws the realm away and applies it again from the file
pnpm broker:down    # and removes the volume
```

Discovery: `$BROKER_ISSUER/.well-known/openid-configuration`, where
`BROKER_ISSUER` is declared in `.env` and nowhere else (ADR-0001). The
hostname means the same thing to a browser and to a container on the compose
network, and `.env` says why.

The one Identity the realm declares: `demo` / `demo`.

Admin console: under the same origin, at `/admin` (`admin` / `admin`) — **for
looking, not for changing.** A change made there is configuration no reviewer
can see, and `pnpm broker:reset` throws it away. Anything that needs to change
belongs in the realm file.

## The realm is applied from the file, and from nowhere else

`--import-realm` applies `realm-citsci.json` when the realm is not yet in the
database. That is what makes the declaration reproducible rather than merely
versioned: the way to change this Broker is to edit the file and run
`pnpm broker:reset`, which drops the volume and applies it again from scratch.
Nothing in this repository calls the Admin API, so the file is the whole
configuration.

The cost is stated plainly: an edit to the realm file does **not** reach a
stack that is already up. A `reset` is how it lands, and a Broker holding
state worth keeping will need a migration path that this pilot does not have
yet.

**Re-applying the file on every start was considered and rejected.** Keycloak
can be told to import with `--override`, which would make "applied at
start-up" literally true. It would also replace the realm wholesale on every
restart, and the realm is where Persons live: every Person who had signed in
would be deleted, and a Person Identifier that came back after a restart
would be a *different* one for the same human. ADR-0002 promises that a
Person Identifier is never reassigned and never recycled, so an import
strategy that recycles them is not available. Import-if-absent plus an
explicit `reset` keeps the promise and puts the destructive step behind a
command somebody has to type.

## Why the realm looks the way it does

The realm is JSON and JSON carries no comments, so the reasons live here. The
ones worth trusting are the cases in `tests/`, which demonstrate the behaviour
rather than reading the declaration back.

### Two clients, one for each shape a Federated App comes in

A public client for a single-page application, which cannot hold a secret, and
a confidential one for a server-rendered backend, which can. Both are
stand-ins: the real applications register their own, with their own redirect
URIs, when they are integrated. The redirect URIs here are development
guesses, and the confidential one follows the callback shape django-allauth
serves, because the applications of the pilot are Django.

No Federated App's infrastructure is declared anywhere in this repository —
only the clients the Broker knows them by.

### PKCE S256, per client

PKCE is what makes a leaked authorization code worthless, and `plain` sends
the secret in the very request the code leaks from — a ceremony with no
protection. `pkce.code.challenge.method: S256` on each client is what rejects
both `plain` and a request carrying no challenge at all.

It has to be per client, because the realm's discovery document advertises
`plain` in `code_challenge_methods_supported` and that list cannot be trimmed.
So the discovery document is not evidence of what this Broker allows; the
cases that drive a flow and get turned away are.

### Consent required on both clients

`consentRequired: true` is what puts a page in front of a Person naming the
application that is asking. A grant is remembered per application, so they see
it once per application rather than once per session.

Measured against this pinned version: a client that does **not** require
consent ignores a `prompt=consent` request and sends the Person straight back
to the application with no page at all. That is what makes `prompt=consent`
usable as evidence in `tests/consent.test.ts` — the page appearing means this
client requires consent, rather than meaning the parameter was honoured.

### No `profile` client scope, and no `roles`

Keycloak assigns `profile` to every new client, and that scope's mappers put
`name`, `given_name`, `family_name` and `preferred_username` in the ID token.
Those are **Profile**, which is not the Broker's to hold or hand out. So no
client is assigned the scope, as a default or as an option it could ask for.

`roles` is gone for the same kind of reason: authorisation belongs to the
Person on the applications' side of the frontier (ADR-0003), so the Broker has
no roles to hand out and no token of its own carries one.

`email` stays. The email address belongs to the **Identity** — it is how a
Person proves who they are, not something they declare about themselves — and
it is the one key that decides whether a new Identity belongs to an existing
Person (ADR-0004).

### `VERIFY_PROFILE` disabled

Keycloak will not let a Person finish signing in until their first and last
name are filled, because it assumes it owns their Profile. It does not, so the
required action is disabled rather than the Identity being given a name.

### Development credentials in the file

Every credential here is a development constant on purpose. This stack is
meant to be destroyed and recreated, and a secret worth protecting has no
business being reproducible from a file in a public repository. Real secrets
are referenced, never declared.
