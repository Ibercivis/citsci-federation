# The Person Identifier is minted by the Broker

A Person may arrive through several Identity Sources, and will one day arrive from another
organisation's broker. The Broker therefore mints one opaque UUID per Person, scoped with the
organisation's domain (`<uuid>@ibercivis.es`), emitted in both `sub` and `voperson_id`, never
reassigned and never recycled. A Federated App stores that identifier and nothing else about how the
Person arrived, so adding an Identity Source, linking two accounts, or federating with another
organisation changes nothing in any app.

## Considered Options

- **Pass through the upstream provider's `sub`.** Rejected: it ties every app to one Identity Source
  and makes adding a second one a migration in every app.
- **A bare UUID with no scope.** Rejected: it collides the moment identifiers minted by another
  organisation coexist with ours, and the only fix at that point is re-identifying every user.
- **Delegate minting to an external broker.** Rejected, and there is a production instance to point
  at. AUTHENIX, the shared sign-in built for EU citizen-science projects, mints the subject
  identifier itself — a "cryptonym" derived from the upstream provider's subject value, so it is a
  function of the *Identity* and not of the Person, with no account behind it to join two Identities
  into. Had we put it in front of Keycloak, the `sub` our apps receive would be minted by a third
  party, from a value we do not control, scoped to a domain we do not own, and tied to a service
  with no SLA whose funding ends in December 2026. Delegating the identifier is not a configuration
  detail: it gives away the one asset the Broker exists to create. Evidence in
  `docs/notes/authenix-research.md`.

## Consequences

The Broker needs a protocol mapper and provider-side storage. The earlier effort's ADR 0003 forbade
both, and its `tests/realm-config.test.ts` exists to guard those prohibitions — that test will fail by
design and must be rewritten to guard the rules in this ADR instead.

Tokens are not the transport for Profile data. The Profile service is out of the pilot but
deliberately not foreclosed, and an app that read profile fields from a token would foreclose it.

Opacity is what makes "never reassigned, never recycled" survive a deletion request. An identifier
that resolves to no personal information is one we are allowed to keep when the personal data around
it must go, so a Person erasing their data does not force the reuse of their identifier — which would
break every app that keyed data against it. OGC Best Practice 21-068 reaches the same conclusion
independently for the identifier's downstream consumer: after deleting a party's name and display
name, "the only remaining property is `authId`. Assuming that the `authId` cannot be used to resolve
personal information, it is acceptable to keep this property" (§6.4,
https://docs.ogc.org/bp/21-068.pdf). It also requires the identifier be set by the server from the
token and never asserted by a client, which is the same division of responsibility as here.
