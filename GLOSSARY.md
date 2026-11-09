# Citizen Science Federation

Glossary for the Broker that authenticates people on behalf of the citizen science apps, and for
the identity concepts shared across them.

This file is **only a glossary**. Decisions live in `docs/adr/`.

## Language

**Broker**:
The single point through which a Federated App authenticates a Person. It names a frontier rather
than a process: an app sees one issuer and cannot tell how many pieces answer behind it.
_Avoid_: proxy, reverse proxy, gateway, API gateway, auth server, identity provider, IdP

**Federated App**:
An application that delegates authentication to the Broker instead of holding credentials of its own.
_Avoid_: client, consumer, relying party, RP, app federada

**Person**:
One human being. The subject that stays the same no matter which of their Identities they used to
arrive, and the thing a Federated App is ultimately talking about.
_Avoid_: user, account, cuenta, usuario

**Person Identifier**:
The one opaque, permanent value by which every Federated App knows a Person: a UUID minted by the
Broker and scoped with the organisation's domain. One per Person however many Identities they have,
never reassigned and never recycled.
_Avoid_: sub, subject, user id, voperson_id, external id, UUID

**Identity**:
A Person's authenticated account at one Identity Source. A Person may have several, and they are the
only thing an Identity Source can vouch for.
_Avoid_: login, credential, profile, identidad

**Identity Source**:
A mechanism by which a Person proves who they are to the Broker: Google, GitHub, ORCID, an
institutional login. Pluggable, and adding one is invisible to every Federated App.
_Avoid_: identity provider (ambiguous with the Broker), upstream, social login, fuente de identidad

**Identity Link**:
The association the Broker records between a Person and one of their Identities. It is what makes two
different Identity Sources resolve to the same Person.
_Avoid_: account linking, merge, mapping, vínculo

**Profile**:
Declarative attributes a Person states about themselves — display name, affiliation, language,
interests, external links. Mutable, and it grants no rights by itself. A Federated App may define a
local type it calls `Profile` which is not this Profile.
_Avoid_: user data, account details, perfil
