# The end-to-end tests of the pilot live in this repository

Tests that drive a real browser across the whole pilot live here, not in the Brokered Apps'
repositories. They run against the composition of ADR-0009, and they exist for one assertion no
single application repository can make: **one sign-in, two applications, the same Person
Identifier**.

They are no longer optional. The pilot used to commit to the Broker's HTTP surface and to treat
end-to-end tests as a welcome extra; they are now a deliverable, because the pilot is going to be
judged by somebody clicking through it, and what somebody clicks through is worth having a machine
click through first.

## Considered Options

- **One end-to-end harness per application repository.** Rejected: it would sit next to the code it
  exercises, which is the argument in its favour, but no single application's repository can host a
  claim that spans two applications, each harness would have to know how to bring up the Broker, and
  each is a second thing to maintain in a repository that is not ours.
- **Both layers, with an explicit split** — each application testing its own sign-in, this repository
  testing the crossing. Rejected on cost rather than on principle, with a team of two and a January
  deadline. This is where the design goes if the application-side layer ever earns its place.
- **No end-to-end tests, seam 1 only.** That was the previous decision, and it is the one being
  overturned.

## Consequences

**This repository now runs code it does not own.** A Brokered App's `federation` branch can move and
break a test here. That is accepted, and it is most of the value: a red test here is the earliest
signal that an integration has drifted.

**One of the two things the spec said could not be tested becomes testable.** ADR-0007's registration
closure was listed as unverifiable because the Broker cannot see it. A browser can: the test asserts
the registration link is gone from the application's own web front end. It covers the applications in
the composition and not the others, and that each application attaches its roles to the Person
(ADR-0003) stays untested.

**Seam 1 does not shrink.** Every protocol assertion stays where it is cheaper and more precise — the
discovery document, the tokens, the error responses. The end-to-end seam asserts only what a person
can see: the pages, the redirects between applications, the absence of a second sign-in. A Person
Identifier is read where an application already exposes it, never from the Broker's database and
never from an application's.

**The cut list changes.** End-to-end tests headed the list of things to drop if time ran short. They
no longer do, and the spec says so.
