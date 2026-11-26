# Spec — Data aggregation and the Catalogue

## Problem Statement

A person who takes part in two Ibercivis projects has two separate records of having taken part. Each
application counts its own participants, in its own words, against its own clock. Nothing adds them
up, and nothing can: there is no place that holds "this Person contributed here and there", and no
agreed meaning for the number each application would offer.

For the person, the consequence is that contributing to a second project starts them from zero. The
Broker already makes them one Person across the applications (ADR-0002), and nothing yet uses that.

For the foundation, the question that cannot be answered is the simplest one anybody asks: *how many
people take part in Ibercivis citizen science?* Each application can answer for itself, but the
answers are not of the same kind — one counts registered accounts, another counts accounts that did
something, one counts by the contributor's device clock and one by the server's — and summing them
would double-count anybody in two projects. A figure assembled by hand from three dashboards is a
figure nobody can defend, and it is stale the day it is written.

The same gap blocks the things built on top of it. There is no way to show a person their
participation across projects, no way for a researcher to compare projects knowing what each number
means, and no way to answer "may we name this contributor?" without re-reading four legal documents.

The current spec lists this as out of scope under "Resource discovery and streaming". This spec is
what replaces that bullet.

## Solution

One **Catalogue**: a service that holds aggregated **Measures** about the **Applications** in the
programme and about the **Persons** who take part in them. It never holds the observations
themselves — only named, dated, defined values that an application asserts.

The Catalogue publishes a **contract**: a versioned document with a fixed shape. Each application
that wants to contribute serves that document from one endpoint of its own, mapping its internals
onto it. The Catalogue reads those endpoints on a schedule. We do not read anybody's database, and
no application is asked to adopt our vocabulary beyond the few fields the contract names.

Being read is a **second, optional capability**. An application may be a **Brokered App** (it
delegates authentication) without being a **Data Contributor** (it publishes Measures), and the
reverse: an application we do not control, with no account at the Broker at all, can be a Data
Contributor. ADR-0007's promise — the authentication hook and the registration link, and nothing
else — is not enlarged by this spec.

A Measure is never a bare integer. It carries its name, its value, the date it is as of, the
**definition** the application used, which clock that definition was counted against, and whether
**Anonymous Contributions** are inside it. Two applications reporting "1,200 participants" with
different definitions stay legible instead of being summed into a figure that means nothing. The two
measures in the first increment, `projectParticipantsTotalRegistered` and
`projectParticipantsNumberOfActive`, are borrowed verbatim from PPSR Core; each application declares
which of the two it can actually count.

Reading is **role-aware, and filtered on the server**. Every Measure carries a mandatory
**Sensitivity Label** applied at ingest, and an unlabelled Measure is rejected rather than assumed
public. A small policy table says which labels a role may read. The response never contains what the
caller may not see, so no frontend implements permission logic — the moment two of them filter
independently, one is wrong and the leak appears in no test. A **Steward** may read any Person's
Measures, and every such read is recorded.

The first increment is deliberately small: an application's name and how many participants it has,
for the phase-one demo. The long-term target is a richer project-metadata schema. The point of the
design is to make the small start without foreclosing the large one, which is why the contract is
coarse, versioned, and keyed on each application's own slug rather than on anything the Broker
issues.

**What this costs the applications being integrated** is one endpoint and the mapping behind it. No
migration, no index, no tombstone table, no change feed. That is the whole ask, and it is the
criterion the design was chosen against.

## User Stories

### A Person taking part

1. As a Person contributing to two projects, I want one place that shows what I have taken part in, so that my second project starts from my history rather than from zero.
2. As a Person, I want my participation shown per application as well as in total, so that I can see where my contributions actually went.
3. As a Person in two applications, I want to be counted once and not twice, so that the figure describes people rather than accounts.
4. As a Person, I want to know what each number counts before I compare it to another, so that I do not read "active" in one project as the same thing as "active" in another.
5. As a Person, I want each figure to say when it was computed, so that I can tell a current answer from a month-old one.
6. As a Person who contributed anonymously, I want those contributions left out of anything attributed to me, so that choosing anonymity means what it said at the time.
7. As a Person who asks an application to erase me, I want to disappear from the Catalogue too, within a window somebody has written down, so that erasure is not undone by a copy nobody mentioned.
8. As a Person, I want nothing about my participation published by default, so that taking part is not the same as being listed.
9. As a Person who is **Hidden** in an application, I want the Catalogue not to undo that choice, so that visibility stays decided where I decided it.
10. As a Person holding a tier or a diploma in one application, I want the Catalogue to point at it rather than invent a second scale for the same thing, so that nothing contradicts the diploma I already hold.
11. As a Person, I want to know who is able to read my Measures, so that I can judge what taking part exposes.
12. As a Person, I want every read of my Measures by a Steward to be recorded, so that misuse can be found after the fact rather than denied.
13. As a Person, I want the Catalogue to need no new account and no second password, so that it costs me nothing to be in it.
14. As a Person whose application reports a figure the Catalogue cannot label, I want that figure withheld rather than guessed at, so that a classification mistake does not become a disclosure.

### A Steward

15. As a Steward, I want to read the Measures of any Person across the applications, so that I can answer a support question without an account in each one.
16. As a Steward, I want my reads recorded, so that holding this membership is auditable and not simply trusted.
17. As a Steward, I want this membership to grant me nothing inside any Brokered App, so that acting for the foundation is not the same as moderating somebody's project (ADR-0011).

### A researcher

18. As a researcher, I want participant counts per application with their definitions attached, so that I can state what my comparison rests on.
19. As a researcher, I want to know which clock each count was taken against, so that I do not mistake a client-supplied timestamp for a server one.
20. As a researcher, I want to see that two applications define "active" differently rather than have the difference averaged away, so that the comparison is honest.
21. As a researcher, I want to know what each application's cession permits — nothing, anonymous aggregate, or named attribution — so that I can tell what I may publish without re-reading four legal documents.
22. As a researcher building a cross-application total, I want it to inherit the most restrictive licence among its parts, so that I do not publish a figure that discloses something one application never permitted.
23. As a researcher, I want the figures requested by time range, so that I can ask for a period rather than for everything.

### Anyone reading in public

24. As a visitor, I want to see how many participants an application has, so that I can judge the size of what I am being invited into.
25. As a visitor, I want to see nothing about any individual Person, so that the public view cannot be mined.
26. As a visitor, I want the public figure to carry the date it was computed, so that I am not shown a stale number as a live one.

### A Data Contributor maintainer

27. As a Data Contributor maintainer, I want one documented contract and one endpoint to serve it from, so that integrating is a feature and not a project.
28. As a Data Contributor maintainer, I want to decide for myself whether I compute on demand or serve something precomputed, so that the choice follows my own load and not somebody else's design.
29. As a Data Contributor maintainer, I want to declare which of the measures I can actually count, so that I am not forced to fabricate one I cannot.
30. As a Data Contributor maintainer, I want to declare the clock I counted against, so that an unavoidable weakness in my data is visible rather than hidden.
31. As a Data Contributor maintainer, I want to need no schema change, no new index and no tombstone table, so that joining does not mean three migrations.
32. As a Data Contributor maintainer, I want nobody reading my database, so that my internals stay mine to change.
33. As a Data Contributor maintainer, I want a conformance harness I can point at my own endpoint, so that I find out it is wrong before anybody pulls from it.
34. As a Data Contributor maintainer, I want a breaking change to arrive as a new contract version, so that my endpoint does not stop being valid overnight.
35. As a Data Contributor maintainer, I want my application keyed by my own stable slug, so that re-registering with the Broker does not orphan my data.
36. As a Data Contributor maintainer, I want to know the pull cadence and roughly what it costs me to answer, so that I can size the endpoint.
37. As a Data Contributor maintainer, I want my deletions to propagate without my building a change feed, so that correctness does not depend on my emitting events I cannot emit correctly.
38. As a Data Contributor maintainer, I want to publish Measures without delegating authentication, so that contributing data is not a reason to replace my sign-in.
39. As a Brokered App maintainer who does not want to publish anything, I want delegating authentication to stay exactly as cheap as it is, so that the promise made to me is not enlarged after the fact (ADR-0007).
40. As a maintainer of an application nobody at Ibercivis controls, I want to join without any change to the Catalogue, so that being outside the organisation is not a special case.
41. As a Data Contributor maintainer, I want a failed pull to leave the previous answer marked for what it is, so that my downtime does not present stale data as fresh.
42. As a Data Contributor maintainer, I want the contract to stay coarse, so that every application added does not widen what I have to map.

### The Catalogue operator

43. As the operator, I want a full reload to be idempotent, so that running it twice is safe and running it is the recovery procedure.
44. As the operator, I want absence from a document to mean deleted, so that an erasure propagates by construction rather than because somebody remembered.
45. As the operator, I want a shorter, fresher window that overwrites, so that recent figures move without a full reload every time.
46. As the operator, I want the reload cadence to be configuration with its legal meaning written beside it, so that nobody slackens it as an operational tweak.
47. As the operator, I want an unlabelled or malformed document rejected with a message naming the application and the field, so that fixing it does not need a debugging session.
48. As the operator, I want one application's failure to leave every other application's data intact, so that a partial reload is partial and not destructive.
49. As the operator, I want to see which applications answered, when, and what each one said it was as of, so that I can tell a quiet failure from a quiet period.
50. As the operator, I want to add a role by changing a policy table, so that a new role is not a deployment of new filtering code.
51. As the operator, I want to add an application by configuration alone, so that the fourth costs what the third did.
52. As the operator, I want the Catalogue to hold no personal data beyond the Person Identifier and the Measures keyed to it, so that the blast radius is small and stays small.
53. As the operator, I want the whole service declared as code and recreatable, so that losing the machine is an inconvenience (parity with the Broker).

### Ibercivis

54. As Ibercivis, I want one defensible figure for how many people take part across our projects, so that we can answer the question we are asked most often.
55. As Ibercivis, I want that figure to carry its definitions, its clock and its treatment of anonymous contributions, so that it survives being questioned.
56. As Ibercivis, I want to know per application whether we may attribute contributions by name, so that an export is a field lookup rather than a legal review.
57. As Ibercivis, I want the demo to show an application's name and its participant count, so that phase one shows something real rather than a diagram.
58. As Ibercivis, I want the small start not to foreclose the richer project-metadata schema, so that the second increment is a new contract version and not a migration.
59. As Ibercivis, I want no commitment to migrating existing accounts implied by any of this, so that recording a requirement is not agreeing to meet it.
60. As Ibercivis, I want applications outside our control to be able to join, so that the Catalogue describes citizen science rather than describing us.

### Whoever answers for data protection

61. As the person answering for data protection, I want an erasure in an application to propagate to the Catalogue within a stated, defensible window, so that our copy is not the reason an erasure is incomplete.
62. As the person answering for data protection, I want the cadence to have a reason recorded, so that "monthly" is a decision and not an accident.
63. As the person answering for data protection, I want every Measure to carry a sensitivity classification from the moment it is ingested, so that nothing is classified retrospectively by whoever is looking at it.
64. As the person answering for data protection, I want every read of one Person's data by another recorded, so that the log exists before it is needed.
65. As the person answering for data protection, I want no publication of a Person's Measures until its consent text is written, so that the control is designed after the wording rather than before it.
66. As the person answering for data protection, I want the Catalogue to store no observations, so that the sensitive material stays in one place per application.

### The project team

67. As the team, I want the decisions here recorded as ADRs, so that the next session does not re-derive them under deadline.
68. As the team, I want one role-aware read API, so that no frontend is a second place where permission logic can be wrong.
69. As the team, I want the schema drafted before the per-application study, so that we do not end up with the union of what five particular applications happen to have.
70. As the team, I want a named reason to refuse enrichment of the contract, so that "while we are here" does not widen it.
71. As the team, I want why change events were rejected written down with its evidence, so that it is not proposed again every quarter.
72. As the team, I want each deferred item to carry an owner and the condition that reopens it, so that deferral ends rather than drifts.

## Implementation Decisions

### Shape and ownership

- **The Catalogue is its own service, with its own database, outside the Broker.** It need not resemble a Brokered App internally. The Broker stays identity-only: this is the shared **domain** service ADR-0011 named as the answer if a scope ever spanned applications, not an authorisation one.
- **Where its source lives is deferred to its own ticket** — a new repository or a directory here. Nothing in this spec depends on the answer, and the question is about release and ownership rather than design. What is decided: it is declared as a service of the **Brokered Composition** (ADR-0009) wherever its source sits, because the one assertion no repository can host alone needs a real Broker and a real Catalogue running together.
- **Two capabilities, independently grantable: Brokered App and Data Contributor.** An application may hold either without the other. This is what keeps ADR-0007's promise intact for an application that only wants sign-on, and what lets an application with no Broker client at all contribute data.
- **An application is keyed by its own stable slug, never by the Broker `client_id`.** A `client_id` moves, and a Data Contributor that is not a Brokered App has none. Same reasoning as ADR-0001: a configuration value that becomes load-bearing data is a value you can no longer change.
- **Adding an application requires no change to the Catalogue.** The scope it is sized for is the five Ibercivis applications, plus Observatorio and CitSciSort, plus applications we do not control. Anything that would need a code change per application is the wrong design here, and this is the test to apply to a proposal.

### Who adapts to whom

- **The Catalogue publishes a schema; each application maps its internals onto it.** We do not read their databases. The friction this puts on an integrating application is accepted knowingly, in exchange for not modelling five internal schemas — and for not breaking when one of them changes.
- **The contract stays coarse. This is the thing to protect when somebody proposes enriching it.** ADR-0011's argument transfers exactly: something coarse can be consumed by an application whose model we have never seen; something fine-grained requires them to adopt our vocabulary, which is the friction this programme exists to remove, and it gets worse with every application added. The flexibility is bought by asking for less, not by building more.
- **The schema is drafted first; the per-application study comes after.** The study's job is to find what each application can map onto the schema, never to tell us what the schema should contain. Designing from the five applications yields the union of what five particular applications happen to have, which is the vocabulary that grows with every integration.

### The contract

- **The contract is a document with a shape and a version.** The transport is specified separately, so that changing the transport is an operational decision and not a schema one.
- **Each Data Contributor serves the document from one live endpoint.** Whether it computes on demand or serves a precomputed answer is the application's own choice, and the contract says nothing about it.
- **The document is complete, never incremental.** Absence of a datum means **deleted**, not "unchanged". A full reload is therefore idempotent, which is what makes an erasure propagate by construction rather than by anyone remembering to emit it.
- **`generated_at` is load-bearing**: it is when the data was computed, not when the response was sent. Without it a cached answer presents itself as fresh. A document that omits it is malformed.
- **A Measure carries six things**, and never fewer:

  | Field | Why it is mandatory |
  |---|---|
  | name | from the borrowed vocabulary, so two applications' figures are of the same kind or visibly are not |
  | value | the figure itself |
  | as-of date | what period or instant the value describes |
  | `definition` | free text: what this application actually counted. PPSR Core itself refuses to define "active" and delegates it to each project |
  | clock | which clock the definition was counted against — server time, or a contributor-supplied timestamp |
  | includes anonymous | whether **Anonymous Contributions** are inside the figure |

  A count without its definition is not a datum. A bare integer is rejected at ingest.
- **The two first measures are `projectParticipantsTotalRegistered` and `projectParticipantsNumberOfActive`**, borrowed verbatim from PPSR Core. Each application declares in `definition` which of the two it can actually count. **No third measure of our own**: inventing one at the very first datum would abandon the borrowed vocabulary before it has been used once.
- **Field names come from PPSR Core where it has one, and are extended where it does not. No conformance is claimed, and nothing is validated against its JSON Schema** — the reasons are in Further Notes, and they are specific to that artefact rather than general scepticism. The vocabulary is provisional and may be replaced when the schema goes fine-grained.
- **A typology is preserved where it can be mapped onto one somebody else maintains** (Darwin Core, for instance), with free text as the fallback. A typology we invent is the trap the coarseness rule exists to avoid: we would then maintain it.
- **The Application entity carries what that application's cession permits**: nothing / anonymous aggregate / named attribution. So "may we attribute this?" is a field lookup rather than four legal documents re-read each time.

### Ingest

- **Pull, provisionally.** The Catalogue reads; applications do not send. Revisited in firm once all five are integrated and the friction is known.
- **Periodic full reload, plus a shorter fresher window that overwrites.** Documents are requested by time range — month by month or year by year when a full reload is wanted.
- **Change events are rejected**, and not on grounds of convenience: no application can emit correct ones today. The evidence is in Further Notes. Emitting them would cost each application a change timestamp, an index on it, and a tombstone for deletes — three migrations to replace a query that takes under a second. Under ADR-0016's reasoning, a rule only hand-written protocol code in each application can satisfy is evidence against the rule.
- **Explicit assumption: these applications have no real-time requirement.** This single sentence licenses the whole simple architecture, and it gets its own ADR for that reason. It is the first thing to re-read if anyone asks for a live dashboard.
- **A deleted datum may survive until the next full reload.** Accepted knowingly, with one consequence recorded: the reload cadence is therefore **a parameter with legal meaning**, not an operational one. Monthly sits at the limit the GDPR treats as reasonable; a slacker cadence would not be defensible. It is configuration, and the reason travels with it.
- **A failing Data Contributor does not damage anybody else's data.** A reload is per application; what cannot be fetched keeps its previous value, marked with the `generated_at` it actually has, and the failure is visible to the operator.
- **Ingest rejects rather than repairs.** A document missing `generated_at`, a Measure missing its definition or its clock, an unlabelled Measure, an unknown slug: refused with a message naming the application and the field. Nothing is defaulted.

### Permissions

- **Roles live in the Broker, coarse and slow-changing.** Foreseen: administrator, researcher, public. **This supersedes ADR-0003's consequence** that nothing about roles crosses the Broker. It is ADR-0011's reserved option being activated, not overturned: each of those roles can be stated without naming an object inside a Brokered App, which is ADR-0011's own discriminator. Anything that names a team, a project or a dataset stays in the data layer. Carry what changes slowly, query what changes fast.
- **The role claim is emitted to the Catalogue's client only.** A Brokered App's tokens carry no role and no entitlement, exactly as now. This keeps ADR-0003's promise to the applications as written, keeps ADR-0007's integration cost unchanged, and keeps the existing assertion at seam 1 true for every Brokered App client. The Catalogue is the one audience that asked for a role, so it is the only one that gets one.
- **A Steward is a Person who may read the Measures of any other Person.** A membership, not a scoped grant: it says someone acts for the foundation, names nothing inside any Brokered App, and therefore grants nothing in one. **Every such read is recorded.** An access log is cheap now and impossible to reconstruct later.
- **Every Measure carries a mandatory Sensitivity Label, applied at ingest.** Anything a Person could object to under the GDPR enters as personal. **An unlabelled Measure is rejected and never assumed public.**
- **Role to readable labels is a small policy table, not an engine.** Adding a role, or a team-level distinction later, changes the table and not the data already ingested. A policy engine, a permission ontology and an entitlements API are refused by name, for the reason ADR-0011 gives.
- **One role-aware read API, filtered server-side.** The response never contains what the caller may not see, rather than returning it flagged for the client to hide. Frontends implement no permission logic: the moment two of them filter independently, one is wrong and the leak appears in no test.
- **No public exposure of a Person's Measures by default.** A control that publishes them is a later decision, and **its consent text is written before its code**. The reasoning rests on an entry in the private findings register; the rule it motivates is stated here without it.
- **No `Achievement` entity.** A badge or a level is a **reading** of the Measures, not a stored row; two sources of truth for "your level" is a recalculation every time the rule changes. The Catalogue also never restates an application's own badge or tier — it links to it. One application already has a full tier, medal and diploma system, and a second scale for the same thing would contradict a diploma somebody already holds.

### Rights

- **An aggregate inherits the most restrictive licence among its parts.** A cross-application total of 60 where 40 come from an application that permits nothing is not publishable, because the other 20 would have been inferable.
- **Attribution text belongs to a licence instance. The Person Identifier is never attribution.** Borrowed from STAplus 1.0.1's normative rule, and it agrees with ADR-0002's reasoning: the identifier is opaque and permanent precisely so that it is not a name.
- **Named attribution is closed by default.** As established on 2026-11-26, only one of the applications carries a rights grant a contributor actually agreed to. Opening it for the others needs their terms of use revisited, which is each application's work and not the Catalogue's — and it is what unblocks the export the stakeholders want.

## Testing Decisions

### What makes a good test here

A good test drives the Catalogue **over HTTP, exactly as a caller would**, and asserts only what such
a caller can observe: the documents it accepts, the responses it returns, the fields it refuses, the
errors it names. It never reads the Catalogue's database to assert, never calls an ingest function
directly, and never asserts the shape of internal configuration as a proxy for behaviour.

The test of a good test: **it would still be meaningful if the Catalogue were rewritten in another
language on another database.** Anything that would have to be rewritten in that case is testing the
implementation rather than the decision. This is the same rule the Broker's suite is held to.

### The primary seam lives with the Catalogue

**Decided: the Catalogue's own codebase holds its tests**, at one seam — its HTTP surface. Ingest is
driven by a **stand-in Data Contributor** serving fixture documents, the way the **Mock Identity
Source** serves fixture claims in this repository: a service that exists only so a test can decide
what the other side says. Reads are driven by callers presenting each role.

What is asserted there:

- **A full reload is idempotent** — running it twice leaves the same answer.
- **Absence means deletion.** A datum present in one document and absent from the next is gone after the reload, with nothing remembered about it.
- **A partial failure is partial.** One Data Contributor failing leaves every other application's data intact and its own previous value in place, with its real `generated_at`.
- **`generated_at` survives ingest unchanged**, and a document without one is refused.
- **An unlabelled Measure is refused**, and the refusal names the application and the field. Likewise a Measure without a definition, without a clock, or with a bare value.
- **An unknown slug is refused**, and re-registering an application's Broker client changes nothing about its data.
- **The read API filters by role**, and the filtered fields are **absent** from the response rather than present and flagged. One case per role in the policy table, including `public`, which sees no Person at all.
- **A Steward's read of another Person's Measures is recorded**, and the record survives the response.
- **An aggregate carries the most restrictive licence among its parts**, and an aggregate drawing on an application that permits nothing is not offered as publishable.
- **A Person in two applications is counted once** across the aggregate, keyed on the Person Identifier.
- **A time-range request returns that range**, and a range with no data is an empty answer rather than an error.
- **An application added by configuration alone** appears in the Catalogue with no code change — the scaling claim, asserted rather than asserted-to.

### One assertion stays in this repository: the crossing

The Catalogue's own suite can stub the Broker, and should, for everything above. What it cannot host
is the claim that spans both services, so **this repository asserts exactly that and nothing more**,
in the style ADR-0010 established:

- A **real Broker-issued token** carrying a role reaches the **real Catalogue** in the composition, and the response is filtered to that role.
- A **Brokered App's** token still carries **no role and no entitlement claim**, anywhere — the existing assertion, kept, now meaning that the Catalogue's role claim did not leak into the applications' tokens.

Prior art: the stand-in Brokered App helper and the claim-absence case already in the suite, and the
helper that asks Docker which stack is up rather than assuming.

### Seam 2 grows by two rows

The declared-versus-running guard gains: the roles the realm declares are the roles it is running,
and the role claim's audience is the Catalogue's client and no other. That is drift nothing else can
see, and it is the only addition — seam 2 stays deliberately minimal.

### A conformance harness is part of the contract, not of our suite

The contract ships with a harness a Data Contributor maintainer points at **their own endpoint**,
which reports what is malformed in their words. It is the cheapest way to keep the integration cost
honest, and it is what stops the first pull being the first test. It is not run against a real
application's live endpoint from our CI: that is somebody else's data and somebody else's uptime, and
a red build we cannot fix teaches nothing.

### Seams deliberately rejected

- **Per-application mapping unit tests in the Catalogue.** The mapping lives in each application, by design. Testing our guess at their mapping asserts our guess.
- **Reading the Catalogue's database to assert.** Everything above is observable at the HTTP surface; a database assertion would be the one thing a rewrite invalidates.
- **A browser seam for this increment.** There is no UI in it. When one arrives it asserts what a Person can see, and it does not duplicate the filtering cases — those stay where they are cheaper and more precise.

## Out of Scope

- **Badges, medals, levels and any `Achievement` entity.** A later phase. The Catalogue links to an application's own.
- **Per-observation data.** The Catalogue stores Measures, never observations. STAplus and Darwin Core are the vocabularies for that phase, and conforming to Darwin Core is worth doing when it arrives.
- **Export and named attribution.** Blocked on each application's terms of use, which is their work. The field that records what is permitted is in scope; using it to publish is not.
- **Push, and change events.** Rejected for now with the evidence recorded. Pull versus push is revisited once all five applications are integrated.
- **Real-time anything.** A live dashboard contradicts the assumption the architecture rests on; it reopens the design rather than extending it.
- **Migrating the applications' existing accounts.** Requirements are recorded per application as they turn up; recording is not committing.
- **Team-level and project-level permissions.** Anything that names an object inside a Brokered App stays in the data layer (ADR-0011). The policy table is built so that adding a level later changes the table, not the model.
- **A frontend.** The read API is the deliverable; whatever consumes it for the demo is its own ticket. No frontend implements permission logic in any case.
- **PPSR Core conformance**, and validation against its JSON Schema. The names are borrowed; nothing is claimed.
- **Reading any application's database**, and adding an index or a column to one. Under ADR-0017 a schema change in somebody else's table is theirs. The right trigger for an index is their query crossing about a second, and it is their call.
- **Activity Streams 2.0, ActivityPub and LDN.** Nothing in this design needs them, and they contribute nothing to the permission half of the original request.
- **Deciding the Catalogue's final name.** `Catalogue` is provisional. It cannot be `Project`: three of the applications already have an unrelated entity by that name (ADR-0011).

## Further Notes

### ADR disposition

Five ADR changes fall out of this spec, and the work is not complete until they are written:

- **ADR-0003 superseded.** "Roles stay local to each Brokered App; nothing about roles crosses the Broker" is incompatible with roles living in the Broker. Note what survives: no **Brokered App** receives a role claim, which is the half the applications were promised.
- **ADR-0011 amended, not discarded.** Its prohibition on the Broker carrying a scoped grant stays. What changes is that its reserved option — a shared domain service, with the Broker still identity-only — is now being built. The roles foreseen all pass its own discriminator.
- **ADR-0007 clarified** by the two-capability split: publishing Measures is a second optional capability, not a third item on the promise made to every application.
- **New ADR: the Catalogue publishes the contract and each application maps onto it.** Hard to reverse, surprising given ADR-0007, and a real trade-off against the rejected alternative of reading their databases.
- **New ADR: these applications have no real-time requirement.** Small, and it carries the weight of the whole architecture.

### Glossary terms this adds

**Catalogue**, **Data Contributor**, **Measure**, **Steward** and **Sensitivity Label**, with the
avoid-lists each needs — `Steward` especially, which must not be written as admin, administrator,
staff, superuser, moderator or researcher, the last being a different membership.

### Why change events were rejected — the evidence

Established by reading the three Django applications on 2026-11-26, and recorded here so that it is
not re-litigated. The per-application detail stays out of this public document; what matters is that
the conclusion is uniform rather than a judgement about any one of them.

- **No application has an audit table, a soft-delete flag or an outbox.** Every contribution delete is a hard delete with no tombstone. A consumer that cached identifiers cannot learn they vanished except by re-reading the full set — which is the snapshot approach.
- **One application has no change timestamp at all** on either of its measurement models, while scheduled jobs on minute-scale intervals rewrite contribution rows.
- **In another, a contribution is an in-place mutation** of a pre-existing row, and its existing incremental export filters on submit time — so it misses staff edits, an automatic reset, skips and deletes.
- **In the third, a contributor's erasure does not move the row's change timestamp**, because the bulk path that performs it never calls the model's save. An incremental query therefore cannot see the one change that most has to propagate.
- **Date filters rest on a contributor-supplied clock** in one application: a device with a wrong clock, or data uploaded long after capture, lands outside the window. Another application documents this same trap in its own metrics code and deliberately uses server time instead. This is why every Measure must declare its clock: **the sound clock is the unindexed one and the cheap clock is the one that lies.**

Two pieces of evidence from inside the programme point the same way. One application already
publishes a versioned, deliberately public snapshot regenerated wholesale on a schedule, written in
its own words to let external dashboards pull a uniform shape from every project; and the same
application's code says event-like metrics are recomputed from their own timestamps *so that a data
correction corrects the charts*, with a weekly reconciliation job that exists because the team expect
incremental counters to drift. **The delivery pattern is worth copying; the metrics inside it are
that application's own domain and must not shape ours.**

### Why PPSR Core is a vocabulary and not a schema

Checked on 2026-11-26. Every model reads `current approved version: 2020.0`; the last substantive
commit is January 2023 and all later activity is Dependabot. The machine-readable formats were
promised in 2021 and do not exist. The one JSON Schema is a lossy derivative generated from a
spreadsheet in January 2021: it is not valid UTF-8, its own enums are corrupted by cp1252 bytes, and
its `required` list contradicts the normative table — validating against it would reject valid
projects. It does not contain the participant counts at all; those are extension attributes. There
is no exchange protocol and no visible implementer: the standard's own implementation page names
none, and the citizen-science platform with the best API does not use it.

So the names cost nothing and leave a future export as a projection rather than a migration, while
conformance buys nothing because there is nobody at the other end. The contrast worth keeping in
mind is Darwin Core and GBIF, which is a live standard with real traffic — that is the one worth
conforming to when per-observation data arrives.

The STAplus identification is corrected in issue #234; the abbreviation collision on "AS2" is issue
#235. The reasoning on Activity Streams 2.0 — that it imposes no required fields, has no access
control, and that the one production precedent discards its audience layer and reinvents what the
Broker already provides — is in the dated note of 2026-11-26.

### Volume is not a constraint

Measured on 2026-11-26 from the applications' own public endpoints; no database was touched. The
largest application holds around 6 × 10^5 contribution rows and the others four and three orders of
magnitude fewer. Its **uncached** full-table multi-aggregate query, including two
`COUNT(DISTINCT)`s, answers in 0.43 s from outside its network, and the snapshot query is the same
shape. Growth is around 65k rows a month and bursty — one month ran twelve times another four months
earlier. Two of the three applications already run a monthly grouping in production, one of them
shipping it in an email, so asking for the same thing adds no new code.

**The scenario that changes this answer is not phones**: it is a headless or fixed-station ingest
path logging continuously, and one application has just opened one.

### Deferred, with an owner and a condition

| | Owner | Condition |
|---|---|---|
| Two levels in the schema — the Application, and the scientific unit PPSR Core would describe | us | when the schema goes fine-grained; a new contract version, not a migration |
| Where the Catalogue's source lives, and how it is released | us | its own ticket, before the first line is written |
| Whether participants have ceded data to a central system, or need a consent step first | stakeholders | a conversation, not a design question |
| Pull versus push, in firm | us | after all five are integrated and the friction is known |
| What these roles are actually called at Ibercivis | us | a research ticket, before the policy table is written |
| Per-observation data, export and attribution | us | the phase after this one; STAplus and Darwin Core are the vocabularies then |

### Where this came from

A design session on 2026-11-26. The decisions were settled with the user in that session; this spec
is the authority, and the session's own record is superseded by it.
