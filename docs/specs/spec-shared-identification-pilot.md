# Spec — Shared identification pilot

## Problem Statement

A person who takes part in more than one Ibercivis citizen science project needs a separate account for
every application. Each application holds its own copy of their password, asks them to verify their email
again, and has its own password-reset flow. Nothing connects those accounts, so moving from one project to
another means registering from scratch and signing in again, and a person who contributes to two projects
is, as far as the software is concerned, two unrelated strangers.

For Ibercivis, the same problem appears from the other side. Every new application has to build sign-up,
sign-in, email verification and password recovery before it can do anything about citizen science, and
every one of them becomes another place where credentials are stored and another thing to keep secure.
There is no way to answer "is this the same person as that one", which is a precondition for anything the
foundation wants to do across projects later.

## Solution

One **Broker**: a single place where a **Person** proves who they are, which every **Federated App**
delegates to. A Person signs in through an **Identity Source** — Google, GitHub, or an email and a
password the Broker holds for them — and every Federated App recognises them by a single **Person
Identifier**. No Federated App stores a password for a Person who arrived this way, and no Federated App
learns which Identity Source was used.

Two Identities belong to the same Person when they present the same **Verified Email**. That is the whole
joining rule: sign in with Google today and GitHub tomorrow under one confirmed address, and both
applications see one Person, with no linking flow to go through and nothing to configure. The price is
stated plainly rather than hidden: one human reachable at two unrelated addresses is **two Persons**, and
the pilot offers no way to join them.

From the Person's side: sign in once, move between applications without signing in again, and never be
asked to remember which button was pressed last time.

From the foundation's side: a new application integrates by delegating authentication, storing one
identifier and closing its own registration. Adding a fourth Identity Source later changes nothing in any
application.

This is a pilot, and it runs as **one Docker composition**: the Broker and every integrated application
together, brought up with a single command (ADR-0009). On a laptop today, and at a public address the day
somebody outside the team needs to click through it — a later decision, not a rewrite. Accounts that
already exist in the applications keep their current per-application sign-in, untouched and with no sunset
date; the Broker serves accounts created from now on. The pilot closes at the end of January.

## User Stories

### A Person arriving for the first time

1. As a person new to an Ibercivis project, I want to sign in with an account I already have, so that I do not have to invent and remember another password.
2. As a person signing in, I want to choose between Google, GitHub and an email with a password, so that I can use whichever way in I consider mine.
3. As a person with no Google or GitHub account, I want to register with my email address and a password, so that not having a commercial account is not what keeps me out.
4. As a person registering with a password, I want to have to confirm my email address before the account counts for anything, so that nobody can claim an address that is not theirs.
5. As a person signing in through a source that does not hand over my email, I want to be asked for one and to confirm it, so that I can still get in rather than be turned away.
6. As a person signing in, I want to see which application is asking me to sign in, so that I know who I am granting access to.
7. As a person signing in, I want to be told what information will be shared with the application, so that I can decide whether to continue.
8. As a person who changes their mind on the sign-in screen, I want to cancel and be returned to the application, so that I am not stuck in a flow I did not want.
9. As a person who abandons sign-in halfway, I want nothing to have been created on my behalf, so that a half-finished attempt does not leave a stray account behind.
10. As a person whose chosen Identity Source fails, I want an error that tells me what happened and lets me try another source, so that I am not left on a blank page.
11. As a researcher, I want to sign in with ORCID, so that the identity I already use professionally is the one the projects know me by. *(Deferred: ORCID hands over no email, so this story costs one extra step — typing and confirming an address. See Further Notes.)*

### A Person coming back

12. As a returning person, I want to be recognised as the same person as last time, so that my contributions and my role stay with me.
13. As a returning person, I want to be recognised as the same person even if my email address at my Identity Source changed afterwards, so that changing my email does not cost me my history.
14. As a returning person already signed in at the Broker, I want to enter a second application without signing in again, so that moving between projects feels like one system.
15. As a person using two applications, I want to be the same person in both, so that one project can build on what I did in another.
16. As a person who forgot their password, I want to recover it through my email address, so that forgetting it does not end my participation.
17. As a person who signs out, I want to be signed out of the applications I entered in that session, so that signing out means what it says on a shared computer.
18. As a person whose session has expired, I want to be asked to sign in again rather than shown a broken page, so that expiry is not indistinguishable from a bug.

### A Person with more than one way in

19. As a person who signs in with Google one day and GitHub the next under the same confirmed address, I want both to be me, so that I never have to remember which button I pressed.
20. As a person, I want an address that nobody has proved they control to grant nothing at all, so that claiming my email address is not a way to take my account.
21. As a person with two Identities, I want the same capabilities whichever one I use to sign in, so that my permissions do not depend on how I arrived.
22. As a person who loses access to one of my Identities, I want to keep everything through the other, so that losing an account does not lose me my work.
23. As a person whose two accounts are under different email addresses, I want to be told plainly that they are two Persons and that joining them is not available yet, so that I pick one and stay with it instead of discovering the split later.
24. As a person who wants to change the email address I registered with, I want to confirm the new one and keep everything, so that a change of address is not a new identity.
25. As a person who sees the application calling me by a stale name, I want to understand that my display details come from the application and not from the Broker, so that I know where to change them.

### A person who does not identify themselves

26. As a person who contributes without identifying myself, I want to carry on doing that in the applications that allow it, so that the pilot does not raise the price of taking part.
27. As a researcher reading the data, I want to tell identified contributions from anonymous ones, so that I can judge what I am looking at.
28. As a person contributing anonymously, I want to be told that this contribution cannot later be attributed to me, so that I choose knowingly between convenience and credit.

### An existing account holder

29. As a person who already had an account in an application before the pilot, I want my existing sign-in to keep working exactly as before, so that the pilot does not lock me out.
30. As an existing account holder, I want not to be forced into a migration I did not ask for, so that nothing I rely on breaks while the pilot is being evaluated.
31. As an existing account holder who signs in through the Broker instead, I want to be told at the point of choice that this creates a separate account, so that I am not surprised to find my old contributions missing.
32. As a person new to an application, I want one place to get an account rather than two, so that I am not offered a choice whose consequences I cannot see.

### A Federated App maintainer

33. As a Federated App maintainer, I want to integrate by delegating authentication, storing one identifier and removing my registration link, so that the change to my application is as small as it can be while still reducing anything.
34. As a Federated App maintainer, I want to register my application by adding declared configuration to this repository, so that onboarding is a reviewed change and not a console session or a ticket to somebody else.
35. As a Federated App maintainer, I want never to learn which Identity Source a Person used, so that adding or removing sources is not my problem.
36. As a Federated App maintainer, I want one identifier per Person that never changes, so that I can key my own data on it with confidence.
37. As a Federated App maintainer, I want the identifier to be available in the ID token, in userinfo, in introspection and in the access token, so that whichever part of my stack needs it can read it.
38. As a Federated App maintainer, I want the Broker's address to be configuration in my application, so that moving the Broker does not mean a data migration in mine.
39. As a Federated App maintainer, I want to keep my own roles and permissions, so that I do not have to adopt somebody else's authorisation model.
40. As a Federated App maintainer running a server-rendered application, I want a flow that works for a confidential client, so that I can keep my secret on the server.
41. As a Federated App maintainer running a single-page application, I want a flow that works for a public client with PKCE, so that I do not have to hold a secret in a browser.
42. As a Federated App maintainer, I want to verify tokens against published keys, so that I do not have to trust the network between us.
43. As a Federated App maintainer, I want the Broker to behave identically in local development and in production, so that integration problems surface on my laptop.

### The Broker operator

44. As the Broker operator, I want the Broker's entire configuration to live as code in this repository, so that a change is a reviewable pull request and not a click nobody remembers.
45. As the Broker operator, I want to recreate the whole Broker from the repository, so that losing the machine is an inconvenience and not a disaster.
46. As the Broker operator, I want no credential worth protecting to be reproducible from the repository, so that a development stack is safe to throw away and publish.
47. As the Broker operator, I want the upstream Identity Source secrets to be referenced by the declared configuration and supplied from outside it, so that receiving the Google and GitHub keys does not make the repository unpublishable.
48. As the Broker operator, I want to add an Identity Source by changing declared configuration, so that the fourth source costs what the third did.
49. As the Broker operator, I want insecure flows to be refused rather than merely unused, so that a future misconfiguration cannot quietly enable them.
50. As the Broker operator, I want the Keycloak version pinned, so that a security property the design depends on cannot change underneath me.
51. As the Broker operator, I want to know when what is running differs from what is declared, so that drift is detected rather than discovered.
52. As the Broker operator, I want to run the entire pilot on a laptop, so that nothing waits for a machine to be provisioned.
53. As the Broker operator, I want the Broker's own services declared here and no other system's infrastructure, so that a dependency bump in another project cannot break this one.
54. As the Broker operator, I want to change the Broker's public address without a data migration, so that the final hostname can be chosen later.

### Ibercivis

55. As Ibercivis, I want to know when the same person appears in two projects, so that we can eventually build things that span them.
56. As Ibercivis, I want a new application to be able to join without a bespoke identity project, so that the cost of starting a project goes down.
57. As Ibercivis, I want passwords held in one place instead of one per application, so that the foundation's exposure stops growing with every project.
58. As Ibercivis, I want the identifiers we issue to stay unique when they one day sit beside another organisation's, so that federating later does not mean re-identifying everybody.
59. As Ibercivis, I want the choices made now to leave federation reachable, so that the pilot is a first step and not a dead end.

### The pilot team

60. As a developer on the pilot, I want to bring the Broker and every integrated application up with one command, so that trying single sign-on by hand costs nothing.
61. As a developer on the pilot, I want a browser test that signs in to one application and arrives already signed in at another, so that the pilot's central claim is demonstrated rather than asserted.
62. As a developer on the pilot, I want the same composition to run on a laptop now and at a public address later, so that where it is published stays a later decision.
63. As a developer on the pilot, I want each application's container recipe to live on its `federation` branch, so that abandoning the pilot costs deleting a branch.
64. As somebody showing the pilot to the foundation, I want a running federation to click through, so that what is judged is what was built rather than a description of it.

## Implementation Decisions

### The Broker

- The Broker is **Keycloak**, at a **pinned version**, run behind a **reverse proxy in every environment, including local**. The reason for the proxy is parity of form: cookie, TLS, redirect-URI and CORS failures that depend on deployment shape otherwise appear for the first time in production. The reason for pinning is ADR-0004: a security property of the design rests on how Keycloak treats a verified email, so the version is not allowed to move on its own.
- The `issuer` differs per environment and is **read from configuration**. It is never persisted in any database and never reconstructed by concatenating parts (ADR-0001). `/realms/<name>` stays in the path; stripping it fights Keycloak's multi-realm design and, with ADR-0001 and ADR-0002 in place, protects nothing still at risk.
- The Broker's own `compose` stack — Keycloak, the PostgreSQL it needs and an **SMTP endpoint** — is declared **in this repository**. Locally the SMTP endpoint is a mail catcher. Mail is no longer optional: ADR-0004 and ADR-0005 both depend on the Broker being able to confirm an address.
- **This repository declares the pilot's composition, not any application's production infrastructure.** Alongside the Broker's own services, it declares how each integrated Federated App is run **for the pilot** — built from that application's `federation` branch (ADR-0009). How those applications are deployed for real is still not declared here, and containerising them in production is still not this pilot's work.

### Identity

- The Broker **mints one opaque UUID per Person**, scoped with the organisation's domain, in the form `<uuid>@ibercivis.es`. It is emitted in **both `sub` and `voperson_id`**, and is present in the **ID token, userinfo response, introspection response and access token**. It is never reassigned and never recycled (ADR-0002).
- A Federated App stores **that identifier and nothing else** about how the Person arrived. The upstream Identity Source's own subject is never passed through.
- **Identities join by Verified Email** (ADR-0004). An Identity arriving with a Verified Email already held becomes an Identity of that same Person; an Identity arriving with any other address becomes a new Person. The address is read **once**, when that Identity first arrives, and never consulted again — so changing an email at Google afterwards costs nothing, and can never cause a later join.
- **An unverified email joins nothing.** Google and GitHub affirm the address themselves; `trustEmail` is set **per Identity Source**, never globally, and only where the source actually makes the affirmation.
- **A source that hands over no verified address causes the Broker to ask for one and confirm it by mail.** One mechanism covers all three cases that need it: ORCID, which affirms no email at all; GitHub, when the primary address is not released; and registration with a Local Credential. This is also what ORCID's own integration guide instructs integrators to do.
- **Two different addresses are two Persons, and the pilot offers no merge.** A merge flow is deliberately future work, and when it comes it must **add an alias** rather than reassign, because ADR-0002 promises a Person Identifier is never reassigned.
- **Identity Sources at launch: Google, GitHub and the Local Credential.** ORCID is deferred, for a reason that is not about credentials — see Further Notes. More sources are added later as declared configuration.
- **Local Credentials** (ADR-0005): self-service registration with **mandatory email confirmation**; the **email address is the sign-in identifier** and there is no separate username; **password recovery by email** owned by the Broker; and a **declared password policy** — minimum length 12, no composition rules, no expiry or rotation, and a common-password list if it is free.
- **Keycloak's Account Console is enabled** and is the Broker's only user-facing surface: where a Person changes their password, changes their email address and sees their own Identities. Changing an email requires confirming the new address, and has no effect on any join and none at all on the Person Identifier. *(Unverified: how far Keycloak's account REST API reaches into credential operations is to be established by experiment against the pinned version, not assumed. The surface exists either way; whether it can replace the console is the open part.)*

### Anonymity and visibility

- **Anonymous use never reaches the Broker and produces no Person** (ADR-0006). A contribution carries a Person Identifier or carries none, and that absence is the only mark of anonymity needed.
- **No shared sentinel Person** stands in for anonymous contributors. An identifier that looks like a subject must never be issued for something nobody authenticated.
- An application that needs to tell anonymous contributors apart mints a **handle of its own** that never leaves it, shaped unlike a Person Identifier.
- **Hidden** is visibility, not authentication. It is decided and enforced where the Profile lives, and the Broker emits nothing about it.

### Authorisation

- Authorisation attaches to the **Person**. The Identity used to arrive does not change what a Person may do (ADR-0003).
- The Broker emits **no role and no entitlement claims**. Roles stay local to each Federated App.
- **Assurance is no longer uniform**: "Google affirms this address" and "somebody confirmed a link in that mailbox" are different things, and no Federated App can tell them apart. That is accepted for the pilot, and ADR-0003 leaves a per-action assurance check available later without changing the model.
- No **Organization** entity exists in the pilot. It becomes an attribute of an Identity Source when a second organisation exists.

### Protocol

- **Authorization Code with PKCE (S256)** only. `nonce` required.
- The **implicit grant and any response type that returns an access token from the authorization endpoint are refused**, not merely unused.
- Public clients for single-page applications, confidential clients for server-rendered backends.
- **Consent is required on every client.** This is the mechanism behind stories 6 and 7: the consent screen is what names the application asking and lists what it will receive. Keycloak remembers a granted consent per client, so it is seen once per application rather than once per session, and story 14 is unaffected.
- **OIDC Discovery** is published; Federated Apps verify tokens against the published JWKS.
- **Token introspection** (RFC 7662) is available to confidential clients.

### Configuration

- Realm, clients, Identity Sources and scopes are **declared as code in this repository** and applied reproducibly at start-up. The admin console is for looking, not for changing.
- **Adding a Federated App is adding declared configuration here.** There is no console step and no manual registration UX, now or planned: the people who onboard applications are the people who send pull requests, so developer experience is where the effort goes.
- **Real secrets are referenced, never declared.** The declared configuration names environment variables; an untracked file supplies the Google and GitHub client secrets locally; a `.env.example` carries the names and no values. Every credential in the declared development stack stays a development constant on purpose.

### Integration with the Federated Apps

- Integration is **additive on the way in and subtractive in one place**: each Federated App gains delegated sign-in, keeps its existing sign-in for accounts that already exist with no sunset date, and **closes its own registration path** (ADR-0007).
- That registration link is a change **beyond** the authentication hook, and so is the container recipe the pilot needs. The promise to those repositories is now "the authentication hook, the registration link, and a Dockerfile on the `federation` branch" — not "nothing else" — and every part of it is asked for rather than assumed. All of it lands on the `federation` branch: `main` is never touched, and the way those applications are deployed today does not change (ADR-0009).
- **The closure reaches the web front end, not the API endpoint.** Where a Flutter client shares an application's API, the registration endpoint stays alive while that client depends on it. Exposure therefore falls on the web and not on mobile, and ADR-0007 states that limit rather than implying otherwise.

### Deployment

- **The pilot is one Docker composition and it runs wherever Docker runs** (ADR-0009): the Broker, its PostgreSQL, the mail catcher, the reverse proxy and every integrated Federated App, each built from its own `federation` branch, all up with one command. It starts on a laptop, so nothing in it waits on a machine being provisioned.
- **Every service is reached through the proxy by hostname, never by a port on localhost.** This is the parity-of-form argument the Broker already makes, extended to the applications: redirect URIs, cookies and CORS take the shape they will have in production rather than a shape only localhost allows.
- **Where the pilot is published, and whether it is published at all, is a later decision.** The current OVH infrastructure is not needed to make progress and nothing is built on it. When the question arrives, the answer costs a hostname and a certificate — ADR-0001 is what keeps it that cheap.
- **Everything in the composition is fixtures.** The stories about accounts that existed before the pilot need an account that already exists, and the composition creates it. No production data and no personal data goes into it, which is also what would make a public address safe.
- Production, afterwards, is OVH virtual or physical machines. The existing applications run there **directly on the host** — a process manager, a reverse proxy and a PostgreSQL local to each machine — and **none of them is containerised today**. A containerised Broker is therefore a new shape on those machines rather than a continuation of one, and containerising anything else is not this pilot's work.
- **Backups are inherited, not designed.** Daily PostgreSQL dumps and folder copies already exist and will be followed; this repository declares none. What inheriting them means in practice is **confirming that the policy reaches the Broker's own PostgreSQL**, which is a new database no existing policy knows about. That confirmation is a task before production, not an assumption.
- Deferring all of this is free because of ADR-0001: the hostname is configuration, so choosing it later costs a coordinated configuration change and one forced re-login, not a data migration.

### Reuse from the earlier effort

- The `compose` stack and the test harness from `federation-proxy` are **ported into this repository**. They are the only demonstrated part of the earlier work: they drive a real OIDC code flow against a real Keycloak.
- The earlier effort's **ADRs are not inherited**. Its three prohibitions — no protocol mappers, no provider-side user attributes, no Admin API — are **deliberately overturned** by ADR-0002, because minting the Person Identifier requires a mapper and provider-side storage. The guard that enforced those prohibitions must be rewritten against the rules in this repository's ADRs, or deleted.
- Porting includes auditing every ported test against the decisions recorded here. Two kinds of test need attention rather than deletion: anything guarding the old prohibitions, and **anything asserting that linking by email does not happen**, which must be **inverted** rather than removed — the behaviour it names is now required, and the test that names it is the most valuable one in the harness. A test that passes for the wrong reason is worse than no test.

### Reserved for the future, and built now only to this extent

- The Broker is addressed by a hostname the organisation owns, capable of serving `/.well-known/openid-federation` later.
- Signing keys for federation entity statements are a **separate set** from token-signing keys.
- Nothing else about federation is built. No entity statements, no trust anchor, no trust chains, no automatic registration.

## Testing Decisions

### What makes a good test here

A good test drives the Broker **over HTTP, exactly as a Federated App would**, and asserts only what such an app can observe: the discovery document, the redirects, the tokens, the userinfo and introspection responses, the errors. It never reads Keycloak's database, never calls its Admin API to assert, and never asserts the shape of its internal configuration as a proxy for behaviour.

The test of a good test in this repository: **it would still be meaningful if Keycloak were replaced by another provider.** Anything that would have to be rewritten in that case is testing the product rather than the decision.

That rule governs seams 1 and 2, which speak HTTP. Seam 3 drives a browser across two Federated Apps
and asserts only what a **Person** can see, which is the one thing HTTP cannot show: that moving from
one application to another asks for nothing.

### Seam 1 — the Broker's OIDC surface, driven by a stand-in Federated App

The single seam for all behaviour. A test helper behaves like a real Federated App: generates a PKCE verifier and challenge, builds the authorization request, follows redirects while carrying cookies, submits the sign-in form, redeems the code, verifies the ID token against the JWKS fetched from discovery, and calls userinfo and introspection.

**Prior art**: `tests/federated-app.ts` in `federation-proxy` already does exactly this against a real Keycloak, including the typed representation of *how* the Broker refused an attempt. It is ported, not reinvented.

What is asserted at this seam:

- **ADR-0004, the positive direction** — the same Verified Email arriving through two different Identity Sources yields **one** Person Identifier, with no linking flow in between. This is now reachable without building anything, which is what makes ADR-0002's cross-source promise demonstrable inside the pilot.
- **ADR-0004, the negative direction, and it is the most important assertion in the repository** — an Identity presenting an **unverified** email **does not join** an existing Person. This single test is what separates automatic joining from account takeover. It is a first-class assertion, written first, and it is also where the reported `trustEmail` advisory gets checked against the pinned version.
- **ADR-0004, the stated limit** — two different Verified Emails yield **two** Person Identifiers, and nothing in the responses offers to join them.
- **ADR-0002** — the Person Identifier is present in `sub` and `voperson_id`; present in ID token, userinfo, introspection and access token; identical across two sign-ins; never changed by an email address changing afterwards.
- **ADR-0001** — the `issuer` in the discovery document and in the tokens' `iss` equals the configured value; a Federated App needs nothing persisted to validate it.
- **ADR-0003, the half that is observable** — the same Person Identifier arrives regardless of Identity Source, which is the mechanical precondition of roles belonging to the Person; and **no token carries a role or entitlement claim**, which shows authorisation does not come from the Broker.
- **ADR-0005** — a Local Credential signs in and yields a Person Identifier indistinguishable in shape and placement from one obtained through Google or GitHub; a registration whose address has not been confirmed grants nothing.
- **Hardening** — PKCE is required and a request without it is refused; the implicit grant and access-token-returning response types are refused; confidential clients are required to authenticate.

**Tests ported from the earlier harness**: the code flow, discovery, PKCE hardening, grant hardening, confidential clients, ID token claims, and userinfo — plus the email-linking test, inverted.

### Seam 2 — declared versus running, deliberately minimal

Its only job is to catch drift: that the stack being exercised is the stack this repository declares, with no silent local override; that the Keycloak version running is the pinned one; that the password policy running is the declared one; and that no credential worth protecting is committed — including, now that they exist, the Google and GitHub client secrets. This is the only thing seam 1 cannot see. **Prior art**: `stack.test.ts`.

### Seam 3 — the federation in a browser, across two applications

A browser test drives the composition of ADR-0009 end to end, and it lives in **this** repository
rather than in the applications' (ADR-0010), because the assertion it exists for spans two
applications and no single application's repository can host it.

What is asserted at this seam:

- **One sign-in, two applications** — a Person signs in at one Federated App through the Broker,
  goes to a second one and is **not** asked to sign in again (story 14), and both applications
  report the **same Person Identifier** where each already exposes it. This is the pilot's central
  claim, and this test is the only place it is demonstrated rather than inferred.
- **The registration link is gone** from each integrated web front end, and newcomers are sent to
  the Broker (ADR-0007). The Broker cannot see this; a browser can.
- **An account that existed before the pilot still signs in the old way**, unchanged (ADR-0007).
- **Anonymous use still works without touching the Broker**, where the application allows it
  (ADR-0006).

What this seam does not do: assert anything about Keycloak's internals, and shrink seam 1. Every
protocol assertion stays at seam 1, where it is cheaper and more precise. Seam 3 asserts only what a
Person can see — pages, redirects, the absence of a second sign-in — and a Person Identifier is read
where an application already exposes it, never out of a database.

The list above is also the **checklist for testing by hand**. The composition exists so that a person
can click through it; the machine clicks through it first.

### A seam deliberately rejected

A guard over the realm **declaration** — the earlier effort's `realm-config.test.ts`. Rejected for two reasons: almost everything it asserts is observable at seam 1, where it is demonstrated rather than merely declared; and the three prohibitions it exists to guard were overturned on purpose by ADR-0002. It is rewritten or deleted, not ported as it stands.

### Stated in the open: what is not tested

One thing, and it is the consequence of a decision rather than an oversight:

- That each Federated App actually attaches its roles to the Person (ADR-0003). The Broker emits no
  roles, so nothing outside the application can see whether it did.

The second item used to be that each Federated App actually closed its own registration path
(ADR-0007). It is now asserted at seam 3 for every application in the pilot's composition: the Broker
still cannot verify it, but a browser can (ADR-0010). For an application that is integrated and not in
the composition it stays a check by hand, and it stays the part on which the pilot's claim to reduce
exposure rests.

## Out of Scope

- **A public address for the pilot.** The composition runs wherever Docker runs and starts on a laptop (ADR-0009). Publishing it is a later decision, taken if and when somebody outside the team needs to click through it, and the composition is built so that the decision costs a hostname.
- **Migration of existing users.** Existing accounts keep their current per-application sign-in. The **rehearsal** of that migration against anonymised production data is also out: the data will arrive, the rehearsal is attempted only if January allows, and nothing in the pilot depends on it.
- **A merge flow for two Persons.** Two different Verified Emails stay two Persons for the whole pilot (ADR-0004).
- **Deployment to OVH**, containerising the existing applications **in production**, and any backup work. The containers written for the pilot run the applications for the pilot and nothing else, and they live on the `federation` branch (ADR-0009). The existing policies are inherited and will be followed before production; none of it is designed or declared here.
- **ORCID as an Identity Source at launch.** Deferred on a finding, not on credentials — see Further Notes.
- **A custom Broker theme** beyond the foundation's name and logo.
- **The central Profile service.** Out of the pilot and deliberately not foreclosed — which is why tokens must not become the transport for Profile data.
- **An Organization entity.**
- **Mobile and Flutter clients**, as a committed deliverable. The pilot is Django and React, and public clients with PKCE leave mobile additive later at the cost of one redirect URI. One **reference integration** in a single Flutter application is an optional extra: not committed, nothing in the pilot depends on it, and its purpose is to leave a worked example rather than to ship mobile.
- **Claiming an anonymous contribution** for a Person afterwards. That anonymous use produces no Person is now decided (ADR-0006); whether a past anonymous contribution can ever be attributed is recorded as undecided, and making it possible would be work in the application, not in the Broker.
- **Roles, entitlements or group membership issued by the Broker.**
- **Outbound federation** — other organisations consuming identities we issue — and any test of it.
- **Any implementation of OpenID Federation.**
- **EOSC, eduGAIN and AARC conformance**: no Infrastructure Proxy, no eduGAIN service-provider membership, no Sirtfi self-assessment, no REFEDS Code of Conduct notice, no R&S declaration, no AARC-G069 URN namespace, no published collaborations page. Whenever this step is costed, cost it as **operations rather than protocol**: the current EOSC EU Node onboarding policy makes mandatory a Service Management System compliant with ISO/IEC 20000 or FitSM, TRL 7 with defined SLAs, integration with the Node's monitoring and helpdesk — the latter requiring a level 2/3 support rota — infrastructure located in the EU27, and Free and Open Source Software throughout. For a foundation this size the binding constraint is the helpdesk rota and the service management system, not the AAI integration. Two things follow: previous estimates of this step are too low, and the mandatory-FOSS clause is one we already satisfy, Keycloak being Apache-2.0 and this repository being public. Note also that **reaching eduGAIN and being an AARC-conformant Community AAI are separable**, with very different costs; when the step arrives, establish which of the two is actually wanted. Evidence in `docs/notes/cos4cloud-research.md`.
- **Application registration by third-party organisations.** Pilot applications are Ibercivis's own.
- **Resource discovery and streaming** — the third service of the wider programme. Untouched, and its vocabulary is still undefined, though it need not start from a blank page: **OGC Best Practice 21-068 (STAplus)** is a freely implementable vocabulary for exactly this shape of problem — many contributors, each owning what they uploaded, each wanting attribution, across platforms run by different organisations — and it is still under active standardisation in OGC. Its reference server implementation already authenticates against Keycloak, so a STAplus endpoint would need no broker but ours. Read it before inventing a vocabulary; summary and citations in `docs/notes/cos4cloud-research.md`.
- **The final production hostname.** Deferred on purpose; ADR-0001 is what makes deferring it safe.

## Further Notes

**ORCID: the blocker is not credentials, and the decision left is not technical.** Established against
ORCID's own documentation and live endpoints on 10 November 2026:

- ORCID's OpenID Connect implementation **never returns an email**. Its discovery document advertises
  `scopes_supported: ["openid"]` — one scope — and a `claims_supported` of `family_name`, `given_name`,
  `name`, `auth_time`, `iss`, `sub`. There is no `email` claim and no `email_verified`.
- An email exists only in ORCID's **record API**, where its default visibility is *only me*. By ORCID's
  own published figure, **fewer than 5% of records expose an email** to a relying party. Reaching the
  "trusted parties" slice on top of that requires paid Member API access and the person having already
  changed a setting.
- ORCID's integration guide instructs integrators **not** to ask people to change their visibility, and
  to collect the address in their own interface and verify it themselves. That is exactly the mechanism
  ADR-0004 and ADR-0005 already require, so nothing new has to be built for ORCID.
- Integration shape, for when it is unblocked: a **generic OpenID Connect provider** (Keycloak ships no
  ORCID one), client authentication **`client_secret_post`**, `trustEmail` **off** — there is nothing to
  trust — no `end_session_endpoint`, and `sub` is the bare ORCID iD rather than a URI. Whether ORCID
  accepts PKCE is **unverified**: its discovery document does not advertise `code_challenge_methods_supported`.
- Rejected while establishing this: making the **ORCID iD a second join key**. It joins nothing new,
  because no other Identity Source asserts an ORCID iD (ADR-0004).

The only open question is therefore one for the directors, and it is a product question: **is it
acceptable that a researcher arriving through ORCID has to type and confirm an email address, a step
nobody arriving through Google has?** That can be answered without waiting for anything.

**A reported security advisory to verify, not to trust.** The research reports a Keycloak advisory in
which, with `trustEmail` enabled and the userinfo endpoint in use, the email address is taken from the
userinfo response while `email_verified` is taken only from the ID token. If that is real, it is a
silent failure of the property ADR-0004 rests on. It is recorded as **unverified** and is checked by
experiment against the pinned version, as part of the seam 1 negative test.

**A research item that must precede any federation work.** Before specs or tickets are written for the
federation phase, understand the real options and their costs: carrying a Keycloak fork, writing a
plugin, or placing an OpenID Federation–capable provider in front of Keycloak with Keycloak as the
authenticator behind it. This is explicitly research, not a decision already taken.

**Facts established during design, worth not rediscovering.**

- OpenID Federation 1.0 is a **Final specification (17 February 2026)**; 1.1 followed in May 2026. The specification is settled; the implementation ecosystem is not.
- **Keycloak upstream chose a different direction.** It has no OpenID Federation code and no extension point for it; the only open-source-provider-side work lives in a fork. This is why the federation layer is planned as a separable component.
- The guideline for community user identifiers is **AARC-G026**, not AARC-G056. The earlier effort's ADR cited the wrong document, which is why it could not be found.
- **Authenix**, from the Cos4Cloud project, is the only running cross-platform citizen-science single sign-on: an OIDC provider fronting social sources and eduGAIN, and closed source. It is the precedent, and the shape being reinvented here with open source.
- `Ibercivis/EU-CS_platform` already ships `django-oidc-provider` without exposing it. Auditing it is deferred, but a latent identity provider in the organisation's own code is worth knowing about.

**The Veridas consultation is frozen.** `docs/notes/veridas-technical-questions.md` was written before this
scope and contradicts it in three places in its reserve section. It carries a header saying so and is not
to be updated: it will be revised by hand when they reply. None of the five questions actually sent
depends on anything decided here, but question P5 asks them to read this specification — which is the
reason it was rewritten before they could open it.

**Timing.** The pilot closes at the end of January with a team of two. The optional and deferred items
above are the first things to cut, in this order: the migration rehearsal against anonymised data,
the EOSC sandbox enrolment, the outbound-direction experiment, and the EU-Citizen.Science audit.
End-to-end tests used to head that list. They no longer do: they are committed (ADR-0010), and so is
the composition they run against (ADR-0009), because the pilot will be judged by somebody clicking
through it.

The one optional item worth defending against that list is the **Flutter reference integration**. It is
the cheapest of them — a redirect URI and a worked example, with no change to the Broker — and the only
one whose value accrues to people who are not in the room: a team wiring up a mobile client in six
months reads the example instead of rediscovering it.

**Relationship to the earlier repositories.** `federation-proxy`, `federation` and `learn-federation-proxy`
are kept as a consultable archive. Their demonstrated artefacts are reused; their ADRs and specifications
are not inherited.
