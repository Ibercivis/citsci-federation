# The Mock Identity Source

An OpenID provider that says exactly what `mock.json` tells it to, run by
`compose.yaml` beside the Broker so the tests can steer an Identity Source.
Google and GitHub cannot be told what to say about an address; this can. It
vouches for nobody and it is not a launch source, so it runs only when
`BROKER_MODE` is `testing`, and the Broker registers it only in the testing
layer (`broker/realm/testing.json`).

## What it declares

`mock.json` holds the Identity Sources this one server stands behind, the
client it serves — the Broker — and its Identities.

### Five sources, one server

A Person holds **one Identity per source** — `federated_identity` says so with
a primary key — and the join is about their *second* Identity. Two affirming
sources to stage the silent join, one affirming nothing to stage the arrival
that has to answer the Broker's mail first, one that affirms and asks for
`profile` as well, and one the Broker asks for no address at all
(`broker/README.md` says why).

`sources` is the list of aliases and nothing more: `server.ts` registers one
Broker callback per alias, and the realm repeats them because JSON imports
nothing.

What each source is **called** and whether the Broker takes its **word on an
address** are the realm's to decide, declared there as `displayName` and
`trustEmail` and read by `tests/realm.ts`. They are not restated here: when they
were, flipping a `trustEmail` was caught by a behavioural case failing somewhere
else, rather than by the guard that claimed to catch it.

### The Identities

Each Identity carries two sets of claims about its address: one for the ID
token and one for userinfo. They are written out separately even where they
agree, because making them disagree is what this source is for.

| Identity | ID token | userinfo |
|---|---|---|
| `mock-verified` | `shared@mock.test`, verified | the same |
| `mock-unverified` | `shared@mock.test`, **unverified** | the same |
| `mock-split` | `split@mock.test`, verified | `shared@mock.test`, unverified |
| `takeover-verified` | `takeover@mock.test`, verified | the same |
| `takeover-unverified` | `takeover@mock.test`, **unverified** | the same |
| `merge-verified` | `merge@mock.test`, verified | the same |
| `untrusted-verified` | `untrusted@mock.test`, verified | the same |
| `lockout-untrusted` | `lockout@mock.test`, verified | the same |
| `lockout-verified` | `lockout@mock.test`, verified | the same |
| `squat-untrusted` | `squat@mock.test`, verified | the same |
| `squat-verified` | `squat@mock.test`, verified | the same |
| `renamed-verified` | `renamed@mock.test`, verified | the same |
| `either-verified` | `either@mock.test`, verified | the same |
| `octocat-verified` | `octocat@mock.test`, verified | the same |
| `spoofed-verified` | `spoofed@mock.test`, verified | the same |

The `-untrusted` half of each pair is the same claim read through
`mock-identity-source`, whose word on an address the Broker does not take, so
it arrives affirmed by nobody. `untrusted-verified` is that idea for the join;
these two pairs are for arriving *first* (`issue #88`).

**An address per case.** The suite drives one Broker and a Person outlives the
case that made them, so two cases at the same address decide each other's
outcome — and no case can see which of them ran first. `takeover`, `merge`,
`untrusted`, `lockout` and `squat` belong to
`tests/verified-email-join.test.ts`, `renamed` to
`tests/local-credential.test.ts`, `either` to
`tests/mock-identity-source.test.ts`, and `octocat` and `spoofed` to
`tests/github-source.test.ts`.

A case that needs another combination adds an Identity here.

**An Identity the Broker has never met** is the one thing this table cannot
give: a case about a Person's first arrival runs once against a Broker, and the
second run signs in as the Person the first one made. So `mock.json` also
declares `newcomers` — any username under one of their prefixes, with
`{username}` in the claims filled in. `newcomers.ts` mints one per run,
refuses a declaration whose prefixes overlap, and is where the tests read the
address a newcomer will arrive at rather than deriving it a second way.

Four shapes. Three because what the claims say about that address is the
question such a case usually turns on. `unverified` is for an address nobody
affirmed, `verified` for one its source did. The second is how a case stages a
Person **and** a later arrival at their address in one run — the same username
through an affirming source and then through `mock-identity-source`, which is
`untrusted-verified` above with nothing left over from the last run.

`affirmedButNoAddress` is the third, and its claims carry no `{username}`
because its address is not an address: the source affirms the string `not an
address`. The page shows when a required field is missing or will not validate,
and `email` is the one required field (`broker/realm/user-profile.json`), so
there are two ways to `idp-review-profile` from the declaration alone and this
shape is the one that will not validate. What such an arrival types there was
affirmed by nobody while its source's `email_verified` still says `true`, which
is the shape `issue #182` is about. The other way is a missing address, which no
shape can stage on its own: it takes the source the Broker asks for no address
(`mock-identity-source-sending-no-address`), and it carries no verdict either.

The fourth, `relocating`, is one Identity whose address changes between two
sign-ins, the way a Person changes it at their source. The username's part
before `subjectEndsAt` is the `sub`, and the part after it picks the address:
sign in under another label and the same `sub` arrives elsewhere. Claims are
read by `sub`, so `server.ts` remembers which label each `sub` last signed in
with. It is the one thing the source remembers.

## The GitHub imitation

GitHub is not an OpenID provider, and what it says about an address is not a
claim: it is the `verified` field of each entry in its `/user/emails` list.
Keycloak's own GitHub provider never reads that field. No OpenID mock can stage
it, so `github.ts` serves the four endpoints that provider calls, under
`/github`: authorize, token, `/user` and `/user/emails`.

It is declared under `github` in `mock.json`: the alias it answers for, and
Identities shaped like GitHub's answers. `email` is the public profile address,
`null` for all of them, so the provider reads the list. It shares the sign-in
page and the client with the OpenID sources.

| Identity | Primary address | GitHub says |
|---|---|---|
| `github-octocat` | `octocat@mock.test` | verified |
| `github-newcomer` | `github-newcomer@mock.test` | verified |
| `github-spoofer` | `spoofed@mock.test` | **unverified** |
| `github-unconfirmed` | `github-unconfirmed@mock.test` | **unverified** |

## The advisory's Identities

These Identities stage the `trustEmail` advisory the spec names, which was real
up to Keycloak 26.7.1 (`docs/notes/2026-11-23-trust-email-and-userinfo.md`). They
stage it and `tests/verified-email-join.test.ts` holds them against a Person
already at `advisory@mock.test`:

| Identity | ID token | userinfo |
|---|---|---|
| `advisory-verified` | `advisory@mock.test`, verified | the same |
| `advisory-split` | `advisory-decoy@mock.test`, verified | `advisory@mock.test`, **unverified** |
| `advisory-split-named` | as `advisory-split`, with `name` and `preferred_username` | as `advisory-split` |
| `advisory-silent` | `advisory@mock.test`, **unverified** | `advisory@mock.test`, nothing said |
| `silent-squat` | `silent-squat@mock.test`, **unverified** | `silent-squat@mock.test`, nothing said |
| `silent-squat-verified` | `silent-squat@mock.test`, verified | the same |

The `silent-squat` pair is the silent shape arriving *first*, at an address
nobody holds yet.

A name reaches the ID token only through `mock-identity-source-affirming-named`,
the one source that asks for `profile`. Through any other,
`advisory-split-named` is `advisory-split`.

Why the source is built the way it is lives next to what it explains:
`server.ts` for the source itself, `compose.yaml` and `.env` for where it runs.
`tests/mock-identity-source.test.ts` holds it to its declaration, at its own
seam as well as through the Broker.
