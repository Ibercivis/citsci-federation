# The gate on `main` is CI, and a merge keeps the branch's commits

`main` takes a merge commit per pull request and publishes every commit the branch carries. The
merge commit is the only method the repository offers; squash and rebase are off.
`merge_commit_title` is `PR_TITLE` and `merge_commit_message` is `PR_BODY`, so that commit carries
the pull request's own summary rather than `Merge pull request #56 from ...`. A ruleset on `main`
requires a pull request, requires `check`, `tests` and `pr` to be green, requires the branch to be
up to date, forbids force-pushes and deletion, and names no bypass actor — not the author, not an
administrator. It requires **no approving review**.

The decision has two halves, and the second only makes sense after the first.

## The branch's commits are the record; the merge commit is its summary

Squash was enabled on 13 November 2026 and reversed the same day. Its argument was that a working
session writes forty commits where a human writes six, half of them corrections of the other half.

What it missed is what the forty contain: an agent writes down why each step was taken, and that is
the part a reader cannot reconstruct from the diff. Squash is the right trade where commits are
noise. Here they are the record.

So `main` keeps both views, and neither is paid for by the other:

    git log --oneline                  every step, with the reasoning for it
    git log --first-parent --oneline   one line per pull request

`merge_commit_title` and `merge_commit_message` are what make the second readable; GitHub's
default would fill it with branch names.

The costs: `main` is no longer linear, and the branch's commits stop being drafts — their subjects
are what `main` shows, which is what the commit-subject rule in `AGENTS.md` is for. Rebasing a
branch onto `main` rather than merging `main` into it keeps the bubble to one commit.

The `pr` check was built for squash, where those two strings *were* the commit. It survives on a
smaller argument: they are still published, and still editable after review.

## The gate is a check, not an approval

The ruleset asks for zero approving reviews, which reads like a weaker rule than it is.

We are two people. GitHub does not let anyone approve their own pull request, so one required
approval means every change either waits for the other person or does not land — on a repository
where most pull requests are opened by one of us working with an agent, and several land in a day.
A required approval under those conditions does not produce review; it produces a rubber stamp, or
a stall, and both are worse than what we do now, which is that the human reviews the work before it
is a pull request at all. That review is real and it stays. It just is not the gate.

A check is a gate that cannot be rubber-stamped. `check`, `tests` and `pr` either pass or they do
not, and for that part nobody is waiting on anybody.

What a check is not is a decision to merge. **Auto-merge is off**, and that is the deliberate half
of this decision rather than an omission from it: a green pull request does not land, it waits for
a person who has read the diff to press the button. The checks say the change is well formed; only
a human says it should exist. The absence of a required approval is not an absence of review — it
is a refusal to ask GitHub to model a review that happens between us before the pull request is
opened, and again at the merge button.

An agent never presses that button. `AGENTS.md` carries it as a rule, and it has to be a rule:
nothing in the repository's settings can tell an agent's `gh pr merge` from ours, which is the same
reason the production-database rule is written there rather than enforced.

There is no bypass actor, deliberately. An administrator bypass is an escape nobody records; the
real escape is to edit the ruleset, which is a change with a name and a timestamp on it. The day
something urgent has to land past a red CI, we would rather it be visible.

## Considered Options

- **One required approval.** Rejected for the arithmetic above: with two people it is a stall, and
  the day a third person joins the stall becomes a stamp. Revisit when more than one person pushes
  daily — the rule is cheap to turn on and the ruleset is the only thing that changes.
- **Squash, as the only merge method.** Enabled on 13 November 2026 and reversed the same day, for
  the reason above. Pull request #55 landed under it and stays as it is; the setting is what
  changed, not the history.
- **Rebase merge.** Rejected although it keeps the commits. It leaves nothing that stands for the
  pull request, so reverting one means reverting a range somebody has to delimit by hand rather
  than `git revert -m 1`; it rewrites the commits it replays, so the ones in a local branch stop
  matching the ones in `main`; and GitHub refuses it outright when the branch carries a merge
  commit, which a long-lived branch generally does.
- **Conventional Commits, enforced on the title.** Rejected. Fifty merged subjects here are
  sentences that say what the change does, and `feat:`/`docs:` would be a taxonomy imposed on them
  for the sake of a changelog nobody has asked for. `pr` checks the shape those sentences already
  share — a capital letter, no trailing period, short enough for a subject line.
- **Auto-merge, so that a green pull request lands on its own.** Enabled for an afternoon and
  turned back off the same day. It is the natural companion to a CI gate and it is exactly what we
  do not want: it makes the merge a consequence of the checks, when the checks are only the
  precondition. Every merge here is somebody deciding, and with an agent opening most of the pull
  requests that distinction is the whole safeguard rather than a formality.
- **A merge queue.** Rejected on volume: it exists to serialise pull requests that pass alone and
  fail together, and with two aligned people there is nothing to serialise. The trigger would be
  two pull requests a day colliding in `main`.
- **Required signed commits.** Deferred, not rejected. It is the right control for a public
  repository where agents commit, and the cost is that every checkout needs signing configured
  before it can commit at all. It belongs in a change of its own, after the Broker's own
  deployment is settled.
