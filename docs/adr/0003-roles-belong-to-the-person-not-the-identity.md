# Roles belong to the Person, not the Identity

A Person may have several Identities, and the first intention was for each Identity to carry its own
roles and authorisations. Authorisation attaches to the **Person** instead: the Identity used to
arrive does not change what the Person may do.

## Considered Options

**Roles per Identity** was the original intention and is recorded here because someone will propose
it again. It has no good answer to what happens when a Person links a second Identity: inheriting the
union of roles makes per-Identity roles meaningless, and starting the new Identity empty silently
downgrades the Person. It also pushes a second identifier and a per-Identity permission check into
every Federated App, against the requirement that apps change as little as possible.

## Consequences

Roles stay local to each Federated App in the pilot; nothing about roles crosses the Broker.

Requiring a minimum assurance for specific actions — "publishing data requires having arrived via
ORCID" — remains available later as a claim checked at those few actions, and adding it does not
change this model.
