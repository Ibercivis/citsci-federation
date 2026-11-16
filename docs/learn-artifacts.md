# Learning Artifacts

Published pages generated from this repository's spec, glossary and ADRs, to make them quicker
to grasp than prose allows. Shared with the team.

They are **learning aids, not documentation**. Nothing is decided here: the spec in
`docs/specs/`, `GLOSSARY.md` and `docs/adr/` are the source of truth, and a page that
disagrees with them is the thing that is wrong.

They are expected to be deleted once what they explain is understood, so that the same
information is not carried in two places for long. Delete the page and its entry here in the
same change: a dead link is worse than no entry.

To change a page that is already listed, pass its URL so it is updated in place. Publishing
without the URL creates a second page, and then nobody knows which one is current.

Pages are written in English, titles included (ADR-0008).

## Pages

### Architecture of the identification pilot

<https://claude.ai/artifact/8TFnxeY4E3rpXBUee1W5uQ>

Four figures: the components inside the Broker and the boundary a Brokered App can see; the
eleven steps of a first sign-in, and where in them the Person Identifier is minted; two linked
Identities against two that merely share an email address; and what changes in a Brokered App.

_From_ `docs/specs/spec-shared-identification-pilot.md`, `GLOSSARY.md`, ADR-0001 to ADR-0003.
Published 2026-11-09, translated into English 2026-11-10.

### Keycloak, piece by piece

<https://claude.ai/artifact/SMEorrMNcYFuswAfJhXbSD>

Orientation for anyone who has not used Keycloak before: that it is an OIDC server and an OIDC
client at the same time, the pieces of a realm and the path a sign-in takes through them, the
three defaults that have to be broken for the pilot, the translation between Keycloak's
vocabulary and the glossary's, and the URLs a Brokered App actually touches.

_From_ the same sources, plus general Keycloak knowledge. Two details are flagged in the page
itself as unverified against a pinned version: the exact name of the `sub` mapper, and the
realm import strategy. Published 2026-11-10, translated into English the same day.
