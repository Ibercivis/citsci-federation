# The pilot is one Docker composition, Broker and Brokered Apps together

The pilot is a single composition of containers declared in this repository: the Broker — Keycloak,
its PostgreSQL and the mail catcher — a reverse proxy in front of everything, and **every Brokered
App that has been integrated**, each built from its own `federation` branch. One command brings the
whole of it up.

It runs wherever Docker runs. It starts on a laptop, which is what keeps the pilot free of any wait
for a machine to be provisioned. **Where it is published, and whether it is published at all, is a
later decision** — the current OVH infrastructure is not needed to make progress, and nothing here
is built on it.

Each Brokered App gains, on its `federation` branch and nowhere else, whatever it takes to build and
run as a container: a Dockerfile, an entrypoint, the environment it needs. `main` never sees it. None
of those applications is containerised in production and this decision does not propose that they
should be.

The reason is that single sign-on cannot be tested with one application. The claim the pilot exists
to demonstrate — one Person, several applications, no second sign-in — is only visible when two
applications are up at once and somebody can click from one to the other. Nothing at the Broker's
HTTP surface shows it to a person who is not reading test output.

## Considered Options

- **Keep the pilot local and one application at a time**, which is what the spec said. Rejected: the
  central claim would only ever be asserted, never seen, and nobody outside the two people writing
  the code could look at it.
- **Deploy on the current servers in production's own shape** — one more reverse-proxy virtual host
  per application, the process manager, a local PostgreSQL. Rejected for now: parity would be high,
  but it puts an early-stage environment — one that does not yet meet the standards production will
  be held to — on machines that serve production, and every change becomes a deploy by hand. This is the shape to reconsider *if and when* the pilot needs a
  public address, and that is the later decision this ADR defers rather than forecloses.
- **A managed platform** (Fly, Render, Railway). Rejected: it wants the same Dockerfile we are
  writing anyway, and adds an outside provider plus a fight over PostGIS and map tiles.
- **A tunnel from a developer's laptop.** Rejected as the mechanism, because it is only up while
  somebody's laptop is. Kept as the cheap way to show the running pilot to one person before any
  decision about publishing it.

## Consequences

**The promise made to the application repositories changes, for the third time, and out loud.** It was
"the authentication hook"; ADR-0007 made it "the authentication hook and the registration link"; it is
now "the authentication hook, the registration link, and a container recipe on the `federation`
branch". Every part of it still lands on a branch that is ours by convention, `main` is still never
touched, and the way those applications are deployed for real still does not change.

**It overturns the spec's "no Brokered App's infrastructure is declared here".** What this repository
declares is how an application runs **in the pilot**, which is not that application's infrastructure.
The distinction is load-bearing: the day this composition becomes the way something is actually
deployed, it has to meet standards it does not meet yet, and that is a decision to take knowingly
rather than to drift into.

**Every service is reached through the proxy by hostname, not by a port on localhost.** That is the
same parity-of-form argument the spec already makes for the Broker, extended to the applications:
redirect URIs, cookies and CORS take the shape they will have in production, and the Broker's address
stays configuration (ADR-0001), so changing it later costs a configuration change and one forced
re-login.

**Everything in it is fixtures.** The stories about accounts that existed before the pilot need an
account that already exists, and the composition creates it. No production data and no personal data
goes in — which is also what would make a public URL safe, the day we want one.

**Early-stage, not throwaway.** The composition is allowed to be rough and it carries development
constants on purpose, because this is the first phase of code that will keep changing: it does not yet
satisfy specifications and standards that become necessary later — EOSC-node conformance among them,
if this ever becomes the germ of a Spanish node, and that conformance is explicitly out of the pilot's
scope. What follows is that nothing here reaches production **in this state**, not that it is written
to be discarded: the composition is meant to be hardened and grown rather than replaced. It stays
cheap to reverse all the same — withdrawing the integration costs deleting a branch in each
application and a folder here.
