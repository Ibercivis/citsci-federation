# A pre-existing account links to a Person on arrival, when both sides are verified

A Brokered App records an Account Link between one of its own existing accounts and a Person when an
Identity arrives through the Broker carrying a Verified Email that account already holds
**confirmed**, and when the arrival answers a page that asks before anything is written. Nothing
links on an address alone, nothing links an address the application never confirmed, and nothing
links in bulk.

**No application enables it during the pilot.** Migration is outside the pilot's committed scope and
ADR-0007 keeps each application's own sign-in with no sunset date, so the switch waits. What this
record settles is the rule, which was already written three times — `R1` in
`docs/migration/geonity.md`, `R1` in `docs/migration/lostatnight.md`, and `R4` in the record for
OpenRed, which states it incompatibly. INT-001 in the internal register is the same question asked
from the applications' side.

## Who initiates

The Person, by arriving. The evidence this rule rests on is control of a mailbox, and only an
arrival demonstrates it; an operator holds nobody's mailbox and can produce the evidence for no one.

Arriving is not consent on its own. Somebody may want a separate Person at an address they already
use at that application, and ADR-0007 obliges the application to say what happens at the point of
choice rather than afterwards. So the application asks, where it shows the refusal today, and links
on the answer.

An arrival that declines is left where ADR-0007 already leaves it: refused, because the application
holds one account per address, with its own sign-in working as before. Declining is not a route to a
second account at the same address, and the page says so rather than implying a choice between two
accounts.

## What evidence is enough

Two facts, and neither alone:

- **The arriving Identity's Verified Email**, as the Broker's claim states it rather than as an
  address the Broker passed on. ADR-0004 is what makes the claim worth reading: the condition in
  `broker/verified-email/` holds back a join the arriving source did not affirm.
- **The application's own confirmation of the same address, on the account being linked.** This
  half is the application's to check. `django-allauth` documents the provider's side and checks
  nothing locally, so the guard is code in each application.

The local half carries the whole risk, and it runs opposite to the direction anyone watches for:
register at somebody else's address, never confirm it, and wait for the holder of that mailbox to
arrive. Without the guard, the arrival is signed in to the squatter's account, and the squatter
still knows its password. The attacker is inside before the victim gets there.

Nothing stronger than a confirmed address is asked, and the reason is that nothing stronger would
buy anything. Whoever holds the mailbox can already take the account by requesting a password reset
from the application. Linking on a confirmed address therefore grants no access the reset mail does
not already grant — the same risk ADR-0004 accepted knowingly for the join, named there as whoever
controls a mailbox can become that Person.

### What the arriving half still depends on

ADR-0004 closes by withdrawing the assumption this rule reads: the Broker's own registration creates
a Person at a typed address before the mail is answered, so **nothing may assume that the address a
Person holds was affirmed by anybody** until `issue #148` is closed. That is the one prerequisite
this rule has in the Broker rather than in an application, and it is a condition on enabling the
link rather than a reason to write the rule differently. An application that turns this on while the
Broker's own registration still hands out unaffirmed addresses has rebuilt the squatter takeover on
the other side of the frontier. **No application enables the link before `issue #148` closes.**

### The accounts that cannot produce it

- **An address nobody ever confirmed.** No link. A human confirms it or disables the account first,
  and that is the population this rule exists to exclude.
- **An account whose only way in is the application's own Google button.** It can usually produce
  the evidence: `django-allauth` records the address as confirmed on the provider's word when such
  an account is made. It is no exception to the rule, only to the order — closing that button
  before the link exists locks the Person out of their own contributions, which each migration
  record already sequences. An account of that shape whose address was never recorded as confirmed
  is the case above, and it is a human's.
- **An account at an address no Identity of that Person carries.** Nothing links, and nothing is
  wrong. Two unrelated addresses are two Persons (ADR-0004); this rule is not a merge and repairs
  none of that.
- **An address the application holds on more than one account.** Refuse and let a human choose. A
  rule that picked would pick silently.

## Where the link is stored, and who may undo it

In the application, beside the account that already exists: the Person Identifier added to that
account, and nothing re-keyed, so the Person keeps every contribution they already had.

**The Broker stores nothing about it.** It records Identity Links and has never seen an
application's rows. An Account Link cannot be stated
without naming an object inside a Brokered App, which is the line ADR-0011 draws for authorisation
and the same line here: to hold one, the Broker would have to mirror the domain it authenticates
for.

Detaching is an administrator's act, and only once the account has a way in that does not pass
through the Broker. The account most in need of a link is the one holding no usable password, and
detaching that one strands it — the same lockout as closing the application's Google route too
early. There is no self-service detach.

**What detaching gives back is the account, not two accounts.** Work done after the link was made is
indistinguishable from work done before it: it hangs off one account either way, and nothing records
which rows arrived by which route. OpenRed's record says the same of connecting two accounts. So a
detach returns the account whole to whoever holds its remaining credential, and undoes nothing else.

## What it costs each application, and why this rule earns it

It costs code, and how much depends on the application's shape. Where sign-in is `django-allauth`'s
own browser flow, the behaviour is two settings and the guard beside them. Where an API redeems the
code with `dj-rest-auth`, the link is refused outright today, so enabling it is code on the Broker's
path, and the page that asks is one the API's own front end does not have yet. Each migration record
says which of the two its application is.

ADR-0016 reads a rule only hand-written protocol code in each application can satisfy as evidence
against the rule. This is not that rule, on three counts:

- **It is not protocol code.** The guard reads the application's own account rows. The Broker cannot
  see them, must not hold them, and so no configuration anywhere could take this over. A rule the
  Broker could enforce itself would not be written in an ADR about what applications do.
- **It is checked by whoever writes it.** The nonce ADR-0016 refused would have been sent and never
  read. This guard decides whether a link happens, so it cannot be present and inert.
- **It is paid once, by the maintainer who wants it.** The nonce would have been a cost on every
  future integration, for a protection the client shape could not use. This is paid during one
  application's own migration, by the person who asked for their accounts to move, and an
  application that never migrates never writes it.

## Considered Options

- **Linking on the two verified facts and nothing asked**, which is what the library's settings do
  once the local guard is in place. Rejected: it takes the choice ADR-0007 promises the application
  will offer, and from the Person's side it is indistinguishable from the application deciding who
  they are.
- **An operator-run pass over a population.** Rejected: the evidence is a mailbox and the operator
  holds none of them. It also needs populations counted in a production database, which exist for
  one of the three applications; a design that cannot be written until somebody has read three
  production databases is a design nobody writes.
- **Linking as an act that proves control of both accounts** — sign in locally, sign in through the
  Broker, link from inside that session. Rejected as the rule. It is better evidence and much more
  surface, and it asks the population that most needs linking for the one thing it does not have: a
  local password. Where both halves do exist it adds nothing over the reset mail, which is the
  argument above. An application may still require it, and then its migration record says so and
  carries the reason; what no application may do is decide this at integration time, which is the
  divergence this record exists to stop.
- **Leaving the design undecided for the pilot**, which the issue offered. Rejected: the rule is
  written three times already and two of those versions disagree, so undecided means the fourth
  application writes a fourth version. Deferring the *switch* costs nothing and is what this record
  defers instead.

## Consequences

**This reverses `R4` in OpenRed's record**, which says linking is an act of whoever owns both
accounts and *never a match on address alone*. Under this rule the address match is most of it: what
is added is the application's own confirmation and an answer on a page, not a demonstration that the
Person holds the local credential. That record is on `issue #30`'s branch and not yet on `main`, so
until it lands one record still contradicts this ADR. `R1` in `docs/migration/geonity.md` and
`docs/migration/lostatnight.md` point here already, and what stays in each record is what that
application must do before the switch, which is the part that genuinely differs.

**ADR-0007's refusal stays the behaviour** until an application enables the link, and the cost that
ADR names — somebody with an existing account cannot reach it through the Broker — now has a named
end for every account whose address the application confirmed. For an account it never confirmed the
refusal is the end state until a human acts.

**The pilot's arithmetic does not move.** Linking removes no password store, because that sign-in
survives it (ADR-0007). An application whose accounts all link holds exactly the passwords it held
before, and the decision that would remove them is one this pilot does not take.

**Nothing enforces this where it is written.** The rule lives in three applications' code, no claim
carries it, and no configuration in this repository would show an application disobeying. What can
see it is a browser: ADR-0010 took the registration closure off the unverifiable list that way, by
driving the application's own front end, and an arrival at an address the application already holds
is a case of the same shape. It belongs in this repository's suite (ADR-0010) the day an application
enables the link, and until then there is nothing to assert.
