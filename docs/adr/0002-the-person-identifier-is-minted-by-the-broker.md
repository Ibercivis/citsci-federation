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

## Consequences

The Broker needs a protocol mapper and provider-side storage. The earlier effort's ADR 0003 forbade
both, and its `tests/realm-config.test.ts` exists to guard those prohibitions — that test will fail by
design and must be rewritten to guard the rules in this ADR instead.

Tokens are not the transport for Profile data. The Profile service is out of the pilot but
deliberately not foreclosed, and an app that read profile fields from a token would foreclose it.
