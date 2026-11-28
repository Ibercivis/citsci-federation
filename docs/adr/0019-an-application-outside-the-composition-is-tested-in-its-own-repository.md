# A Brokered App outside the composition is tested in its own repository

A Brokered App may be integrated without joining the Brokered Composition. When it is, the tests
that cover its side of the integration live in **its** repository and run in CI there, and this
repository holds only the client the Broker knows it by.

ADR-0009 says the composition is the Broker and **every Brokered App that has been integrated**.
That is qualified here: every one whose evidence the composition is the only place to get. Three
applications are in it, and they already show one Person crossing several applications without a
second sign-in — the claim ADR-0009 put them there to make visible. A fourth adds a Dockerfile, a
proxy block, a database, a seeded dataset and a build to keep green, and adds no evidence that the
claim holds, because the claim is about crossing and three applications cross.

It is also the split ADR-0010 rejected, taken up on the terms that record left: *each application
testing its own sign-in, this repository testing the crossing*. That was rejected on cost with a
team of two and a January deadline, and ADR-0010 named the condition for revisiting it — "this is
where the design goes if the application-side layer ever earns its place". It earns it when the
alternative is not *tests here instead* but **no tests at all** for an application whose own
repository can host them.

## What goes where

| In this repository | In the application's repository |
|---|---|
| The client in `broker/realm/base.json`, under the same refusals as the others | Everything about the application's own behaviour: what it stores, what it verifies, what it refuses, that registration is closed, that its own sign-in is unchanged |
| Seam 1 and seam 2, which never read an application | A CI workflow on the `federation` branch only, running that application's suite |
| Seam 3, for the applications in the composition | — |

The Broker's half is still tested here, and a client in the base layer is covered without anything
being added: `declaration.test.ts` reads the clients out of the layer files and drives an
authorization request for each, so the registration of an application nobody here can start is
exercised exactly as the others are. What stops at the frontier is the application.

The workflow runs **on that branch only** — pushes to `federation` and pull requests into it. It is
our branch by convention (`docs/agents/external-repos.md`); a workflow that also ran on `main` would
put a check of ours on the application's own line of development, which is the thing that rule
exists to prevent.

## The gap this accepts

**A change on the Broker's side runs nothing in that repository.** This client in
`broker/realm/base.json`, the Keycloak version, a realm policy, a claim's name: all of it is this
repository's to change, and none of it can turn that application's suite red. ADR-0010's best
consequence — "a red test here is the earliest signal that an integration has drifted" — does not
exist for an application outside the composition. Drift is found when somebody signs in.

Nothing is dressed up as covering it. The symmetric gap is already accepted and smaller: a change
in a composition application's `federation` branch can break a test here, which is most of
ADR-0010's value. Here the arrow runs the other way and lands nowhere.

**The registration closure goes back to a check by hand.** ADR-0010 took it off the spec's
unverifiable list for the applications a browser can reach, and the spec already says it stays a
manual check for an application that is integrated and not in the composition. That check is
therefore not optional paperwork: it is the only thing standing behind the claim that the
foundation's exposure falls (ADR-0007), so **the integration records who performs it**, by name, in
the pull request.

**What would close the gap** is a scheduled job here that runs each outside application's suite
against the composition's Broker, or a second application outside the composition drifting
unnoticed in a way a person had to find. Either is a reason to reopen this; the first is also the
cheaper half of what ADR-0009 would have cost.

## Considered Options

- **Put every integrated application in the composition, as ADR-0009 reads.** Rejected on what the
  fourth one buys. The containers are real work — a Dockerfile, a seeded dataset, a proxy block, a
  stack in the compose file and a build that has to stay green — and the assertion they would
  enable is one three applications already make. ADR-0009's reason was that single sign-on cannot
  be tested with one application; it can be tested with three, and a fourth tests the same thing
  again.
- **Integrate it and test it nowhere.** Rejected, and it is the option this record exists to
  refuse. Everything the integration is held to — what it stores, what it verifies, the four
  refusals, the closed registration, the unchanged sign-in — would be asserted by nobody and
  rechecked by hand at every change. An application outside the composition is the one that most
  needs its own suite, because nothing else watches it.
- **Both layers everywhere**: the application-side suite for every Brokered App, in the composition
  or not. Rejected as a requirement, not as a practice. It is three more suites in three more
  repositories that are not ours, each covering what seam 3 already drives in a browser, and the
  cost lands on applications whose integration is finished. An application that wants one is
  welcome to it.
- **A copy of the application's suite in this repository, run against a container built on demand.**
  Rejected: that is the composition, paid for once per test run instead of once, and it still needs
  the Dockerfile and the dataset that were the cost being avoided.

## Consequences

**The Brokered Composition stops being the list of integrated applications.** It is the applications
whose crossing is demonstrated, and `GLOSSARY.md` keeps its definition because that is what the
composition is. The list of integrated applications is wider, and `docs/local-development.md` is
where it can be read: an application outside the composition still gets a local environment, because
the environment is what makes the application startable and the composition is what makes two of
them crossable.

**The promise made to the application repositories changes again.** ADR-0009 made it "the
authentication hook, the registration link, and a container recipe on the `federation` branch". For
an application outside the composition it is "the authentication hook, the registration link, a
local environment and a test suite with a workflow to run it" — no container recipe for the
composition, and a CI workflow instead. Both are branch-local, `main` is still never touched, and
the net change in somebody else's repository is smaller than the composition's.

**`pnpm apps:up` does not bring up every integrated application**, and `scripts/apps-up.sh` checking
one it cannot start would be a false failure. An application outside the composition is absent from
`compose.apps.yaml`, from the proxy's Caddyfile and from that script, and present in
`broker/realm/base.json` — which is the one asymmetry a reader of those files will trip over, so the
client's description in the realm says it.

**The client's redirect URI names an address the composition does not serve.** Every other client's
is a hostname under `.localhost` served by the proxy (ADR-0009, ADR-0012); this one is wherever that
application's local environment runs. The Broker is configuration either way (ADR-0001), and an
installation that moves the application changes one declared value.

**This is the ADR the Observatorio integration is blocked on** (`issue #243`), and it applies to it
unchanged. What that application adds is its own: a `federation` branch cut from a deployed branch
rather than from `main`, and a different library's request shape at seam 1.
