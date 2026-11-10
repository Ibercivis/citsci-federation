<!-- Research note, not a decision. The sources of truth about our design are `docs/specs/`,
`GLOSSARY.md` and `docs/adr/`. Nothing here has been adopted. Checked 10 November 2026; every
liveness claim carries that date. -->

# AUTHENIX — rejected as our Broker, kept as a precedent

**Verdict.** A live, single-vendor, **closed-source** hosted OAuth2/OIDC authorization server run by
**Secure Dimensions GmbH** (Munich), brokering **SAML2** logins from eduGAIN, Google, Facebook and
GitHub into OIDC. Built inside EU citizen-science projects (LandSense, Cos4Cloud, CitiObs) and still
answering. **It changes nothing in the pilot and should not become our Broker, now or later** — it
mints the subject identifier itself, has no concept of a Person, has no local credential, and has no
SLA or price with its last funding ending 31 December 2026. It is not a dead endpoint, though, which
is why the reasoning is written down rather than waved away.

**Read on only if** you are revisiting whether to delegate identity-minting (§1, §2), reaching for
academic or eIDAS-grade identity (§3), costing EOSC/AARC conformance (§3), or deciding what a
volunteer may see and undo about their own consent (§4).

**Already carried into the decisions**, so settle these there and not here: ADR-0002 rejects
delegating identity-minting and cites this service as the production instance; ADR-0003 cites its
absence of entitlement claims; ADR-0004 states that `trustEmail` cannot be set for a source that is
itself a proxy over many providers. What remains below is the evidence, not the decision.

## 1. Why it cannot be our Broker

Four disqualifications, each from a primary source. Any one would be enough.

1. **It mints the subject identifier, and per *identity*, not per *person*.** Its OpenAPI, on the
   `openid` scope: *"The user's unique identifier is requested from the IdP and used to generate the
   AS specific user identifier - the **cryptoname**"* (https://authenix.eu/api/openapi.json). Its
   Privacy Statement: *"this service provides a user **cryptonym** … A cryptonym is only generated if
   a subject identifier was received from the asserting Identity Provider"*
   (https://authenix.eu/PrivacyStatement). Frontal collision with ADR-0002.
2. **No Person, therefore no joining rule.** *"The Service does not have user accounts"* (same
   source). One human with a Google identity and a university identity is two subjects forever, and
   `subject_types_supported` is `["public"]`, so it is one `sub` per identity shared across all
   clients — stable, but keyed to the wrong thing. ADR-0004 has **no counterpart**: not a
   disagreement about *how* to join; it does not join.
3. **No local credential**, same source. A volunteer with no Google, Facebook, GitHub or university
   account cannot use it at all. Contradicts ADR-0005, which exists precisely so that person is not
   excluded.
4. **Its live discovery document advertises the implicit grant** — `implicit` in
   `grant_types_supported`, `token` and `token id_token` in `response_types_supported` — accepts
   `code_challenge_method: plain`, and documents PKCE and `nonce` as optional
   (https://authenix.eu/.well-known/openid-configuration). Our protocol policy refuses exactly those.
   The grant is not a stale advertisement: the project's own user guide **instructs** browser
   applications to use it — *"Client-side Web-Application runs inside the Web-Browser (must use the
   OAuth2 Implicit Grant)"* (https://zenodo.org/records/7790035, p.4, published 28 February 2023) —
   and a client named "OpenAPI Test Implicit" sits on their public list
   (https://authenix.eu/clients). Their OpenAPI contradicts all of this for the same endpoint:
   *"Only the authorization code workflow is supported."* **Unverified which document reflects
   behaviour**; settling it needs a registered client and would change nothing for us.

**Commercially it is not signable.** No pricing page, and the Terms of Use are eight short sections
with **no fee clause** — the only "fee" in the document is "reasonable attorney's fees" inside the
indemnity (https://authenix.eu/TermsOfUse, read in full). **No SLA, no warranty disclaimer, no
liability cap, no availability or support commitment**; read in full, the absence is total. But
indemnification runs one way, from us to them: *"Each Operator shall defend, indemnify and hold
harmless Secure Dimensions GmbH from and against any and all actions, claims, costs …"*. Uncapped
indemnity, no reciprocal commitment, Bavarian law. Funding, per CORDIS: LandSense (689812, H2020)
ended 2020-12-31; COS4CLOUD (863463, H2020, CSIC-coordinated) ended 2023-02-28; **CitiObs (101086421,
Horizon Europe) ends 2026-12-31**, and nothing published says what happens on 1 January 2027. (Their
own footer calls all three "Horizon Europe"; two were H2020.)

**The defensible sentence for ADR-0002's rationale.** If AUTHENIX sat in front of Keycloak, the `sub`
our applications receive would be a cryptonym minted by Secure Dimensions GmbH, derived from a Google
or eduGAIN subject value, scoped to `authenix.eu`, and tied to a service whose funding ends on
31 December 2026 with no SLA. ADR-0002 exists so that the identifier by which Ibercivis knows a
volunteer is **ours** — stable across a change of identity source, of hosting, and of supplier.
Delegating it is not a configuration detail; it is giving away the one asset the Broker exists to
create.

## 2. Against our decisions

| Our decision | AUTHENIX | Verdict |
|---|---|---|
| **ADR-0002** — Person Identifier minted by the Broker, one opaque UUID per Person in `sub` and `voperson_id` | Mints a cryptonym itself, derived from the upstream IdP's subject; no `voperson_id` in `claims_supported` | **Direct contradiction.** Decides the question on its own. |
| **ADR-0004** — identities join by Verified Email | No accounts, no Persons, no joining; `email`/`email_verified` passed through from upstream | **No counterpart.** Disqualifying for a project whose data quality depends on not duplicating volunteers. |
| **ADR-0005** — the Broker holds local credentials | "The Service does not have user accounts" | **Direct contradiction.** |
| **ADR-0003** — no role or entitlement claims; authorisation local to each app | No groups, roles or entitlements; only `idp_identifier`, `idp_name`, `idp_country`, `ipd_origin` (that typo is live in the published discovery document) | **Agreement — and independent support.** AARC-style AAIs usually *do* carry entitlements. This EU-funded citizen-science AAI declines to and is still useful. **Cite it if ADR-0003 is challenged.** |
| **ADR-0001** — the issuer is configuration, not data | `issuer` is `https://authenix.eu` while every page and the OpenAPI `servers` entry use `https://www.authenix.eu`, and the `www` form is baked into the signing key's `kid` (`www.authenix.eu#id_token`) | **A cautionary tale.** Exactly the apex-vs-`www`, config-vs-data tangle ADR-0001 is written to avoid. |
| **Protocol** — code + PKCE S256 only, `nonce` required, consent on every client | Implicit advertised and recommended; PKCE optional, `plain` accepted; `nonce` required only with `id_token`; consent required per application and revocable | **Contradiction on grant and PKCE; agreement on consent** (see §4). |
| **Out of scope: central Profile service; tokens must not carry profile data** | Is a profile transport by design — "a GDPR compliant broker for authentication tokens **and personal information**" (https://www.authenix.eu/About) | **Opposite philosophy.** Adopting it would foreclose the Profile option by making tokens the profile channel. |

Two more quirks that would bite, both verified: **`userinfo` is non-standard** — a conforming
`GET /userinfo` with a bearer token returns `sub` alone, full claims need a POST with
`client_id`+`client_secret` from a client whitelisted in the token's `audiences`, and the spec warns
`sub` can come back **`null`**, which OIDC Core forbids. And **no refresh tokens for public clients**,
per the vendor's own 2026 QGIS plugin: *"This public client has no client_secret, so access tokens
cannot be refreshed in the background"* (https://github.com/securedimensions/QGIS-SCK-Plugin,
GPL-2.0, pushed 2026-10-11). That same file does use authorization code + PKCE, so PKCE demonstrably
works despite the guide telling SPA authors to use implicit.

## 3. Closed questions — eIDAS, AARC, OpenID Federation

**eIDAS: nothing.** A case-sensitive search of the full 4.6 MB IdP list returns **zero** occurrences
of `eIDAS`, `Cl@ve` and `Clave` — and **zero `ORCID`** (https://authenix.eu/IdPs). AUTHENIX is **not**
a free academic route to verified identity and does not displace the separate commercial
identity-verification conversation.

**Academic reach is real, and separable from AARC conformance — this is the finding worth keeping.**
Its IdP list carries **6,709 rows** (5,521 distinct entity-id-shaped URLs) including Spanish entries
registered through SIR/RedIRIS (`https://www.rediris.es/sir/csicidp`, CSIC). So a **small private
company** sits as a SAML service provider in front of the whole eduGAIN aggregate and resells it as
OIDC — an existence proof that such a proxy can be **rented rather than built**. Meanwhile it is
**not AARC-G026 conformant**: G026 is explicit that the community user identifier *"MUST be
communicated using the `voperson_id` claim … MUST be present in the UserInfo Response and in the ID
Token"* (AARC-G026, 2021-06-14, DOI 10.5281/zenodo.5504407, normative PDF read directly), and
AUTHENIX does not advertise it. **"Reaching eduGAIN" and "being an AARC Community AAI" are separable
problems with very different costs, and the first is far smaller.** When EOSC comes up, the question
to ask is which of the two we need. Worth noting: our ADR-0002 is already G026-conformant —
`voperson_id` alongside `sub`, opaque, never reassigned — more so than AUTHENIX. What AUTHENIX cannot
tell us is the cost of the AARC half; nobody there attempted it, so that needs a different source
(EGI Check-in, or an Infrastructure Proxy operator).

Whether AUTHENIX is itself a registered eduGAIN SP is **unverified**: the MET API returned `HTTP 404`,
technical.edugain.org returned `HTTP 400`, and no SP metadata was reachable at the usual
SimpleSAMLphp paths. The vendor claims registration and "approximately 2,870 universities"
(https://www.secure-dimensions.de/activities) — **a vendor claim, not corroborated**.

**OpenID Federation: not implemented.** `/.well-known/openid-federation` returns the 9,312-byte
landing page; the site soft-404s every unknown path, which I confirmed. No `AARC`, `voperson`,
`entitlement` or `eduperson` string anywhere on it, and no published roadmap.

## 4. What is worth taking from it

**Their consent and data-subject model is more complete than ours currently is**, and it is a good
shopping list: per-application approval of a data scope with a "remember" option, a visible "Trusted
Applications" list to revoke from, an export of what was shared as JSON or CSV, a delete, and a
"Forget Me" that revokes tokens as well as records (https://www.authenix.eu/About). We require
consent on every client; we have not decided what a volunteer can *see* and *undo* afterwards. Note
the honest caveat they publish with it: *"The removal of these tokens will cause all dependend
applications to stop functioning."*

**IdP selection by entity ID.** `login_hint` is documented as *"the SAML2 EntityId of the IdP that
the user wants to login with"* — close to how we will drive `kc_idp_hint`.

**A design decision not to repeat:** their Operators page publishes integrators' contact emails,
including named individuals' personal addresses, in plain public HTML.

## 5. Liveness and stack, checked 10 November 2026, 16:18–16:30 UTC

Up and well-formed: discovery `HTTP 200`, 1,672 bytes, `RS256` only, endpoints published for
authorize, token, userinfo, introspection, revocation, dynamic registration, device authorization and
end-session; `scopes_supported` is `["openid","profile","email","saml","offline_access"]`; JWKS
`HTTP 200` with a single RSA key. **But the deployed build announces itself as three years old** —
every page carries `<meta name="revision" content="2023-10-06 13:48:37 +0200">` — the OpenAPI is
still version `0.9.0`, and `/IdPs` publicly renders raw PHP warnings (`Array to string conversion in
/var/authenix/vendor/twig/twig/src/Environment.php(434)`) across thousands of rows. Running, but not
tended. The *company* is active: `securedimensions` on GitHub has repositories pushed in September
and October 2026.

**Built on custom PHP plus SimpleSAMLphp**, per its own OpenAPI: *"Secure Dimensions OpenID Connect /
OAuth2 Authorization Server with SAML2 federated IdP … The SAML2 authentication support is
implemented via the **SimpleSAMLphp** package"*, on nginx 1.18 / PHP 8.4 with Twig templates. No
public repository (`secure-dimensions` org → `404`; the `securedimensions` account has no AUTHENIX
repo). **Not Keycloak, not Satosa, not Unity** — so none of our real scar-tissue questions
(overriding `sub`, `logout_token`, SPI stability across version bumps, config-as-code) has an
analogue here. Its lessons are about decisions, not implementation.

**Signing up is possible, and one route is alarmingly open.** Manual registration at
`/users/registerapp` requires signing in through an upstream IdP; I could not complete it
non-interactively (cookie-consent interstitial). Nothing in the Terms restricts eligibility to
project partners and the public Operators list already includes third parties (CREAF, IoT Lab,
4113 Engineering, a CitiObs operator) — so **unverified but plausible** that a Spanish foundation
could register. Separately, `/oauth/register` is open **anonymously** (`security: None`), guarded
only by 10 applications per IP address, one request every 10 seconds, and inactivity after 30 days
without a signed `software_statement`. I registered nothing: creating state on a third party's
production service to satisfy curiosity is not ours to do.

## 6. Open questions

Ordered by how much they would change the conclusion. None of the first three would — itself a reason
to stop here.

1. **What happens on 1 January 2027, when CitiObs ends?** Nothing published says. *Answered by*: one
   email to `support@secure-dimensions.de`. Worth sending only if academic reach goes live.
2. **Is AUTHENIX a registered eduGAIN SP?** Could not verify (see §3). Matters only for academic
   reach.
3. **Does the authorization endpoint actually accept implicit?** Their two documents disagree.
   *Answered by*: a throwaway client via the open `/oauth/register` and `response_type=token`.
   Deliberately not done.
4. **If we ever federated to AUTHENIX, could we set `trustEmail` for it?** The only question here
   that bears directly on an ADR. Their `email_verified` is documented as *"was the email verified by
   the Identity Management at the Identity Provider"*, which reads like faithful pass-through — but
   **pass-through from 6,709 heterogeneous identity providers is not one trust decision, it is
   6,709**. Unverified and probably unanswerable in the general case, **which is itself the answer:
   `trustEmail` could not responsibly be set for a source of this shape.** Record that in ADR-0004's
   territory if the question returns.
