# Anonymous use produces no Person

Some Ibercivis applications let people contribute without identifying themselves, and that stays
exactly as it is: anonymous use never reaches the Broker and produces **no Person**. A contribution
either carries a Person Identifier or carries none, and that absence is the only mark of anonymity
the system needs.

## Considered Options

- **One shared Person for all anonymous contributors.** Rejected. It puts a stable, permanent
  identifier that looks exactly like a subject on something nobody authenticated, and sooner or later
  an application treats it as one — attaches a role to it, or a reputation, or a mailbox. A Person
  Identifier means "we know this is one human"; handing one to anonymity makes the identifier lie.
- **A Person per anonymous session.** Rejected. It mints Persons that can never be named, reached or
  joined to anything, and the future migration would have to carry all of them.

## Consequences

Questions about **volume** are answerable from the absence alone: how many contributions arrived
unidentified, what fraction of the data that is, how it moves over time. Questions about **people**
are not: how many distinct anonymous contributors there were is unanswerable, and so is whether
ninety contributions came from ninety humans or one. If that ever matters it is a rate-limiting and
traffic question in the application, not an identity question.

Claiming a past anonymous contribution for a Person is **impossible** in this model. It stays recorded
as undecided rather than as ruled out: making it possible later means the application retaining
something of its own, not the Broker issuing an identifier.

An application that genuinely needs to tell anonymous contributors apart mints a handle of its own
that never leaves it. It must not be a Person Identifier and must not be shaped like one.
