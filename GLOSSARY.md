# Citizen Science Federation

Glossary for the Broker that authenticates people on behalf of the citizen science apps, and for
the identity concepts shared across them.

This file is **only a glossary**. Decisions live in `docs/adr/`.

## The system

**Broker**:
The single point through which a Federated App authenticates a Person. It names a frontier rather
than a process: an app sees one issuer and cannot tell how many pieces answer behind it.
_Avoid_: proxy, reverse proxy, gateway, API gateway, auth server, identity provider, IdP

**Federated App**:
An application that delegates authentication to the Broker instead of holding credentials of its own.
_Avoid_: client, consumer, relying party, RP, app federada

**Pilot Composition**:
The Broker and every Federated App already integrated, declared in this repository as one set of
containers and brought up with a single command. It is where single sign-on is tried by hand and where
the end-to-end tests run. Disposable by design, built from each application's `federation` branch, and
never the way anything is deployed for real.
_Avoid_: staging, the environment, dev environment, deployment, entorno de pruebas

## The subject

**Person**:
One human being, as far as the system can tell. The subject that stays the same no matter which of
their Identities they used to arrive. One human reachable at two unrelated Verified Emails is two
Persons, which is a known limit of the model rather than a defect.
_Avoid_: user, account, cuenta, usuario

**Person Identifier**:
The one opaque, permanent value by which every Federated App knows a Person: a UUID minted by the
Broker and scoped with the organisation's domain. One per Person however many Identities they have,
never reassigned and never recycled.
_Avoid_: sub, subject, user id, voperson_id, external id, UUID

**Anonymous Contribution**:
Work a Federated App records without any Person behind it. It has no Person Identifier, and that
absence is the only mark of it; no Person, shared or otherwise, ever stands in for an anonymous
contributor.
_Avoid_: anonymous user, guest, anonymous Person, usuario anónimo

**Hidden**:
A Person choosing not to be seen by others. It is a matter of visibility, decided and enforced where
the Profile lives, and it is **not** an authentication concept: the Broker neither knows nor says
anything about it.
_Avoid_: private user, anonymous (that is an Anonymous Contribution), usuario oculto

## The ways in

**Identity**:
A Person's authenticated account at one Identity Source. A Person may have several, and they are the
only thing an Identity Source can vouch for.
_Avoid_: login, credential, profile, identidad

**Identity Source**:
A mechanism by which a Person proves who they are to the Broker — Google, GitHub, a Local Credential,
an institutional login. Pluggable, and adding one is invisible to every Federated App.
_Avoid_: identity provider (ambiguous with the Broker), upstream, social login, fuente de identidad

**Local Credential**:
An Identity whose Identity Source is the Broker itself: an email address and a password the Broker
holds. It is one Identity Source among the others, and no Federated App can tell it apart from them.
_Avoid_: local account, password login, native user, usuario local

**Verified Email**:
An email address belonging to an Identity, affirmed as verified either by the Identity Source or by
the Broker's own confirmation. It is the one key that decides whether a new Identity belongs to an
existing Person, read once when that Identity first arrives and never consulted again.
_Avoid_: email, email address, primary email, correo

**Identity Link**:
The association the Broker records between a Person and one of their Identities. It is what makes two
different Identity Sources resolve to the same Person, and it is established automatically, at first
arrival, when the Verified Email matches one already held.
_Avoid_: account linking, merge, mapping, vínculo

## Attributes

**Profile**:
Declarative attributes a Person states about themselves — display name, affiliation, language,
interests, external links. Mutable, and it grants no rights by itself. A Federated App may define a
local type it calls `Profile` which is not this Profile.
_Avoid_: user data, account details, perfil
