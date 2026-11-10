<!-- For agents: this document is frozen. Don't update it.

The five questions were sent to Veridas on 10 November 2026, in Spanish. What follows is the English
record of them (ADR-0008); the wording that left our hands was the Spanish one, and if a phrase here
reads better than what was sent, that is the translation flattering us.

The scope of the pilot changed *after* they were sent: automatic merging by verified email, local
credentials in the Broker, ORCID out of the launch. Several questions in the reserve — 3.1 ("Keycloak
must never link by email"), 3.6 (ORCID) and 5.4 ("we have given up linking by email") — therefore
contradict the decisions now in force.

That is deliberate and it stays. It will be reconciled by hand when they answer. This document is not
a source of truth about any decision: the sources are `docs/specs/`, `GLOSSARY.md` and `docs/adr/`.
-->

# Identity federation for citizen science (Ibercivis)

## State of the consultation

A calibration mail went to Kike (Veridas) on **10 November 2026**, carrying the context below and a
single question: whether their team includes anyone with real mileage in Keycloak in production, in
OIDC/OAuth2 as a *provider* (not as a consumer), or in federation.

This document is the **second step**. Veridas is a private company offering a favour out of
courtesy, not a contracted supplier, so the rule is **five questions, not thirty**: we send only the
ones below. The rest of this document is **our own reserve**, not a send queue.

The test for admitting a question into the five: **we must not be able to answer it ourselves with a
day of experimenting**. Whatever can be found out by standing up a Keycloak and trying it, we find
out ourselves. We ask them only for what requires scars.

A calibration warning: their public documentation (VeriSaaS, vali-Das, das-Face, Keymaker, XpressID)
is entirely document verification and biometrics consumed over an API, authenticated with an API
key. There is no trace of OIDC as a provider, SAML, Keycloak, eIDAS 2, EUDI Wallet or OpenID
Federation. That is no proof they lack it — their marketing site could not be read — but it does say
the likeliest value lies in block 5, and that blocks 1 to 4 may have nobody on the other end.

## Context

We work at a science foundation (Ibercivis) building a single **identity Broker** for its citizen
science applications. Today every application has its own registration, its own password and its own
"please verify your email", and a person taking part in two projects is, as far as the software is
concerned, two unrelated strangers.

The pilot proposes these pieces:

- **Keycloak** as the Broker, behind a reverse proxy in every environment.
- **Google, GitHub and ORCID**, among others, as identity sources.
- **Authorization Code + PKCE (S256)**.
- In future, an **OpenID Federation** layer.
- And, by a separate route, joining **EOSC**, where we understand the path is AARC BPA / eduGAIN.

Judgement from people who have run this in production would be worth a great deal to us. The pilot
closes at the end of January, so what helps most is judgement soon, not exhaustiveness.

## The five questions

**Q1. Overriding `sub`.** We need `sub` to be not Keycloak's internal user id but a UUID of our own
with a domain (`<uuid>@ibercivis.es`), and the same value to come out in the ID token, userinfo,
introspection and the access token. Have you done this? And above all: **what broke?** We are more
worried about the internals that depend on `sub` — the back-channel logout `logout_token`, offline
tokens, the Admin API, the Account Console — than about the mapper itself.

**Q2. The cost of carrying your own extensions.** If we have to write an SPI, we are now maintaining
our own Keycloak image. How often has a version bump broken an extension for you, and which SPIs do
you treat as stable API versus internal interface dressed up as API? We want a number and a scar,
not documentation.

**Q3. Configuration as code that survives.** We want the realm, the clients and the identity sources
declared in the repository and applied at startup. Of whatever you have used — *partial import*,
`keycloak-config-cli`, the Terraform provider, something else — which one does not end up fighting
the fact that the database is Keycloak's real source of truth? And how do you detect that what is
running has stopped being what is declared?

**Q4. Propagated logout.** One of our stories requires that signing out signs the person out of the
applications they entered. How reliable is Keycloak's back-channel logout in practice, what fails
silently, and do you monitor it in any way? This cannot be found out in testing: it only shows up in
production.

**Q5. Tell us where we are wrong.** Would you read our spec and our three (short) ADRs and tell us
which decision looks like a mistake to you? It is the most valuable thing we can ask of you and the
one that costs you the least preparation.

---

## Reserve — not to be sent up front

What follows was written before the rule of five was imposed. It stays as a question bank for when
the ones above are answered, or for a second conversation if they offer one. **Two whole blocks are
deliberately outside the first send**:

- **Block 4 (OpenID Federation)**: if they had mileage here, they would have said so when answering
  the calibration mail. Asking before we know spends two of the five bullets on a likely "no".
- **Block 5 (verification and biometrics)**: this is their actual ground and their product, which
  makes it a commercial conversation. Mixing it with a technical favour fouls both. If identity
  verification is ever needed, it is opened on its own and through the channel that belongs to it.

The questions in blocks 1 to 3 that did not make the five are out because **we can answer them
ourselves by experimenting**: where to store the attribute, when to mint the UUID, how to prevent
linking by email, the rough edges of ORCID's OIDC. That is our work, not a favour from them.

### 1. Extending Keycloak: minting the person identifier  **[P]**

This is the part of the pilot with the most technical risk, because it touches something Keycloak
considers its own.

1.1. We need `sub` **not** to be Keycloak's internal user id but our own domain-scoped UUID, and the
same value to appear in the ID token, userinfo, **introspection** and the access token. Have you
ever overridden `sub` in Keycloak? With what: a declarative mapper, your own `ProtocolMapper`
implementing `OIDCIDTokenMapper`/`OIDCAccessTokenMapper`/`UserInfoTokenMapper`, *pairwise* mode, or
something else? What stopped working when you did?

1.2. Does replacing `sub` break anything in Keycloak's internals that depends on it — session
lookup, *back-channel logout* (the `logout_token` carries `sub`), offline tokens, the Admin API, the
Account Console? We ask because we suspect the risk lives here rather than in the mapper.

1.3. Where would you store the identifier: user attribute plus mapper, a declaration in *User
Profile*, or the `User Storage SPI`? What interests us is which of those **best withstands Keycloak
upgrades**, not which is most elegant.

1.4. The moment of minting. We see three paths: our own authenticator in the *first broker login*
flow, an `EventListenerProvider` listening for registration, or minting from outside with the Admin
API. Which have you seen hold up? And specifically: **what guarantees idempotence** if the same
person opens two tabs and starts two logins in parallel — do we end up with two UUIDs?

1.5. The real cost of maintaining your own SPIs: how often has a Keycloak version bump broken an
extension for you, and which SPIs do you consider stable as against internal interface dressed up as
API?

1.6. An SPI of our own forces us to build our own Keycloak image. How do you handle that in CI — an
image build per Keycloak version, extension tests against several versions, or do you pin one and
leave it alone?

---

### 2. Configuration as code, and operations  **[P]**

2.1. To declare the realm, the clients and the identity sources as code and apply it reproducibly:
*partial import* at startup, `kc.sh import`, **keycloak-config-cli**, the **Terraform provider**, or
something else? Which one does not end up fighting the fact that the database is Keycloak's real
source of truth?

2.2. **Drift detection**: how do you know that what is running is what is declared? Do you have
something that compares, or do you assume it?

2.3. Secrets: client secrets, upstream IdP secrets, signing keys. How do you inject them, and how do
you **rotate** them without forcing a mass re-login or breaking the applications?

2.4. Upgrade cadence. Keycloak releases very often. Do you pin a version, follow a support line, or
stay current? What has bitten you in upgrades — themes, SPIs, schema migrations?

2.5. Reverse proxy. Our decision is that the `issuer` comes from configuration, **never from the
database** and never reconstructed by concatenating parts, so that the final hostname can change
later without a data migration. Is there any Keycloak behaviour (hostname v2, `--hostname-admin`,
`--hostname-backchannel-dynamic`, `proxy-headers` modes) that contradicts that in practice? What
traps have you hit with cookies, redirect URIs and CORS behind a proxy?

2.6. Honest sizing for something small: is one instance with PostgreSQL backups enough, or is
Infinispan clustering needed from the start? What breaks first as it grows?

---

### 3. Identity linking, session and logout  **[P]**

3.1. We want Keycloak to **never** link by email. How is that achieved in a way that does not depend
on nobody touching a checkbox: what has to be removed from the *first broker login* flow, and what
happens to the "an account with this email already exists" screens Keycloak shows by default?

3.2. Have you built an explicit linking flow, in which the person proves control of both accounts?
Did you use the `/broker/{provider}/link` endpoint with its `nonce`/hash, and do you consider it a
supported and stable route? Does it work from a public client (an SPA)?

3.3. Keycloak links an IdP to an **existing** user; it does not merge users. When a person has ended
up with two separate users that ought to be one, what do you do? Is there any merge path that is not
reassigning data by hand in every application?

3.4. **Propagated logout**: one of our user stories requires that signing out ends the session in
the applications the person entered. How reliable is Keycloak's *back-channel logout* in practice?
What fails silently, and how do you monitor it?

3.5. Lifetimes: recommended SSO idle/max for a multi-application scenario, and a refresh token
policy for SPAs (rotation, *Revoke Refresh Token*). Would you use refresh tokens in the browser, or
`prompt=none` against the Broker session?

3.6. **ORCID** as a Keycloak IdP: have you integrated it? We gather its OIDC has rough edges (email
not always present, sandbox versus production, public versus member API). Anything specific that is
going to cost us a day's work?

---

### 4. OpenID Federation and the federated horizon  **[F]**

Context: OpenID Federation 1.0 has been a final specification since February 2026 (1.1 in May). Our
reading is that **upstream Keycloak chose another direction**: it has no OIDF code and no extension
point for it, and the only provider-side open source lives in a fork. So we plan the federation
layer as a separable component, and so this is research rather than a decision taken.

4.1. Have you implemented or evaluated OpenID Federation on any project — *entity statements*, trust
anchor, trust chains, automatic client registration? If the answer is no, say so and we skip the
block.

4.2. Of the three paths we see — **(a)** carrying a Keycloak fork, **(b)** writing a plugin against
extension points that do not exist, **(c)** putting an OIDF-capable provider in front with Keycloak
behind it as the authenticator — which have you seen work? Do you know the existing forks (AgID's
Italian work for SPID/CIE, SUNET's) or SATOSA / IdentityPython's `fedservice` as a front layer?

4.3. If a provider is put in front, what breaks? We worry specifically about: which `issuer` the
applications see, session and logout across two hops, duplicated consent, and above all **how our
person identifier stays stable across two layers**.

4.4. The real operating cost of belonging to a federation: metadata signing keys, the renewal
cadence of *entity statements*, key rotation, what happens the day something expires. Is it an
afternoon a year or an on-call rota?

4.5. In the research ecosystem, do you see the **AARC BPA / Infrastructure Proxy** route (eduGAIN,
still very SAML) as more realistic than OIDF? Our reference for identifiers is **AARC-G026**.

4.6. Is anyone really consuming OIDF in Spain today — FNMT, Cl@ve, EUDI pilots? Who could be a
realistic trust anchor for a foundation like ours?

---

### 5. Identity assurance and verification — your ground  **[F]**

5.1. Today our entire assurance is "they signed in with Google". Later phases will have actions that
demand more (publishing data, coordinating a project). What is the **cheapest and most proportionate
step** above that for a non-profit foundation: document verification once at enrolment, Cl@ve/eIDAS,
or nothing at all and trust moderation?

5.2. Can the result of a verification of yours be consumed as **a claim we store once** against the
person, without us holding biometrics or documents? What exactly does vali-Das/XpressID return, and
what is the **minimum** we would have to store to be able to show later that the check happened?

5.3. Integration shape: is there a supported way to invoke a verification flow **inside** an OIDC
authentication flow (a *step-up* in the IdP itself), or is it always an application flow before or
after login? Have you integrated with Keycloak, or with any IAM, as a step-up authenticator?

5.4. The uncomfortable question: data quality in citizen science degrades with duplicate accounts,
and we have **given up linking by email**. What do you recommend against duplicates that is **not**
facial deduplication? And if someone proposed das-FaceBond: what does processing special-category
data of volunteers really imply under GDPR at our scale, and would you yourselves advise us against
it?

5.5. **Minors**: there is citizen science in schools. Age verification and parental consent — what
actually works, and what are you seeing your customers do?

5.6. **EUDI Wallet**: is it on your roadmap as a source of attributes? Does it make sense to imagine
a future identity source that is an EUDI wallet via OpenID4VP, and do you have anything running? We
would value a realistic estimate of dates more than the official one.

5.7. Pricing model, broadly: per verification, with minimums? We ask only to know whether it is
worth designing with it in mind or ruling it out now.

---

### 6. Shape of the consultation  **[P]**

6.1. Who is the right person for each block, and which format costs you least: asynchronous writing,
a one-hour call, or access to a sandbox?

6.2. Would you be willing to read our spec and our three ADRs (three short documents) and tell us
**where we are getting it wrong**? It is the most valuable thing we can ask of you and the least
time-consuming for you to prepare.
