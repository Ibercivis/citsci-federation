# The Broker holds Local Credentials

Not everyone who takes part in citizen science has a Google or GitHub account, and the accounts that
already exist in the applications are email-and-password accounts. The Broker therefore offers a
**Local Credential** — an email address and a password it holds itself — as one Identity Source among
the others, with self-service registration, mandatory email verification, Broker-owned password
recovery and a declared password policy.

This is also what makes the eventual migration possible rather than merely imaginable: an existing
application account can only move into the Broker if the Broker can hold that kind of Identity at
all.

## Considered Options

- **Social sources only, no password anywhere in the Broker.** This was the previous decision, and the
  spec's goal of *storing no passwords for new accounts* is withdrawn with it. Rejected for
  two reasons: it excludes everyone without one of three commercial accounts, from a foundation whose
  purpose is participation; and it would force the future migration to invent an Identity Source for
  itself, at the worst possible moment.
- **Leave passwords where they are, one store per application.** Rejected: that is the problem the
  pilot exists to shrink. Every application that keeps its own registration keeps its own password
  store (ADR-0007).

## Consequences

The foundation does now hold password hashes. The honest form of the original goal is *one store
instead of one per application*, not *none*.

**Assurance stops being uniform.** "Google affirms this address" and "somebody registered and clicked
a link in that mailbox" are not the same thing, and no Brokered App can tell them apart — the
promise that an app never learns the Identity Source is kept, and it now hides a real difference.
That is accepted for the pilot; ADR-0003 already leaves a per-action assurance check available later
without changing the model.

Keycloak's **Account Console** becomes the Person's own place to change a password, change an email
address and see their own Identities. It is the only user-facing surface of the Broker, and the one
to point at when somebody proposes building a profile screen. The operations exist as an API behind
it, so nothing here forecloses automating them.

Password policy, password recovery and email verification are now ours to own and to declare. They
are no longer out of scope.
