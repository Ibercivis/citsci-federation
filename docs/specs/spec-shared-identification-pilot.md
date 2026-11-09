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
delegates to. A Person signs in through an **Identity Source** they already have — Google, GitHub or ORCID
— and every Federated App recognises them by a single **Person Identifier**. No Federated App stores a
password for a Person who arrived this way, and no Federated App learns which Identity Source was used.

From the Person's side: sign in once, move between applications without signing in again, and if they
later sign in through a different Identity Source that has been linked to them, every application still
knows them as the same Person.

From the foundation's side: a new application integrates by delegating authentication and storing one
identifier. Adding a fourth Identity Source later changes nothing in any application.

This is a pilot. Accounts that already exist in the applications keep their current per-application login,
untouched; the Broker serves accounts created from now on. The pilot closes at the end of January.

## User Stories

### A Person arriving for the first time

1. As a person new to an Ibercivis project, I want to sign in with an account I already have, so that I do not have to invent and remember another password.
2. As a person signing in, I want to choose between Google, GitHub and ORCID, so that I can use whichever account I consider mine.
3. As a researcher, I want to sign in with ORCID, so that the identity I already use professionally is the one the projects know me by.
4. As a person signing in, I want to see which application is asking me to sign in, so that I know who I am granting access to.
5. As a person signing in, I want to be told what information will be shared with the application, so that I can decide whether to continue.
6. As a person who changes their mind on the sign-in screen, I want to cancel and be returned to the application, so that I am not stuck in a flow I did not want.
7. As a person who abandons sign-in halfway, I want nothing to have been created on my behalf, so that a half-finished attempt does not leave a stray account behind.
8. As a person whose chosen Identity Source fails, I want an error that tells me what happened and lets me try another source, so that I am not left on a blank page.
9. As a person with no Google, GitHub or ORCID account, I want to be told plainly that those are the current ways in, so that I do not waste time looking for a registration form that does not exist.

### A Person coming back

10. As a returning person, I want to be recognised as the same person as last time, so that my contributions and my role stay with me.
11. As a returning person, I want to be recognised as the same person even if my email address at my Identity Source changed, so that changing my email does not cost me my history.
12. As a returning person already signed in at the Broker, I want to enter a second application without signing in again, so that moving between projects feels like one system.
13. As a person using two applications, I want to be the same person in both, so that one project can build on what I did in another.
14. As a person who signs out, I want to be signed out of the applications I entered in that session, so that signing out means what it says on a shared computer.
15. As a person whose session has expired, I want to be asked to sign in again rather than shown a broken page, so that expiry is not indistinguishable from a bug.

### A Person with more than one account

16. As a person who has both a Google and an ORCID account, I want them to be able to point at the same Person, so that the project knows one person and not two.
17. As a person with two linked Identities, I want the same capabilities whichever one I use to sign in, so that my permissions do not depend on which button I pressed.
18. As a person who loses access to one of my linked accounts, I want to keep everything through the other, so that losing an account does not lose me my work.
19. As a person signing in with a new Identity Source whose email matches an account that already exists, I want a separate account rather than silent access to someone else's, so that nobody can take over my account by controlling an email address.
20. As a person who wants two of my accounts joined, I want to have to prove I control both, so that linking is something I do and not something that happens to me.
21. As a person who sees the application calling me by a stale name, I want to understand that my display details come from the application and not from the Broker, so that I know where to change them.

### An existing account holder

22. As a person who already had an account in an application before the pilot, I want my existing login to keep working exactly as before, so that the pilot does not lock me out.
23. As an existing account holder, I want not to be forced into a migration I did not ask for, so that nothing I rely on breaks while the pilot is being evaluated.
24. As an existing account holder who signs in through the Broker instead, I want to be told that this creates a separate account, so that I am not surprised to find my old contributions missing.

### A Federated App maintainer

25. As a Federated App maintainer, I want to integrate by delegating authentication and storing one identifier, so that the change to my application is as small as possible.
26. As a Federated App maintainer, I want never to learn which Identity Source a Person used, so that adding or removing sources is not my problem.
27. As a Federated App maintainer, I want one identifier per Person that never changes, so that I can key my own data on it with confidence.
28. As a Federated App maintainer, I want the identifier to be available in the ID token, in userinfo, in introspection and in the access token, so that whichever part of my stack needs it can read it.
29. As a Federated App maintainer, I want the Broker's address to be configuration in my application, so that moving the Broker does not mean a data migration in mine.
30. As a Federated App maintainer, I want to keep my own roles and permissions, so that I do not have to adopt somebody else's authorisation model.
31. As a Federated App maintainer running a server-rendered application, I want a flow that works for a confidential client, so that I can keep my secret on the server.
32. As a Federated App maintainer running a single-page application, I want a flow that works for a public client with PKCE, so that I do not have to hold a secret in a browser.
33. As a Federated App maintainer, I want to verify tokens against published keys, so that I do not have to trust the network between us.
34. As a Federated App maintainer, I want the Broker to behave identically in local development and in production, so that integration problems surface on my laptop.

### The Broker operator

35. As the Broker operator, I want the Broker's entire configuration to live as code in this repository, so that a change is a reviewable pull request and not a click nobody remembers.
36. As the Broker operator, I want to recreate the whole Broker from the repository, so that losing the machine is an inconvenience and not a disaster.
37. As the Broker operator, I want no credential worth protecting to be reproducible from the repository, so that a development stack is safe to throw away and publish.
38. As the Broker operator, I want to add an Identity Source by changing declared configuration, so that the fourth source costs what the third did.
39. As the Broker operator, I want insecure flows to be refused rather than merely unused, so that a future misconfiguration cannot quietly enable them.
40. As the Broker operator, I want to know when what is running differs from what is declared, so that drift is detected rather than discovered.
41. As the Broker operator, I want the Broker's own services declared here and no other system's infrastructure, so that a dependency bump in another project cannot break this one.
42. As the Broker operator, I want to change the Broker's public address without a data migration, so that the final hostname can be chosen later.

### Ibercivis

43. As Ibercivis, I want to know when the same person appears in two projects, so that we can eventually build things that span them.
44. As Ibercivis, I want a new application to be able to join without a bespoke identity project, so that the cost of starting a project goes down.
45. As Ibercivis, I want to store no passwords for new accounts, so that the foundation's exposure does not grow with every project.
46. As Ibercivis, I want the identifiers we issue to stay unique when they one day sit beside another organisation's, so that federating later does not mean re-identifying everybody.
47. As Ibercivis, I want the choices made now to leave federation reachable, so that the pilot is a first step and not a dead end.

## Implementation Decisions

### The Broker

- The Broker is **Keycloak**, run behind a **reverse proxy in every environment, including local**. The reason is parity of form: cookie, TLS, redirect-URI and CORS failures that depend on deployment shape otherwise appear for the first time in production.
- The `issuer` differs per environment and is **read from configuration**. It is never persisted in any database and never reconstructed by concatenating parts (ADR-0001). `/realms/<name>` stays in the path; stripping it fights Keycloak's multi-realm design and, with ADR-0001 and ADR-0002 in place, protects nothing still at risk.
- The Broker's own `compose` stack — Keycloak and the PostgreSQL it needs — is declared **in this repository**. No Federated App's infrastructure is declared here.

### Identity

- The Broker **mints one opaque UUID per Person**, scoped with the organisation's domain, in the form `<uuid>@ibercivis.es`. It is emitted in **both `sub` and `voperson_id`**, and is present in the **ID token, userinfo response, introspection response and access token**. It is never reassigned and never recycled (ADR-0002).
- A Federated App stores **that identifier and nothing else** about how the Person arrived. The upstream Identity Source's own subject is never passed through.
- **Identity Link** uses Keycloak's native account linking. One Person may have several Identities; Federated Apps cannot tell which was used.
- **No automatic linking by email.** An Identity presenting an email that matches an existing account produces a **separate Person**. Linking requires proving control of both accounts. The pilot may ship with no linking flow at all, provided the model admits it.
- **Identity Sources at launch: Google, GitHub, ORCID.** More are added later as declared configuration.
- **No local credentials in the Broker.** There is no password, no password policy, no password reset and no email verification flow to own.

### Authorisation

- Authorisation attaches to the **Person**. The Identity used to arrive does not change what a Person may do (ADR-0003).
- The Broker emits **no role and no entitlement claims**. Roles stay local to each Federated App.
- No **Organization** entity exists in the pilot. It becomes an attribute of an Identity Source when a second organisation exists.

### Protocol

- **Authorization Code with PKCE (S256)** only. `nonce` required.
- The **implicit grant and any response type that returns an access token from the authorization endpoint are refused**, not merely unused.
- Public clients for single-page applications, confidential clients for server-rendered backends.
- **OIDC Discovery** is published; Federated Apps verify tokens against the published JWKS.
- **Token introspection** (RFC 7662) is available to confidential clients.

### Configuration

- Realm, clients, Identity Sources and scopes are **declared as code in this repository** and applied reproducibly at start-up. The admin console is for looking, not for changing.
- Every credential in the declared development stack is a development constant on purpose.

### Integration with the Federated Apps

- Integration is **additive**: each Federated App gains delegated sign-in and keeps its existing login for accounts that already exist. No migration of existing users.
- The change landing in each Federated App is the authentication hook and nothing else. No development environment, container or infrastructure change is asked of those repositories.

### Reuse from the earlier effort

- The `compose` stack and the test harness from `federation-proxy` are **ported into this repository**. They are the only demonstrated part of the earlier work: they drive a real OIDC code flow against a real Keycloak.
- The earlier effort's **ADRs are not inherited**. In particular its three prohibitions — no protocol mappers, no provider-side user attributes, no Admin API — are **deliberately overturned** by ADR-0002, because minting the Person Identifier requires a mapper and provider-side storage. The guard that enforced those prohibitions must be rewritten against the rules in this repository's ADRs, or deleted. Porting the harness includes auditing every ported test against the decisions recorded here; a test that passes for the wrong reason is worse than no test.

### Reserved for the future, and built now only to this extent

- The Broker is addressed by a hostname the organisation owns, capable of serving `/.well-known/openid-federation` later.
- Signing keys for federation entity statements are a **separate set** from token-signing keys.
- Nothing else about federation is built. No entity statements, no trust anchor, no trust chains, no automatic registration.

## Testing Decisions

### What makes a good test here

A good test drives the Broker **over HTTP, exactly as a Federated App would**, and asserts only what such an app can observe: the discovery document, the redirects, the tokens, the userinfo and introspection responses, the errors. It never reads Keycloak's database, never calls its Admin API to assert, and never asserts the shape of its internal configuration as a proxy for behaviour.

The test of a good test in this repository: **it would still be meaningful if Keycloak were replaced by another provider.** Anything that would have to be rewritten in that case is testing the product rather than the decision.

### Seam 1 — the Broker's OIDC surface, driven by a stand-in Federated App

The single seam for all behaviour. A test helper behaves like a real Federated App: generates a PKCE verifier and challenge, builds the authorization request, follows redirects while carrying cookies, submits the sign-in form, redeems the code, verifies the ID token against the JWKS fetched from discovery, and calls userinfo and introspection.

**Prior art**: `tests/federated-app.ts` in `federation-proxy` already does exactly this against a real Keycloak, including the typed representation of *how* the Broker refused an attempt. It is ported, not reinvented.

What is asserted at this seam:

- **ADR-0002** — the Person Identifier is present in `sub` and `voperson_id`; present in ID token, userinfo, introspection and access token; identical across two sign-ins; **identical when the same Person arrives through a second Identity Source**.
- **ADR-0001** — the `issuer` in the discovery document and in the tokens' `iss` equals the configured value; a Federated App needs nothing persisted to validate it.
- **ADR-0003, the half that is observable** — the same Person Identifier arrives regardless of Identity Source, which is the mechanical precondition of roles belonging to the Person; and **no token carries a role or entitlement claim**, which shows authorisation does not come from the Broker.
- **Collision policy** — two Identity Sources presenting the same email address yield **two different** Person Identifiers.
- **No local credentials** — there is no flow by which a password held at the Broker is accepted.
- **Hardening** — PKCE is required and a request without it is refused; the implicit grant and access-token-returning response types are refused; confidential clients are required to authenticate.

**Tests ported from the earlier harness**: the code flow, discovery, PKCE hardening, grant hardening, confidential clients, ID token claims, and userinfo.

### Seam 2 — declared versus running, deliberately minimal

Its only job is to catch drift: that the stack being exercised is the stack this repository declares, with no silent local override, and that no credential worth protecting is committed. This is the only thing seam 1 cannot see. **Prior art**: `stack.test.ts`.

### A seam deliberately rejected

A guard over the realm **declaration** — the earlier effort's `realm-config.test.ts`. Rejected for two reasons: almost everything it asserts is observable at seam 1, where it is demonstrated rather than merely declared; and the three prohibitions it exists to guard were overturned on purpose by ADR-0002. It is rewritten or deleted, not ported as it stands.

### Stated in the open: what is not tested

That each Federated App actually attaches its roles to the Person cannot be observed from the Broker. It is **not covered by any test in this repository**, and that is a consequence of ADR-0003 rather than an oversight.

## Out of Scope

- **Level 2 end-to-end tests** that boot OpenRed and Geonity for real. Optional: welcome if time allows, not committed, and nothing in the pilot depends on them. Keeping them out is what lets the Federated App repositories receive the authentication hook and nothing else.
- **Migration of existing users.** Existing accounts keep their current per-application login.
- **Local passwords** in the Broker, and everything they bring: password policy, reset, email verification.
- **The central Profile service.** Out of the pilot and deliberately not foreclosed — which is why tokens must not become the transport for Profile data.
- **An Organization entity.**
- **Mobile and Flutter clients.** The pilot is Django and React. Public clients with PKCE leave mobile additive later.
- **Anonymous contributions**, and whether an anonymous contribution can later be claimed by an account. Recorded as undecided, not as impossible.
- **Roles, entitlements or group membership issued by the Broker.**
- **Outbound federation** — other organisations consuming identities we issue — and any test of it.
- **Any implementation of OpenID Federation.**
- **EOSC, eduGAIN and AARC conformance**: no Infrastructure Proxy, no eduGAIN service-provider membership, no Sirtfi self-assessment, no REFEDS Code of Conduct notice, no R&S declaration, no AARC-G069 URN namespace, no published collaborations page.
- **Application registration by third-party organisations.** Pilot applications are Ibercivis's own.
- **Resource discovery and streaming** — the third service of the wider programme. Untouched, and its vocabulary is still undefined.
- **The final production hostname.** Deferred on purpose; ADR-0001 is what makes deferring it safe.

## Further Notes

**A research item that must precede any federation work.** Before specs or tickets are written for the federation phase, understand the real options and their costs: carrying a Keycloak fork, writing a plugin, or placing an OpenID Federation–capable provider in front of Keycloak with Keycloak as the authenticator behind it. This is explicitly research, not a decision already taken.

**Facts established during design, worth not rediscovering.**

- OpenID Federation 1.0 is a **Final specification (17 February 2026)**; 1.1 followed in May 2026. The specification is settled; the implementation ecosystem is not.
- **Keycloak upstream chose a different direction.** It has no OpenID Federation code and no extension point for it; the only open-source-provider-side work lives in a fork. This is why the federation layer is planned as a separable component.
- The guideline for community user identifiers is **AARC-G026**, not AARC-G056. The earlier effort's ADR cited the wrong document, which is why it could not be found.
- **Authenix**, from the Cos4Cloud project, is the only running cross-platform citizen-science single sign-on: an OIDC provider fronting social sources and eduGAIN, and closed source. It is the precedent, and the shape being reinvented here with open source.
- `Ibercivis/EU-CS_platform` already ships `django-oidc-provider` without exposing it. Auditing it is deferred, but a latent identity provider in the organisation's own code is worth knowing about.

**Timing.** The pilot closes at the end of January with a team of two. The optional and deferred items above are the first things to cut, in this order: level 2 end-to-end tests, the EOSC sandbox enrolment, the outbound-direction experiment, and the EU-Citizen.Science audit.

**Relationship to the earlier repositories.** `federation-proxy`, `federation` and `learn-federation-proxy` are kept as a consultable archive. Their demonstrated artefacts are reused; their ADRs and specifications are not inherited.
