# Identities join into one Person by Verified Email

The pilot exists to make one human one Person across the applications, and an explicit linking flow
was not going to ship by the end of January. So the Broker joins automatically: an Identity arriving
with a **Verified Email** that matches one already held becomes an Identity of that same Person, and
an Identity arriving with any other email becomes a new Person. The email is read **once**, when that
Identity first arrives, and never consulted again.

The word *Verified* carries the whole decision. Google and GitHub affirm the address themselves. A
source that affirms nothing — ORCID affirms no email at all — or that offers an unverified one causes
the Broker to **ask for an address and confirm it by mail**, which is also what ORCID's own
integration guide tells integrators to do. An unverified email joins nothing, ever.

## Considered Options

- **No automatic linking; linking requires proving control of both accounts.** This was the previous
  decision and it is the safer one: it is the only option under which controlling someone's mailbox
  does not hand over their Person. It was rejected on delivery, not on merit — the pilot would have
  shipped with no linking at all, leaving the one thing it exists to demonstrate undemonstrated. The
  risk is **accepted knowingly**: whoever controls a mailbox can become that Person. What keeps it
  tolerable is that nothing but a *verified* address counts, and that is now a security property with
  a test over it rather than a setting somebody could flip.
- **A second join key on the ORCID iD.** Tempting, because an ORCID iD is globally unique, stable and
  non-reassignable, which an email is not. Rejected because it joins nothing new: no other Identity
  Source asserts an ORCID iD, so an ORCID iD can only ever match another ORCID login, which the
  Identity already resolves on its own. It would buy a second key, a second path to test and a second
  way to be wrong, for zero additional joins.
- **Any email, verified or not, as the key.** Refused outright. It is a one-minute account takeover:
  register with a password under somebody else's address and wait for them to arrive.

## Consequences

The Broker owns an email verification flow, and therefore SMTP, in every environment. The spec's
earlier claim to have no such flow to own is withdrawn.

The mailbox becomes the Person's recovery root, since the same address also recovers a Local
Credential (ADR-0005). Both consequences point at the same place on purpose.

One human reachable at two unrelated addresses is **two Persons**, and the applications will have
keyed data against both identifiers. A future merge must therefore **add an alias** and never
reassign, because ADR-0002 promises that a Person Identifier is never reassigned and never recycled.
A merge flow that reassigned would break every application that trusted that promise.

Setting `trustEmail` per Identity Source has a limit worth stating before it is met: **a source that
is itself a proxy over many providers cannot carry it.** `trustEmail` says "this source affirms the
address", which is one trust decision about one operator. A broker federating thousands of upstream
providers passes through whatever each of them asserted, so trusting it is not one decision but as
many as it has providers, taken sight unseen. AUTHENIX is the concrete case — it fronts the whole
eduGAIN aggregate, 6,709 providers, and documents `email_verified` as whatever the upstream identity
management said (`docs/notes/authenix-research.md`). Were we ever to add such a source, `trustEmail`
stays off and the Broker asks for an address and confirms it, as it already does for ORCID.

The Keycloak version is pinned, `trustEmail` is set per Identity Source rather than globally, and
seam 1 asserts the **negative** property: an Identity presenting an unverified email does not join an
existing Person. That inverted test is the only thing standing between this decision and account
takeover, so it is a first-class assertion and not a nice-to-have.
