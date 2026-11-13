# The gate on `main`, and what a merge keeps

`main` takes a merge commit per pull request and publishes every commit the branch carries. The
merge commit is the only method the repository offers; squash and rebase are off.
`merge_commit_title` is `PR_TITLE` and `merge_commit_message` is `PR_BODY`, so that commit carries
the pull request's own summary rather than `Merge pull request #56 from ...`. A ruleset on `main`
requires a pull request, **one approving review**, `check`, `tests` and `pr` green, and the branch
up to date. It forbids force-pushes and deletion, and names no bypass actor — not the author, not
an administrator.

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

## The gate is a check and a review

The ruleset requires one approving review, agreed by the team on 13 November 2026. GitHub does not
let anyone approve their own pull request, so nothing lands without a second pair of eyes — which
is the point, and the cost: when the other person is away, nothing merges.

There is still no bypass actor. The way out of a stall is to edit the ruleset, which takes an
administrator two clicks and leaves a record with a name and a timestamp on it; a bypass is an
escape nobody reads. The day something has to land past a red CI or an absent reviewer, we would
rather it be visible.

**Auto-merge is off.** A green pull request waits for a person who has read the diff: the checks
say the change is well formed, a human says it should exist. An agent never presses that button —
`AGENTS.md` carries that as a rule, because nothing in the settings can tell an agent's
`gh pr merge` from ours.

## Considered Options

- **No required approval, CI as the only gate.** How this started, on the arithmetic of a
  two-person team: a required approval would be a stall or a stamp, and the real review happened
  before the pull request existed. Reversed by the team the same day — with an agent opening most
  pull requests, the second pair of eyes is the control that matters, and no check supplies it.
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
