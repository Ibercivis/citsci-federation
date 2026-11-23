# Identities join into one Person by Verified Email

The pilot exists to make one human one Person across the applications, and an explicit linking flow
was not going to ship by the end of January. So the Broker joins automatically: an Identity arriving
with a **Verified Email** that matches one already held becomes an Identity of that same Person, and
an Identity arriving with any other email becomes a new Person. The email is read **once**, when that
Identity first arrives, and never consulted again.

The word *Verified* carries the whole decision. Google and GitHub affirm the address themselves. A
source that affirms nothing — ORCID affirms no email at all — or that offers an unverified one causes
the Broker to **ask for an address and confirm it by mail**, which is also what ORCID's own
integration guide tells integrators to do. An unverified email joins nothing on its own word: either
the source affirmed the address, or the Broker confirms it by mail before the join.

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
existing Person on the strength of that address — it is mailed, and joins only if the mail is
answered. That inverted test is the only thing standing between this decision and account takeover,
so it is a first-class assertion and not a nice-to-have.

## What enforces the negative direction

**Not the provider, which this decision read as though it would.** Keycloak performs the merge with
`idp-auto-link`, and that authenticator compares the address and never reads `email_verified`. So the
configuration that delivers the paragraph above also delivers the takeover this ADR refuses: a
verified address, then the same address unverified from a second source, one Person Identifier, no
page and no error (issue #75). Configuration cannot stop it either — no condition Keycloak ships sees
what the arriving source claimed.

So the rule is **our code**: a condition in `broker/verified-email/`, which the realm puts in a
conditional subflow ahead of the join. It reads the two facts Keycloak itself reads when it creates a
Person — this source is trusted on addresses, and it said it verified this one — so the join path
cannot drift away from the create path. Whatever it cannot establish counts as unverified.

**A verdict is about the address its source sent, and about no other.** Keycloak shows an arrival
the profile its source sent whenever a required field will not validate, and the address can be
edited on that page. Nothing there edits `email_verified`. So an arrival that types a different
address carries a trusted source's `true` about an address that has left the flow, and reading that
`true` on its own affirms whatever was typed: somebody else's address, if somebody else's was typed.
That was a join with nothing asked, and on the create path a Person made at an address nobody
affirmed — both of them reachable without a claim being false anywhere (`issue #182`). So the
condition reads a third fact, the note Keycloak leaves when the address in the flow is not the one
it received, and an address typed there is affirmed by nobody.

An Identity it holds back is **mailed at the address it is arriving at**, the one that Person already
holds, and joins them when the link is followed (`issue #149`). That is the top of this record
applied to the join: the Broker asks for nothing the arrival could simply claim, and takes the
mailbox's word instead. It adds no risk this decision has not already taken — whoever controls a
mailbox can become that Person.

**Nothing in the flow is a closed door, and that rests on the mail being ours.** Keycloak's own
`idp-email-verification` declines to send for exactly the case above — the address was typed on the
review page — and reports ATTEMPTED. The built-in flow has a re-authentication alternative beside it
to absorb that; a subflow holding a condition and one authenticator has nothing, so the subflow
failed and the sign-in died. This record claimed the door was open while that page still read
"Invalid username or password" — an arrival blamed for its credentials over an address that was
somebody else's. What stands there now is `citsci-confirm-address-by-mail`, that authenticator with
the one branch taken out. **The claim is only as good as the case that holds it**: it is an arrival
driven through the review page, in `tests/verified-email-join.test.ts`, and nothing read off the
realm can take its place — the shape that failed was a declaration everything static agreed with.

**It is paid for by the Person who holds the address.** They get a mail nobody asked them for
whenever somebody arrives badly at it, one per attempt: Keycloak's guard against resending covers a
repeat inside one sign-in and nothing more, and nothing here rate-limits the rest. The refusal sent
none. That is the price of the door being open, and it is the Person's price rather than the
arrival's.

## An Identity does not bring an address its source did not affirm

Holding the join back is not enough on its own, because the takeover works by arriving **first**:
take an address at a source that affirms nothing — ORCID affirms none — and the Broker hands the
genuine holder's verified arrival to the Person you made. Nothing asks whether the Person being
joined holds that address affirmed, and no configuration can: `idp-create-user-if-unique` matches on
the address alone, exactly as `idp-auto-link` does.

Refusing the verified arrival instead was rejected. It trades a takeover for a lockout of the same
victim, who could then never sign in at their own address. Giving that arrival a Person of its own
needs two Persons at one address, which the realm forbids by signing in with email.

So what is refused is the **address**, not the Person: an Identity whose source did not affirm its
address does not keep it. The Person created for it holds none, and the Broker asks for one and
confirms it by mail — the sentence at the top of this record, applied where a Person is made and not
only where one is joined. Every Person's address is then affirmed by their Identity Source or by the
Broker, which is what makes the address safe to join on at all.

**The address is removed rather than never written, and that is the weaker form of the claim.** This
realm signs in with the address as the username (ADR-0005), so Keycloak reads the username off the
address and will not create a Person at all without one. So the Person is created holding the
address and `broker/verified-email/` takes it off them in the same request, before anything is
committed: no Person who *exists* holds an address nobody affirmed, which is what the join needs,
rather than no Person ever being created at one.
`docs/notes/2026-11-20-withholding-an-unaffirmed-address.md` has that measurement and the rest.

**What the rule costs a Person**, which is a price rather than a defect: an Identity whose source
affirms no address at all is asked for one twice in a single sign-in, once to give Keycloak a
username and once to have it confirmed. ORCID is that shape (`issue #19`).

**A Person who never answers is not stranded.** Keycloak writes the Identity's link whether or not
the flow finished, so the next arrival through the same source reaches that same Person and is put
back on the page asking for an address. No second Person is made, so an abandoned arrival accumulates
nothing. Until an address is confirmed that Person reaches no Brokered App.

**The Broker's own registration is the half still open.** It creates the Person at the typed address
before the mail is answered, so a registration nobody confirmed still absorbs a later verified
arrival at it. That is not a takeover — the Person it makes holds no credential and no way to set one
without the mailbox — and `issue #148` owns it. Until it is closed, nothing may assume that the
address a Person holds was affirmed by anybody.
