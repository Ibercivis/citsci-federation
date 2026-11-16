# Orientation — the shape of the pilot

A first reading, deliberately short. Nothing here decides anything:
`docs/specs/spec-shared-identification-pilot.md`, `GLOSSARY.md` and `docs/adr/` are the source of
truth, and where this file disagrees with them, this file is what is wrong.

## One Broker, one identifier

Every **Brokered App** delegates authentication to one **Broker**. A **Person** signs in through an
**Identity Source** — Google, GitHub, or an email and password the Broker holds for them (ADR-0005)
— and every Brokered App recognises them by one **Person Identifier**, `<uuid>@ibercivis.es`, minted
by the Broker and never reassigned or recycled (ADR-0002). An application stores that value and
nothing else about how the Person arrived.

## Components, and the arrow that is missing

```
Person ──▶ Brokered App ─── OIDC: code + PKCE S256 ──▶ ┌─ Broker ────────────────┐
browser     OIDC client                                │ reverse proxy           │
                                                       │ Keycloak, one realm     │──▶ Google
            stores one Person Identifier ◀── tokens ───│ PostgreSQL              │──▶ GitHub
                                                       │ SMTP                    │
                                                       └─────────────────────────┘
                                             the Local Credential is an Identity Source in here
```

The arrow that does **not** exist is Brokered App → Identity Source. That absence is why a fourth
source can be added without touching any application, and why no application learns which source a
Person used. The `issuer` is the whole frontier: what sits behind it is not an application's
business (ADR-0001).

## A first sign-in, in six moves

1. The Person presses sign in; the app sends them to `/authorize` with a code challenge (S256) and
   a `nonce`.
2. The Broker shows who is asking and what will be shared — consent is required on every client.
3. The Person picks an Identity Source; the Broker redirects there and receives a verified Identity.
4. **Inside the Broker**, invisibly to the app: the Identity resolves to a Person by Verified Email
   (ADR-0004), and a Person Identifier is minted if the Person is new.
5. The app receives a code, exchanges it at `/token`, and gets an ID token and an access token —
   carrying no role, no entitlement, and no mention of the Identity Source (ADR-0003).
6. The app verifies the signature against the JWKS from discovery and stores the Person Identifier.

The session cookie belongs to the Broker, not to the apps. At the second application, steps 2–4 do
not happen: that is what makes moving between projects feel like one system.

## One Person, several Identities

Two Identities are the same Person when they present the same **Verified Email**, read once, when
that Identity first arrives, and never consulted again (ADR-0004). There is no linking flow to walk
through. An unverified address joins nothing; a source that affirms no address makes the Broker ask
for one and confirm it by mail.

The price is stated rather than hidden: one human reachable at two unrelated addresses is **two
Persons**, and the pilot offers no merge. A later merge must add an alias, never reassign.

## What an integration costs the Brokered App

| | |
|---|---|
| Added | delegated sign-in against the Broker; one `person_identifier` column; a Dockerfile for the Pilot Composition |
| Removed | its own registration path on the web front end — not the API endpoint a mobile client shares (ADR-0007) |
| Untouched | its own session, its own roles, and the existing per-application sign-in, with no sunset date |

All of it lands on that application's `federation` branch; `main` is never touched (ADR-0009).

## Read next

- the spec, for anything load-bearing — this page is a map, not the territory
- `broker/README.md` — why the realm is declared the way it is
- `docs/orientation/keycloak.md` — Keycloak's words against ours
