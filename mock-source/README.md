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

### Three sources, one server

Three, because a Person holds **one Identity per source** — `federated_identity`
says so with a primary key — and the join is about their *second* Identity. Two
affirming sources to stage the silent join, one affirming nothing to stage the
arrival that has to answer the Broker's mail first.

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

The `-untrusted` half of each pair is the same claim read through `mock`, whose
word on an address the Broker does not take, so it arrives affirmed by nobody.
`untrusted-verified` is that idea for the join; these two pairs are for arriving
*first* (`issue #88`).

**An address per case.** The suite drives one Broker and a Person outlives the
case that made them, so two cases at the same address decide each other's
outcome — and no case can see which of them ran first. `takeover`, `merge`,
`untrusted`, `lockout` and `squat` belong to
`tests/verified-email-join.test.ts`, `renamed` to
`tests/local-credential.test.ts`, and `either` to `tests/mock-source.test.ts`.

A case that needs another combination adds an Identity here. The source's
answer cannot yet change between two sign-ins; #25 needs that, and adds it.

**An Identity the Broker has never met** is the one thing this table cannot
give: a case about a Person's first arrival runs once against a Broker, and the
second run signs in as the Person the first one made. So `mock.json` also
declares `newcomers` — any username under one of their prefixes, with
`{username}` in the claims filled in. `newcomers.ts` mints one per run,
refuses a declaration whose prefixes overlap, and is where the tests read the
address a newcomer will arrive at rather than deriving it a second way.

Two shapes, because what the claims say about that address is the question such
a case usually turns on: `unverified` for an address nobody affirmed, and
`verified` for one its source did. The second is how a case stages a Person
**and** a later arrival at their address in one run — the same username through
an affirming source and then through `mock`, which is `untrusted-verified`
above with nothing left over from the last run.

## Keep the ID tokens free of names

A split Identity like `mock-split` only stages the reported advisory if the
Broker actually calls userinfo, and that is **unverified** against the pinned
version: Keycloak is understood to call it only when the ID token lacks one of
`name`, `preferred_username` or `email` — here, because no Identity declares a
name. Add `name` or `preferred_username` to an Identity's `idToken` and the
case built on it may pass without userinfo ever being read. #24 checks this by
experiment and records what it finds; until then, keep names out.

Why the source is built the way it is lives next to what it explains:
`server.ts` for the source itself, `compose.yaml` and `.env` for where it runs.
`tests/mock-source.test.ts` holds it to its declaration, at its own seam
as well as through the Broker.
