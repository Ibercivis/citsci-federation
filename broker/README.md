# The Broker's OpenID provider

Keycloak at a pinned version with two extensions of ours — the Person
Identifier mapper and the Verified Email rules — behind the reverse proxy
`compose.yaml` puts in front of it, and configured entirely by the declaration
in `realm/`. `Dockerfile` builds all three into one image.

```sh
pnpm broker:up      # docker compose up -d --wait --build
pnpm test           # drives the real protocol against it
pnpm broker:reset   # throws the realm away and applies it again from the declaration
pnpm broker:down    # and removes the volume
```

Discovery: `$BROKER_ISSUER/.well-known/openid-configuration`, where
`BROKER_ISSUER` is declared in `.env` and nowhere else (ADR-0001). The
hostname means the same thing to a browser and to a container on the compose
network, and `.env` says why.


In `testing`, the one Identity the realm declares is `demo` / `demo-password`, and its
sign-in page also offers the Mock Identity Sources, whose Identities are
declared in `mock-source/mock.json` (password `mock`). In `production` there
are neither.

Admin console: under the same origin, at `/admin` (`admin` / `admin`) — **for
looking, not for changing.** A change made there is configuration no reviewer
can see, and `pnpm broker:reset` throws it away. Anything that needs to change
belongs in the declaration.

## Two layers, one realm

`realm/base.json` is the Broker anywhere it runs. `realm/testing.json` is
what exists only so that it can be tested. `BROKER_MODE` in `.env` picks one of
two Brokers: `testing` is the base plus the testing layer, with the Mock
Identity Source running, and `production` is the base alone. Anything meant to
be deployed runs `production`.

Keycloak imports one complete realm per file and cannot layer two, so
`realm/derive.ts` does it inside the image build and writes the one file
Keycloak imports. That file exists only in the image, so nobody can edit it by
hand. The same step turns `realm/user-profile.json` into the realm's user
profile.

**A layer only adds.** The testing layer may append entries to the base's
lists. It may not set a value of the base, nor declare an entry under a key the
base already uses: either would make the base mean something different
depending on the mode, and `derive.ts` refuses both. A case that needs a
variant of a base entry declares a new one beside it under its own key, the way
`mock-affirming-a` and `mock-affirming-b` sit beside `mock`.

### Which layer an addition belongs in

Ask whether a real deployment would ship it. Four kinds of thing never
should, and they are the testing layer:

- **A credential anybody can read here**, like the `demo` Identity's password.
- **An Identity Source that vouches for nobody**, like the Mock Identity
  Sources, which say whatever `mock-source/mock.json` tells them to.
- **A client registered so that it can be refused**, like
  `misconfigured-client`.
- **A client standing in for a Brokered App**, like `brokered-app-public` and
  `brokered-app-confidential`: its callback is a development guess. A real
  Brokered App declares its own client in the base, with its exact HTTPS
  callback and its secret as a `${NAME}` placeholder.

Everything else is base, including what was added *for* a case and that the
Broker needs anyway. The first broker login flow arrived with the tests for
ADR-0004, and it is base because it is how every Identity Source joins a
Person.

An entry in the base that refers to an entry in the testing layer is a sign
that one of them is in the wrong layer: the `production` CI job is where that
shows, because the base has to start on its own.

## The realm is applied from the declaration, and from nowhere else

`--import-realm` applies the realm the image carries when the realm is not yet
in the database. That is what makes the declaration reproducible rather than
merely versioned: the way to change this Broker is to edit `realm/` and run
`pnpm broker:reset`, which drops the volume, rebuilds the image and applies it
again from scratch. Nothing in this repository calls the Admin API, so the
declaration is the whole configuration, and the image built from this
directory the whole of the code.

An edit to the declaration does **not** reach a stack that is already up, and
neither does a change of `BROKER_MODE`. A `reset` is how either lands. Seam 2 fails on a Broker left in the other mode. A
Broker holding state worth keeping will need a migration path that this pilot
does not have yet.

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
stand-ins, so both are in the testing layer: a `production` Broker registers
the applications below and nothing else. The redirect URIs are development
guesses, and the confidential one follows the callback shape django-allauth
serves, because the applications of the pilot are Django. A third,
`misconfigured-client`, sits beside them and is not a Brokered App:
`tests/clients.ts` says why.

### And one client per Brokered App

One per application `compose.apps.yaml` brings up (ADR-0009); which those are
is that file's business and `.env`'s, not this one's. Each one's id, secret and
address are read from `.env` and substituted into the realm by the import, so
the Broker and the application's own container are told the same three values
from one declaration. The application reads them as configuration (ADR-0001)
and holds none of them in its code.

**They are in the base layer**, not in the testing one. A stand-in exists for
the tests and stops existing in `production`; these are the applications
themselves, and a Broker that did not know them would have nothing to broker
for. What is development-only about them is the value of each `${NAME}`, which
is `.env`'s business and not the realm's.

**Each registration asserts less than it looks.** The redirect URI is
`<the application's address>/accounts/oidc/*` — the namespace django-allauth
serves its callback under, with the provider id left open because the
integration of each application is what settles it (`issue #30`, `issue #31`,
`issue #94`). That
integration narrows the URI to the one path it uses; until then this is a
development guess like the stand-ins above, and the registration exists so
that the composition can hand each application a client that answers.

Geonity's is narrowed (`issue #31`), and to its **web app's** address rather
than its API's: `<GEONITY_WEB_BASE_URL>/auth/ibercivis/callback`. The web app
starts the code flow and receives the code, and the API redeems it with the
secret. So the client is confidential, and the browser carries PKCE.

An unset name survives the import as the literal `${NAME}`, so a client whose
secret is that string is the signature of a missing variable rather than of a
mistake in this file. `compose.yaml` passes the three of each, and fails to
start if `.env` declares none of them.

### Code flow only, for every client

One client policy holds every client in the realm to the code flow, whatever
its own settings say: PKCE with S256 and nothing else, and no response type
that hands a token to the browser in a URL. A setting has to be remembered on
every client registered from now on; a policy does not.

A second policy requires a `nonce`, and applies to **public clients only** —
its condition is `client-access-type`. A nonce binds an ID token to the sign-in
that asked for it, which is worth having where a browser can see that token and
is nothing a confidential client can use, since it fetches its own tokens over
a channel no browser is on. ADR-0016 has the argument, and the measurement that
forced it: no release of `django-allauth` sends a nonce for OpenID Connect, so
requiring one of every client refuses every Django Brokered App.

The PKCE setting on each client stays anyway. The realm's discovery document
advertises `plain` in `code_challenge_methods_supported` and that list cannot
be trimmed, so discovery is not evidence of what this Broker allows; the cases
in `tests/hardening.test.ts` that drive a flow and get turned away are.

### Consent required on every client

`consentRequired: true` is what puts a page in front of a Person naming the
application that is asking. It is on the stand-ins, on the three applications
of the composition and on the testing fixture alike: the spec requires it of
every client, and a client registered without it is the one place that rule
could be lost. A grant is remembered per application, so they see
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

That is about tokens, and not about Keycloak's own roles, which is why the
`demo` Identity holds `default-roles-citsci` — the composite Keycloak gives
every user of a realm so that they can read their own account. Every Person the
Broker creates from an Identity Source is given it without being asked; only a
user *declared* in a realm file is not, because the import takes the
representation literally and adds nothing to it. Without it the account console
at `/realms/citsci/account` refuses its own API, after a sign-in that worked,
and says "Something went wrong" — which is a fixture that behaves unlike every
Person the Broker makes. None of it crosses the frontier: no client is assigned
the `roles` scope, which is what the paragraph above is about.

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

It is declared in `realm/user-profile.json`, not in `realm/base.json`. The
realm format has no field of its own for a user profile, only a `components`
entry whose value is the whole profile as one escaped JSON string, which
nobody can review. So the profile is kept readable in a file of its own, and
`realm/derive.ts` makes the `components` entry from it. If the profile ever
stops being applied, the cases in `tests/mock-source.test.ts` notice: they stop
on "Update Account Information".

### The Local Credential

An email address and a password the Broker holds itself (ADR-0005). The address
is the username, and it counts for nothing until it is confirmed by mail. All
of it is base: a deployment ships it.

**Every required action the realm uses is named in it.** Importing a
`requiredActions` list replaces Keycloak's defaults, so an action left out does
not exist. Without `VERIFY_EMAIL`, an unconfirmed registration signed straight
in — measured.

**The password is chosen after the address is confirmed.** With `verifyEmail`
on, this version's registration form asks for the address alone, and the link
in the mail leads to `UPDATE_PASSWORD`. So until the mailbox answers, there is
no credential at all. `VERIFY_EMAIL` has the lower priority so that it comes
first. The registration step's `always_set_password_on_register_form` would
put the password back on the form; leave it off, or an unconfirmed
registration holds a password.

**The policy is `length(12)` and nothing else.** No composition rules, no
expiry. The import validates the realm's own users against it, which is why
`demo`'s password is long.

**An address changes only once the new one is confirmed.** That is the
`update-email` feature, which `Dockerfile` turns on and says why, with its
`UPDATE_EMAIL` action. The console's button sends the
Person to `kc_action=UPDATE_EMAIL`, and without the feature there is no such
page. Writing `email` straight into the account API is refused for another
reason: the address is the username, and `editUsernameAllowed` is off. Leave it
off. What else that API can and cannot do is in
`docs/notes/2026-11-18-account-rest-api-credential-operations.md`.

The base names its mail server as `${SMTP_HOST}` and `${SMTP_PORT}`. In
`testing` they point at the mail catcher `compose.yaml` runs, whose inbox is
<http://localhost:8026/>.

### The first broker login flow, and the two rules in it

The first time somebody arrives from an Identity Source, the Broker either
creates a Person for them or decides they are a Person it already knows. It
decides that by email address, and it asks them nothing (ADR-0004). The
built-in flow asks them to confirm the link instead, which is why this realm
declares a flow of its own.

Both rules in it answer one question — did the source this Identity came from
affirm the address it arrived with? — and both read the answer from the same
condition in `verified-email/`. The first refuses the join. The second refuses
the **address**, on the path where there is nobody to join.

**The risk this flow exists to handle.** `idp-auto-link`, the authenticator
that performs the join, compares the address and nothing else. It never checks
whether the arriving source said it had verified that address. On its own it
therefore gives away an account: register somewhere that never checks
addresses, using somebody else's, and wait for its owner to arrive (issue #75).

So a conditional subflow sits **ahead** of `idp-auto-link`: a condition of ours
from `verified-email/`, and `deny-access-authenticator` behind it. Unverified
address, no join.

Three things about that shape are decisions rather than taste:

- **The condition is ours because none of Keycloak's can do it.** The only one
  that could name such a flag reads a user's attributes, and at this point in
  the flow there is no user yet. The measurements, and the two routes that were
  refused, are in
  `docs/notes/conditional-subflow-and-brokered-email-verified.md`.
- **Ahead of the join, not after it.** Nothing is written to
  `federated_identity` until the flow finishes, so denying here leaves no trace
  at all. Denying afterwards would mean undoing a decision already taken.
- **Bound on the realm, not on each source.** `firstBrokerLoginFlow` is what
  every Identity Source uses, and no source names a flow of its own, so one
  added later cannot miss this rule by nobody remembering to attach it.

Everything else is the built-in flow's shape, `idp-review-profile` included:
the only step that decides differently is the join. Declaring these flows does
not cost the realm its built-in ones — the note says what that was measured
against.

**`deny-access-authenticator` is still temporary**, and now serves one case
rather than all of them: an unverified arrival at an address a Person already
holds. Everything arriving at an address nobody holds meets the rule below
instead. `idp-email-verification` is what should take this slot — `issue #149`.

### The rule on the create path: no Person keeps an address nobody affirmed

The refusal above guards the join, and the same takeover works by arriving
**first**, on a path that never reaches `idp-auto-link`. ADR-0004 has that
argument.

What the realm does about it: a second conditional subflow at the **end** of
the flow, the same condition, and `citsci-withhold-unverified-email` from
`verified-email/` behind it. The address comes off the Person who was just
created, and Keycloak's `UPDATE_EMAIL` asks them for one it confirms by mail
itself.

**At the end of the flow rather than inside the create path**, because
`idp-create-user-if-unique` has to stay `ALTERNATIVE` beside the join subflow:
there is nowhere inside the create path to put it. So the rule runs after the
decision and reads which way it went — which is also why it only ever reaches
a Person this flow has just made.

Everything else about the shape is decided elsewhere: ADR-0004 for why the
address is taken off rather than never written, what that costs a Person, and
the half still open (`issue #148`); the authenticator for why `UPDATE_EMAIL`
and not `VERIFY_EMAIL`; and
`docs/notes/2026-11-20-withholding-an-unaffirmed-address.md` for the
measurements.

### The Mock Identity Source

A test Identity Source this repository runs itself (`mock-source/`), so
that what a source says about an address can be decided by hand: per Identity,
and separately for the ID token and for userinfo. All three registrations are
in the testing layer. Each is declared with a display name that says it is not
for launch, because that name is what a Person reads on the sign-in page.

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
- **Its endpoints are `${MOCK_ISSUER}/…`**, written in by the image build, so
  the address is declared once, in `.env`, and a testing build without it
  fails.

### Development credentials in the file

Every credential here is a development constant on purpose. This stack is
meant to be destroyed and recreated, and a secret worth protecting has no
business being reproducible from a file in a public repository. Real secrets
are referenced, never declared.
