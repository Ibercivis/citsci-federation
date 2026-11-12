# Security Findings

How to record a weakness found in a Federated App while integrating it with the Broker.

**This file is tracked in a public repository. No finding goes in it** — not as an example, not
paraphrased. The findings live in `docs/private/security-findings.md`, which is gitignored. This
file holds only the procedure.

## When this applies

Reading a Federated App's code for an integration turns up defects that are not the integration's
work: a secret committed to the repository, an endpoint with no permission class, a shell command
built by string concatenation. They belong to that application, not to this one.

Record each one **in the turn you find it**, before writing the integration issue, the ADR or
anything else. A finding that exists only in a reply is gone when the conversation ends.

## Verify before you record

A grep is a reason to go read the code, not a finding. Establish that the thing is actually
reachable — is there a project-wide default that closes it? does the validation layer actually see
that value? — and write the reasoning into the entry so the next reader can check it rather than
take it on trust.

A wrong entry costs more than a missing one: it spends the owner's credit, and the owner is the
person who has to act on everything else in the file.

## The entry

The register's own header defines the fields and the severity scale. Follow the entries already
there. Two fields decide whether the file stays trustworthy:

**`Verified`** — how far you actually took the claim:

| | |
|---|---|
| `source` | Read in the code, not executed |
| `local` | Reproduced against the application on a laptop |
| `live` | Reproduced against the running service |

**Never `live` without the user's explicit authorisation for that specific service**, and record
that authorisation in the entry. Read-only access to a server is not authorisation to exploit
something on it. When a reproduction would help, run the application locally and say so.

**`Reported`** — the date the owner was told, and by whom. A finding that is only in the register
has not been reported. Ask the user who receives it; don't pick a recipient.

The hand-over need not be a written notice: a meeting counts, recorded with its date and who was
there. What does not count is an intention to raise it. Fixing these is not the pilot's committed
scope, so when a finding is deliberately held for a conversation, write that decision and its date
into the entry — otherwise the next reader cannot tell a held finding from a forgotten one.

## Keep the boundary

A published surface — an issue, a PR, a commit message, a learning artifact — may say that an
integration is blocked on a security fix in that repository, reported privately. It may not say
which weakness, where, or how. That holds until the owner has fixed it or has said it is public.

The register is gitignored and therefore not backed up. A canonical copy lives outside git.

## Absent is not clean

An application missing from the register has **not been looked at**. Keep its "Still to review"
list in step with the integration issues, so that the difference between reviewed and unreviewed
stays visible.
