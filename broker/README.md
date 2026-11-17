# The Broker's OpenID provider

Keycloak at a pinned version with one extension of ours, the Person
Identifier mapper, behind the reverse proxy `compose.yaml` puts in front of
it, and configured entirely by `realm-citsci.json`. `Dockerfile` builds the
two into one image.

```sh
pnpm broker:up      # docker compose up -d --wait --build
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
configuration, and the image built from this directory the whole of the code.

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

That is also why the earlier effort's `realm-config.test.ts` was not carried
over. It read this declaration back and asserted its shape. Almost everything
it asserted is shown at seam 1 instead, by driving the Broker the way a
Brokered App does, and the three prohibitions it existed to guard — no
protocol mappers, no user attributes in the provider, no Admin API — were
repealed on purpose by ADR-0002.

### The Person Identifier: the user id, scoped

Every Person is known to every Brokered App as `<uuid>@ibercivis.es`, in `sub`
and in `voperson_id`, in the ID token, the access token, userinfo and
introspection (ADR-0002).

The UUID is Keycloak's own user id. Keycloak mints it at random when a Person
is created, whichever way they arrive, keeps it, and never hands it to anyone
else, which is exactly what the identifier has to be. So nothing is minted and
nothing is stored for it: the `oidc-person-identifier-mapper` in
`person-identifier/` adds the scope to the user id, and that is all it does. A
way of arriving added later — a new Identity Source, registration — gets an
identifier without having to remember to make one.

The scope is configuration, `person.identifier.scope` on each mapper. A mapper
declared without one refuses to issue the token, because a bare UUID is the
shape ADR-0002 rejects and nothing downstream could tell it was wrong. The
mapper runs after Keycloak's own subject mapper, so the `sub` it writes is the
one that leaves.

**Keycloak accepts a realm that names a mapper it does not have, and says
nothing.** The tokens then go out with the bare user id. The cases in
`tests/person-identifier.test.ts` are what notice, and they say so.

### Mappers on each client, not in a shared scope

Each client declares its own two Person Identifier mappers. A client scope
shared by every client would be tidier, but declaring any client scope in the
realm file makes Keycloak skip creating its built-in ones (`basic`, `email`,
`acr`, `web-origins`) — it logs a warning and carries on — so a shared scope
would mean declaring all of those by hand as well. Registering a Brokered App
is therefore three mappers in its client, beside its redirect URIs: the two
Person Identifier mappers and the audience below.

### An audience per client

Each client puts its own id in the `aud` of its access tokens. Keycloak
normally takes an access token's audience from the `roles` scope, which this
realm removes, and this version refuses to introspect a token for a client
that is not in its audience. Without the mapper, introspection answers
`active: false` to every token.

Because the audience is per client, a client is the audience of its own tokens
and of nobody else's: it can introspect what was issued to it, and learns
nothing about what was issued to another application.

### Two clients, one for each shape a Brokered App comes in

A public client for a single-page application, which cannot hold a secret, and
a confidential one for a server-rendered backend, which can. Both are
stand-ins: the real applications register their own, with their own redirect
URIs, when they are integrated. The redirect URIs here are development
guesses, and the confidential one follows the callback shape django-allauth
serves, because the applications of the pilot are Django.

No Brokered App's infrastructure is declared anywhere in this repository —
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

### Names are optional

Keycloak's default user profile requires a first and a last name, and stops a
Person arriving through an Identity Source for the first time on a page asking
for them. A name is **Profile**, so the realm declares the user profile with
both attributes optional. They are kept rather than removed: whether the
Broker should hold a name a source sends at all is a question for the first
source that sends one (#28).

### Development credentials in the file

Every credential here is a development constant on purpose. This stack is
meant to be destroyed and recreated, and a secret worth protecting has no
business being reproducible from a file in a public repository. Real secrets
are referenced, never declared.
