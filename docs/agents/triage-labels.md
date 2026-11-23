# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the "Label in our tracker" column to match whatever vocabulary you actually use.

## A closed issue carries no triage label

Closing an issue takes its triage label off. The first four in the table say what an issue needs
next — evaluating, information, an agent, a human. A closed issue needs none of them.

That is what the labels are filtered on. `--label ready-for-agent` is worth listing only while it
answers with work somebody can pick up; left on after the close, the labels pile up until it answers
with finished work instead. Drop this rule if a triage label is ever wanted as a record of how an
issue was handled, and accept that nothing then selects live work.

`wontfix` is the exception. It is a reason for closing rather than something the issue needs, so it
stays.

The kind labels stay as well: `task`, `research`, `grilling`, `map`, `prototype`, and Dependabot's
below. They say what an issue was, which closing does not change.

## The labels Dependabot adds

Dependabot creates its own on first use: `dependencies`, plus one per ecosystem — `javascript`,
`github_actions`, `docker_compose`. They are not triage roles and no skill asks for them. They stay
because in triage they say "this is a bump, not work from the script". `labels: []` on an ecosystem
in `.github/dependabot.yml` stops them.
