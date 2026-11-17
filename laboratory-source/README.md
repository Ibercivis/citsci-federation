# The Laboratory Identity Source

An OpenID provider that says exactly what `laboratory.json` tells it to, run by
`compose.yaml` beside the Broker so the tests can steer an Identity Source.
Google and GitHub cannot be told what to say about an address; this can. It
vouches for nobody, it is not a launch source, and #65 takes it out of every
configuration but the testing one.

## What it declares

`laboratory.json` holds the client it serves — the Broker — and its
Identities. Each Identity carries two sets of claims about its address: one for
the ID token and one for userinfo. They are written out separately even where
they agree, because making them disagree is what this source is for.

| Identity | ID token | userinfo |
|---|---|---|
| `lab-verified` | `shared@laboratory.test`, verified | the same |
| `lab-unverified` | `shared@laboratory.test`, **unverified** | the same |
| `lab-split` | `split@laboratory.test`, verified | `shared@laboratory.test`, unverified |

A case that needs another combination adds an Identity here. The source's
answer cannot yet change between two sign-ins; #25 needs that, and adds it.

## Keep the ID tokens free of names

A split Identity like `lab-split` only stages the reported advisory if the
Broker actually calls userinfo, and that is **unverified** against the pinned
version: Keycloak is understood to call it only when the ID token lacks one of
`name`, `preferred_username` or `email` — here, because no Identity declares a
name. Add `name` or `preferred_username` to an Identity's `idToken` and the
case built on it may pass without userinfo ever being read. #24 checks this by
experiment and records what it finds; until then, keep names out.

Why the source is built the way it is lives next to what it explains:
`server.ts` for the source itself, `compose.yaml` and `.env` for where it runs.
`tests/laboratory-source.test.ts` holds it to its declaration, at its own seam
as well as through the Broker.
