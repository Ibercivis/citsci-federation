# Citizen Science Federation

The **Broker**: one place where a **Person** proves who they are, which every
**Brokered App** delegates to. A Person signs in through an **Identity
Source** and every application recognises them by a single **Person
Identifier**, without holding a password of its own.

- What it is for, and what it does not do: [`docs/specs/spec-shared-identification.md`](docs/specs/spec-shared-identification.md)
- The decisions, and what they cost: [`docs/adr/`](docs/adr/)
- The words, used in one sense each: [`GLOSSARY.md`](GLOSSARY.md)
- What checks the code, and what does not yet: [`docs/verification.md`](docs/verification.md),
  and the two rules no tool enforces in [`CODING_STANDARDS.md`](CODING_STANDARDS.md)

## Running the Broker

Requires Docker, and Node with pnpm for the checks and the test suite.

```sh
pnpm install
pnpm broker:up      # Keycloak, its PostgreSQL, the reverse proxy in front,
                    # and the Mock Identity Source the tests steer
pnpm test           # drives the real OIDC protocol against it
pnpm broker:down    # and removes the volume
```

The Broker then answers at the issuer declared in [`.env`](.env), realm path
included. Nothing else is needed: the realm, the clients, the one demo
Identity and the mock Identities are declared in this repository and
applied at start-up.

## Running the Brokered Composition

The **Brokered Composition** (ADR-0009): the Broker, the proxy, the mail catcher
and every Brokered App that has been integrated, as one set of containers.
This is where single sign-on is tried by hand.

```sh
pnpm clean-slate  # every stack down first, and this repository's data with them
pnpm apps:up      # checks the applications out, builds, seeds, and says
                  # what answered
pnpm apps:logs    # add a service name for one of them
pnpm apps:down    # keeps the data; `pnpm apps:reset` throws it away
```

**The walkthrough is [`docs/trying-it-by-hand.md`](docs/trying-it-by-hand.md)**: the addresses, the
seeded accounts, what to click, and what does not work yet.
[`docs/demo-script.md`](docs/demo-script.md) is the same composition as a sequence to run in front
of people.

Docker, `git` and `curl` are what it needs; the scripts are POSIX shell and run
without Node, so a machine with no pnpm on it calls
[`scripts/apps-up.sh`](scripts/apps-up.sh) directly.

The applications are **not** in this repository:
[`scripts/checkout-apps.sh`](scripts/checkout-apps.sh) clones each one into
`apps/`, which is gitignored, at its `federation` branch — the branch that
carries its container recipe (`docs/agents/external-repos.md`) — and
[`compose.apps.yaml`](compose.apps.yaml) builds from there.

Everything is reached **by hostname through the proxy**, and nothing in it
publishes a port of its own. The addresses are declared in [`.env`](.env):

| | |
|---|---|
| `broker.localhost:8080` | the Broker, at the issuer, realm path included |
| `lostatnight.localhost:8080` | LostAtNight |
| `geonity.localhost:8080` | Geonity's web app, `geonity-admin` its admin panel, `geonity-api` its API |
| `openred.localhost:8080` | OpenRed's React front end, `openred-api` its API |
| `mail.localhost:8080` | every message any of them sends |

`.localhost` resolves to the loopback in every browser without an
`/etc/hosts` line, and to the proxy from inside the composition.

Every map is blank, and OpenRed's Google button cannot work.
[`docs/trying-it-by-hand.md`](docs/trying-it-by-hand.md) says why, and what
else does not work yet.

Each application is seeded with accounts that **existed before the Broker** —
invented, on `.invalid` addresses, from each application's own `seed_local`
command — so that "an existing sign-in keeps working" is something to click
rather than a claim. No production data and no personal data is in any of it.

**The composition as it stands is the development build** (ADR-0009):
development constants in plain sight, DEBUG on, the Django development server,
and parts that are missing on purpose. It depends on no provisioned machine, and
nothing in this state is what gets deployed — hardening it is later work on
this same composition rather than on a rewrite.

## What is declared here, and what is not

`compose.yaml` declares the Broker — the reverse proxy, the OpenID provider
behind it, and that provider's own database — and the Mock Identity Source
outside it, in [`mock-identity-source/`](mock-identity-source/), which exists so
the tests can decide what a source says about an address. None of it is a launch
source. One server stands behind three Identity Sources there, because a Person
cannot hold two Identities from the same source, and the rule under test is
about their second one. The proxy is in front **in every environment, including
local** — the reason is parity of form, since the cookie, TLS, redirect-URI and
CORS failures that depend on deployment shape otherwise appear for the first
time in production (ADR-0001).

`compose.apps.yaml` declares how each Brokered App runs **in the Composition**, and
that is not the same as declaring that application's infrastructure: its own
development environment, its Dockerfile and its production deployment all stay
in its own repository. ADR-0009 made that distinction knowingly, against what
this repository used to promise, and says what it costs. What this repository
holds about an application is still only how the Composition runs it, and the client
the Broker knows it by.

The Keycloak version is **pinned** and does not move on its own. A security
property of the design rests on how this version treats a verified email
address (ADR-0004), and the extension that enforces it —
[`broker/verified-email/`](broker/verified-email/), which holds a join at an
address nobody verified back until the Broker's own mail answers for it, and
takes the address off a Person whose source did not affirm it — reads that flag
out of an undocumented field. An upgrade that moved the field would break both
silently, and break them towards joining and keeping an address nobody
affirmed, so an upgrade is something `pnpm test` has to clear first.

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
