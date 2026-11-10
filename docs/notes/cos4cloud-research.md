<!-- Research note, not a decision. The sources of truth about our design are `docs/specs/`,
`GLOSSARY.md` and `docs/adr/`. Nothing here has been adopted. Checked 10 November 2026; every
liveness claim carries that date. -->

# Cos4Cloud — one specification worth reading, and nothing else for us

**Verdict.** Cos4Cloud (H2020 GA 863463, €6.0M, CSIC-coordinated, 1 Nov 2019 – **28 Feb 2023**,
closed — https://cordis.europa.eu/project/id/863463) did build a shared citizen-science sign-on:
**AUTHENIX**. We cannot adopt it and should not want to, for reasons recorded separately in
[`authenix-research.md`](authenix-research.md). What survived the grant is not the project but one
partner — **Secure Dimensions GmbH**, which kept two of its own products alive on later grants while
the rest stopped. One asset is genuinely valuable: **OGC Best Practice 21-068 (STAplus)**. The
aggregation services, mobile app builder, camera-trap platform and AI identification services are
adjacent, EU-funded, and of no use to a Broker.

**Read on only if** you are giving the resource-discovery service a vocabulary (§1 — the main
reason this note exists), costing the EOSC step (§3), or answering "why not just use the existing
citizen science SSO?" (§2).

**Already carried into the decisions**, so settle these there and not here: the spec's EOSC
out-of-scope bullet carries the finding that conformance is an operations commitment; its
resource-discovery bullet names STAplus as the candidate vocabulary; ADR-0002's rationale carries the
GDPR argument from 21-068 §6.4. What remains below is the evidence, not the decision.

## 1. OGC Best Practice 21-068 (STAplus) — read §6.4 before the discovery service gets a vocabulary

**What it is.** An extension to the OGC SensorThings API data model adding ownership of observations,
projects/campaigns, per-observation licensing, and explicit relations between observations, authors
and projects. Editor Andreas Matheus (Secure Dimensions); submitted 2022-05-06, approved 2022-08-20,
published 2022-09-29 (https://docs.ogc.org/bp/21-068.pdf, 82 pages, free to read and implement under
the OGC licence printed in it). The document warns it is a Best Practice, **not an OGC Standard**.

**It is still alive**, unlike the rest of the legacy: branch `22-022` of
https://github.com/opengeospatial/sensorthings had a commit on **2026-10-30**, eleven days before
this check, and the repository was pushed 2026-11-05.

**Section 6.4, "Considerations on Class Party", is effectively a specification of what a Person
Identifier is *for*, downstream** — and it reaches our conclusions from an independent direction:

- *"the user should be identifiable by a unique identifier. This user identifier should be stored in
  the `authId` property."*
- *"a STAplus implementation should use single instance for the party to represent one user, meaning
  a **1:1 relationship between unique user identifier and Party entity**."*
- *"To prevent impersonation, a STAplus implementation should make the `authId` property
  **read-only**. … the business logic is responsible for setting the value"* — HTTP 400 if a client
  asserts another's, HTTP 403 on update.
- On GDPR deletion: *"This would result in a party where the only remaining property is `authId`.
  Assuming that the `authId` cannot be used to resolve personal information, it is acceptable to keep
  this property."*

That last quotation is **an independent legal argument for our opaque-UUID decision**: an identifier
carrying no personal data is one you are allowed to keep when everything else must go, which is what
makes "never reassigned, never recycled" legally survivable.

Its reasoning for *not* burying ownership in a generic `properties` bag also transfers directly:
*"we don't believe it is wise to express ownership (user association) to be buried in properties. It
also makes GDPR compliance difficult … It decreases the interoperability tremendously, as one would
need to know which attribute expresses ownership."*

**Incidental and valuable: FROST-Server ships a first-class `FROST-Server.Auth.Keycloak` module**
alongside the Secure Dimensions OAuth2 one (module list in
https://github.com/securedimensions/FROST-Server-OAuth2). If we ever stand up a STAplus endpoint it
already speaks Keycloak natively — we would need no broker but our own. Maintained plugin:
`securedimensions/FROST-Server-PLUS`, LGPL-3.0, pushed 2026-07-28. The 52°North server died with the
grant (`52North/sensorweb-server-sta`, last release `v4.0.2-STAPLUS` 2023-02-17, no SPDX licence
detected), and both advertised demo endpoints — `cos4cloud.demo.secure-dimensions.de`,
`cos4cloud.sta.52north.org` — no longer resolve.

**Verdict: not adoptable today** (we have no sensor data service and need none in the pilot) **but
the one asset here that would save us inventing something.** Reading it costs an afternoon.

## 2. The shared sign-in was AUTHENIX — three findings about the *project*

The service itself is assessed in [`authenix-research.md`](authenix-research.md); only what Cos4Cloud
adds is here.

- **The project claimed its services were open source. The vendor says otherwise.** The Cos4Cloud
  service page asserts "Cos4Cloud's technical services are open source and are intended to be
  adapted and improved by the community" (https://cos4cloud-eosc.eu/authenix-gdpr/), while
  https://www.secure-dimensions.de/solutions says the authorization server "is a **closed source**
  solution". When we publish about our own work, the lesson is that this kind of claim gets checked.
- **The observatories it was built for did not adopt it.** The public operator registry
  (https://www.authenix.eu/Operators) showed **54 rows** on 2026-11-10, newest 2026-11-06, oldest
  2023-07-10, roughly two thirds of them Secure Dimensions' own registrations. The distinct third
  parties are ZOO-Project, CREAF, IAAC/Smart Citizen, IoT Lab (CH), 4113 Engineering (IT) and a
  CitiObs air-quality operator. **None of the nine Cos4Cloud observatories** — iSpot, Natusfera,
  Pl@ntNet, Artportalen, CanAirIO, OdourCollect, FreshWater Watch, Kduino, iSPEX — appears.
  *Caveat*: this is what the public page renders; pagination and filtering were not established.
- **Worse for the project's story: Cos4Cloud's own MOBIS service used EGI Check-In, not AUTHENIX**,
  for registration and authentication (https://www.egi.eu/case-study/cos4cloud/, SLA agreed July
  2021). A project built a sign-in service and one of its own services used someone else's. The case
  study does not say why.

**The sentence to reuse** when someone asks why we are not just using the existing citizen science
SSO: AUTHENIX gives **one login across many applications**; it does not give **one Person across
many projects**. Our Verified Email rule is a weak joining rule — theirs is none at all.

## 3. EOSC — the listings are dead; the current policy is the document that matters

Cos4Cloud's evidence of EOSC membership is four services listed on the EOSC Marketplace
(https://cos4cloud-eosc.eu/blog/cos4cloud-services-citizen-science-eosc-market/). On 2026-11-10
**`marketplace.eosc-portal.eu` did not resolve at all**, so every such link in the project's
materials, the Zenodo guides included, is dead. EOSC now runs through the EOSC EU Node
(https://open-science-cloud.ec.europa.eu, https://eosc.eu — both `HTTP 200`).

The useful artefact is the current **EOSC EU Node Resources and Services Onboarding Policy v1.0**
(European Commission, DG CNECT Unit C.1), read directly from
https://www.eosc.athenarc.gr/sites/default/files/2026-06/EOSC-EU-Node-Resources-and-Services-Onboarding-Policy-v1.0.pdf.
Mandatory for a service, all quoted: scope "must be multi-country and multi-disciplinary"; minimum
**TRL 7** "together with defined support and maintenance commitments, including Service Level
Agreements (SLAs) where applicable"; "Compliance with the latest 'EOSC AAI Architecture' … is
**mandatory**"; "a Service Management System (SMS) compliant with recognised standards, such as
**ISO/IEC 20000 or FitSM** … is mandatory"; "Use of common **Free and Open-Source Software (FOSS)** …
is mandatory", fully documented and public; all components on "sovereign infrastructure resources
located in EU27 and/or ACs"; integration with the Node's **AAI, Monitoring and Helpdesk** all
mandatory, the last requiring a Level 2/3 support unit in the EU Node helpdesk or integration of our
own; and "no commercial, 'freemium', or other access models are permitted".

Two consequences:

- **EOSC conformance is an operations commitment, not a protocol one.** FitSM, monitoring, a helpdesk
  rota, SLAs, TRL 7, EU-located infrastructure. For a foundation our size that is the binding
  constraint, not AAI integration. **This should raise whatever estimate we carry for that step.**
- **Mandatory FOSS cuts both ways.** It would exclude AUTHENIX itself today — the quiet verdict on
  treating a Cos4Cloud EOSC listing as proof of anything. It does not exclude us: Keycloak is
  Apache-2.0 and our configuration is declared as code in a public repository. If EOSC is a real
  destination we are already shaped correctly, which is a cheap thing to have been right about.

## 4. EGI Check-In — not Cos4Cloud, and the better precedent

The AAI that one Cos4Cloud service actually used **runs on Keycloak**, on the evidence of its own
discovery document fetched 2026-11-10
(`https://aai.egi.eu/auth/realms/egi/.well-known/openid-configuration`): the issuer is
`https://aai.egi.eu/auth/realms/egi` and the root redirects to `/auth/realms/id/account`. Its
`claims_supported` includes `voperson_id`, `eduperson_assurance`, `eduperson_entitlement`,
`voperson_external_affiliation`, `schac_home_organization` and `orcid`; it exposes `voperson_id` and
`aarc` as **scopes**; `subject_types_supported` is `["public","pairwise"]`.

Direct evidence that a production AARC-shaped research proxy uses the engine we chose and the claim
name we chose, from a source with nothing to do with us. **If we ever need to know what an
AARC-conformant Keycloak emits, that endpoint answers for free.**

## 5. The rest of the catalogue

Cos4Bio, MOBIS, DUNS, MECODA, FASTCAT, Pl@ntNet-API, AI-taxonomist, AI-GeoSpecies, GBIF-DL, Cos4Env:
biodiversity observation aggregation, a mobile app builder, a data use notification service, a Python
data-access library, camera-trap image pre-processing, plant and species identification APIs, a GBIF
download helper. Liveness spot-check 2026-11-10: `cos4bio.eu` and `cos4env.eu` answered `HTTP 200`;
`duns.cos4cloud-eosc.eu`, `mobis.cos4cloud-eosc.eu`, `mecoda.readthedocs.io` and
`fastcat.pervasive-technologies.es` did not resolve or did not answer.

**Nothing here for us** — and not because they are bad. They are data services; we are building an
identity broker.

"Interoperability", listed as a service, is a **web page, not a service**: it names only STAplus and
Darwin Core, says "We are working on the interoperability, it will be available soon!" next to a
progress bar reading 100%, and links to a Google Form
(https://cos4cloud-eosc.eu/services/interoperability/). The substance is STAplus (§1) and Darwin
Core, which belongs to GBIF and predates Cos4Cloud by two decades.

The project website still answers and still lists fourteen services with a "Cos4Cloud legacy"
section; deliverables are on Zenodo under CC BY 4.0
(https://cos4cloud-eosc.eu/the-project/deliverables/).

## 6. Open questions

1. **What does the "EOSC AAI Architecture" document actually require** — eduGAIN membership,
   AARC-G069, or only a conforming OIDC client? The onboarding policy makes compliance mandatory
   without reproducing it, and its footnote reference did not survive PDF extraction. **The single
   highest-value unread document for the EOSC step.**
2. **Why did MOBIS use EGI Check-In instead of the project's own sign-in service?** The EGI case
   study records the fact, not the reason. *Answered by*: deliverable D4.5
   (https://zenodo.org/record/7615472). Genuinely interesting — a project's own team declining its
   own identity service is the detail that explains why an asset dies.
3. **Did any Cos4Cloud observatory ever run AUTHENIX in production?** The registry suggests not, but
   absence from a rendered page is weak evidence. *Answered by*: D4.1
   (https://zenodo.org/record/7708413) and D7.6 (https://zenodo.org/record/7912740), neither read for
   this note. Worth an hour only for the full post-mortem; the design verdict does not depend on it.
