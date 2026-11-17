# The Mock Identity Source

An OpenID provider that says exactly what `mock.json` tells it to, run by
`compose.yaml` beside the Broker so the tests can steer an Identity Source.
Google and GitHub cannot be told what to say about an address; this can. It
vouches for nobody, it is not a launch source, and #65 takes it out of every
configuration but the testing one.

## What it declares

`mock.json` holds the Identity Sources this one server stands behind, the
client it serves — the Broker — and its Identities.

### Three sources, one server

| Alias | Affirms addresses (`trustEmail`) |
|---|---|
| `mock` | no — everything through it is unverified, whatever it claims |
| `mock-affirming-a` | yes |
| `mock-affirming-b` | yes |

Three, because a Person holds **one Identity per source**:
`federated_identity`'s primary key says so, and ADR-0004 is about what happens
when their second Identity arrives. So the merge needs two sources that affirm
addresses, and the case where nobody affirmed one needs a source that affirms
nothing. The keys of `sources` are the only place the aliases are declared —
`server.ts` registers one Broker callback per key, and the realm names the
same aliases because JSON can import nothing.

`affirmsAddresses` is the realm's `trustEmail` said a second time, for the
same reason. It decides nothing: the realm does. It is here so that a case can
ask for *a source that affirms addresses* rather than naming one, and the
merge case is what goes red if the two ever disagree.

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

**An address per case, not one shared by all of them.** The suite drives one
Broker and a Person outlives the case that made them, so two cases staging a
Person at the same address decide each other's outcome — and which of them ran
first is not something a case can see. The last four addresses belong to
`tests/verified-email-join.test.ts`, one per case.

A case that needs another combination adds an Identity here. The source's
answer cannot yet change between two sign-ins; #25 needs that, and adds it.

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
