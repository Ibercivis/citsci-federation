# The Broker's OpenID provider

Keycloak at a pinned version with two extensions of ours — the Person
Identifier mapper and the Verified Email condition — behind the reverse proxy
`compose.yaml` puts in front of it, and configured entirely by
`realm-citsci.json`. `Dockerfile` builds all three into one image.

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

The one Identity the realm declares: `demo` / `demo`. Its sign-in page also
offers the Mock Identity Source, whose Identities are declared in
`mock-source/mock.json` (password `mock`).

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
A third, `misconfigured-client`, is a testing fixture and not a Brokered
App: `tests/clients.ts` says why.

No Brokered App's infrastructure is declared anywhere in this repository —
only the clients the Broker knows them by.

### Code flow only, for every client

One client policy holds every client in the realm to the code flow, whatever
its own settings say: PKCE with S256 and nothing else, no response type that
hands a token to the browser in a URL, and a `nonce` on every OpenID Connect
request. A setting has to be remembered on every client registered from now
on; a policy does not.

The PKCE setting on each client stays anyway. The realm's discovery document
advertises `plain` in `code_challenge_methods_supported` and that list cannot
be trimmed, so discovery is not evidence of what this Broker allows; the cases
in `tests/hardening.test.ts` that drive a flow and get turned away are.

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
for them. A name is **Profile**, so the user profile is declared with both
attributes optional. They are kept rather than removed: whether the Broker
should hold a name a source sends at all is a question for the first source
that sends one (#28).

It is declared in `user-profile.json`, not in the realm file. The realm format
has no field of its own for a user profile, only a `components` entry whose
value is the whole profile as one escaped JSON string, which nobody can review.
So Keycloak is started with
`--spi-user-profile--declarative-user-profile--config-file` pointing at the
file instead, which makes it the default for every realm that declares none of
its own. That option is read by the provider but not in its advertised list,
so an upgrade could drop it without a word; the cases in
`tests/mock-source.test.ts` are what notice, stopping on "Update Account
Information". #65 replaces it: the step that layers the realm generates the
`components` entry from this file, and the option goes.

### The first broker login flow, and the one rule in it

ADR-0004 joins Identities into one Person automatically, by Verified Email.
Keycloak does the joining: `idp-auto-link`, in a `first broker login` flow of
ours, matches an arriving Identity against the Person holding that address and
asks the Person nothing. The built-in flow asks them to confirm the link
instead, which is the thing ADR-0004 gave up in order to ship.

**That authenticator reads the address and nothing else**, so the
configuration that performs the merge also performs the account takeover
ADR-0004 exists to refuse (issue #75). What refuses it is a conditional
subflow **ahead** of `idp-auto-link`, carrying a condition of ours from
`verified-email/` and then `deny-access-authenticator`.

The condition is ours because **no condition Keycloak ships can see the
arriving claim** — the one that could name such a flag reads a user's
attributes, and where this decision has to be taken there is no user in the
flow at all. The route, and why the alternatives to it were refused, is in
`docs/notes/conditional-subflow-and-brokered-email-verified.md`.

Ahead of `idp-auto-link` and not after it, because nothing is written to
`federated_identity` until the flow completes: a subflow that denies before it
leaves no trace, while one that denies after would be undoing a decision
already taken.

`deny-access-authenticator` is the leaf today. ADR-0004 says the Broker should
instead ask that Person for an address and confirm it by mail, which is
`idp-email-verification` in the same position and SMTP in the composition
(#26). The condition does not change when that happens.

**It is bound at the realm, not per Identity Source.** `firstBrokerLoginFlow`
on the realm is what every source uses, and none of them names a flow of its
own — so a source added later gets this rule without anybody remembering to
attach it. A source that *did* name one would be opting out of ADR-0004, which
is not something to be able to do by omission.

Everything else in the flow is the built-in one's shape, `idp-review-profile`
included, so the only thing ours decides differently is the join. Declaring
these flows does not cost the realm its built-in ones; the note records what
that was measured against.

### The Mock Identity Source

A test Identity Source this repository runs itself (`mock-source/`), so
that what a source says about an address can be decided by hand: per Identity,
and separately for the ID token and for userinfo. Each is declared with a
display name that says it is not for launch, because that name is what a
Person reads on the sign-in page.

**Three of them, over one server.** `federated_identity` holds one link per
source per Person, so a second Identity from the *same* source is refused by
the schema — and ADR-0004 is entirely about what happens when a Person's
second Identity arrives. One source cannot stage either half of it.

- **`mock` affirms nothing**: `trustEmail` off, which is how a source arrives
  whose word on an address the Broker has not been told to trust. Everything
  through it is unverified, whatever its claims say.
- **`mock-affirming-a` and `mock-affirming-b` affirm addresses**:
  `trustEmail` on. Two, so that one Person can hold an Identity from each —
  which is what the merge and the refusal both need. `trustEmail` is set per
  source and never on the realm (ADR-0004).
- **Userinfo is on**, because the reported advisory this source exists to
  stage is about the address being read from userinfo. Being on is not the
  same as being called: `mock-source/README.md` says what else that
  takes.
- **Its endpoints are `${MOCK_ISSUER}/…`**, substituted from the
  environment by the realm import, so the address is declared once, in `.env`.

### Development credentials in the file

Every credential here is a development constant on purpose. This stack is
meant to be destroyed and recreated, and a secret worth protecting has no
business being reproducible from a file in a public repository. Real secrets
are referenced, never declared.
