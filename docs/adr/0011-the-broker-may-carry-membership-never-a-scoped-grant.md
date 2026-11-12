# The Broker may carry membership, never a scoped grant

Authorisation separates into three kinds of statement, distinguished by who the authority is and how
fast the answer changes:

| | Authority | Where it lives | Changes |
|---|---|---|---|
| **Identity** — this is that Person | the Broker | the Broker | never |
| **Membership or qualification** — one of the foundation's people, holds an accredited identifier | the organisation, or an external body | **may** federate | months |
| **Scoped grant** — researcher *on this project*, may see *this dataset* | the project | only where the scope lives | weeks, per scope |

The Broker carries the first and may one day carry the second. **It never carries the third.** The
discriminator is one question: *can the grant be stated without naming an object that lives inside a
Federated App?* "Is one of the foundation's people" can. "Coordinates that light-pollution campaign"
cannot, because the campaign is an entity in some application's own domain, and for the Broker to
carry it the Broker would have to mirror that domain.

There is also a mechanical reason, which is not a matter of taste. A token is a snapshot. A
membership that changes every few months tolerates being carried in one; a project grant that has to
stop applying the moment it is revoked does not, and a person who belongs to a hundred scopes would
carry a hundred claims so that almost none of them is read. **Carry what changes slowly, query what
changes fast.**

**The pilot implements none of this.** ADR-0003 stands exactly as written: roles stay local to each
Federated App, the Broker emits no role and no entitlement claim, and nothing about authorisation
crosses it. This ADR adds no scope to the pilot. It exists because the options that a later
implementation will reach for first are the wrong ones, and the reasons are not obvious enough to
re-derive under deadline.

## Considered Options

The five applications in the pilot were read for this in November 2026, so the options below are
weighed against what is actually there rather than against what a federation usually looks like.
Three facts from that reading decide most of it: no application uses group or model-level permissions
at all; the one role-like flag they share means something materially different in each, ranging from
no authority in the API whatsoever to complete moderation of everything; and **every scope in every
application is an object inside that application** — not one of them crosses an application boundary.

- **The Broker emits role claims.** The obvious option, and what most federations do. Rejected on
  evidence rather than on principle: the one role-like flag these applications already share does not
  mean the same thing in any two of them, so a common claim would need an authorisation vocabulary
  spanning every application, maintained by nobody. It also fails in the wrong direction — each new
  application makes a shared vocabulary harder, so the cost grows exactly where the federation is
  supposed to get cheaper.
- **A federation-level registry of projects**, so that a scope can span applications. Rejected
  **now**, on the evidence that no scope in any of the five crosses an application today. Kept as the
  named answer if one ever does, with the note that it would be a shared *domain* service and not an
  authorisation one: the Broker would stay identity-only either way.
- **A group per project in the Broker, emitted as a claim.** This is the trap, and it is rejected
  explicitly because it looks free. The Broker would become a shadow registry of the scientific
  domain, with a lifecycle that is not its own: something has to create the group when a project
  starts and remove it when the project closes, and the Broker is the last place that learns either.
- **Centralise the existing staff flag now.** Rejected on sequence, not on direction. With no
  intermediate role between an ordinary account and that flag anywhere in the applications, mapping a
  central membership onto the only flag available would hand whoever holds the membership complete
  moderation in at least one application. **An intermediate local role is the precondition**, and it
  belongs to each application, not to us.
- **Decide nothing until it is implemented.** Rejected: that is what leaves the next person reaching
  for the group-per-project, which is the cheapest-looking and worst of the options here.

## Consequences

**Nothing is built, and the pilot's promise to the applications does not change.** ADR-0007 amended
that promise to "the authentication hook and the registration link", and this decision does not add a
third item to it. What follows is what we would want to be true when an implementation is eventually
written — for our own applications as they gain an intermediate role, and as advice to whoever
implements the federated half. It is not an ask inside the pilot.

**The cheap thing to get right is where a local grant is written down.** A grant indexed by Person
Identifier — already the only identifier an application gets — and kept as versioned configuration
rather than a row somebody edited by hand is the difference between a later projection being a diff
and being a migration with no inventory. It also makes "what can this person do across the
foundation" answerable by reading files, which is the question local roles cannot answer today.

**This cut is what lets applications we do not control join without friction.** That is the point
most worth keeping: a coarse membership claim can be consumed by an application whose authorisation
model we have never seen, because the application maps it to whatever it already has. A role claim
cannot — it would require them to adopt our vocabulary, which is precisely the friction the
federation exists to remove. External applications will have their own notions of scope and
membership, and the design asks nothing of them: we do not model theirs, we emit something coarse
enough that they can map it, and they keep their own.

**So the flexibility is bought by emitting less, not by building more.** Named here so it is not
mistaken for a licence: a policy engine, a permission ontology, a group hierarchy mirroring the
domain and an entitlements API are all refused. The federation stays adaptable because the claim is
small, and a small claim is also the only version of this that can ship.

**Conditions attached to the deferred option.** If membership is ever federated, two things stop
being optional. ADR-0004 knowingly accepts that whoever controls a mailbox can become a Person, which
is tolerable for a contributor and not for someone holding authority in several applications — so the
per-action assurance check that ADR-0003 reserves becomes a requirement for whoever holds the
membership. And no `Organization` entity exists in the pilot, as the spec records; membership would
be the first thing to need one.

**What would reopen this**, so that deferral has an end condition rather than being indefinite: a
scope that genuinely spans applications; the first external application that asks us for
authorisation rather than identity; or an offboarding missed in an application, which is the failure
local grants cannot prevent and the strongest argument for central membership.

**A naming hazard, recorded now because it is cheap now.** Three of the applications already have an
entity called `Project`, and the three are unrelated to each other. Whatever a federated scope is
ever called, it cannot be that.
