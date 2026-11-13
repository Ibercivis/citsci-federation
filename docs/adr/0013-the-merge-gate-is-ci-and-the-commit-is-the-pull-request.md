# The gate on `main` is CI, and the commit is the pull request

`main` takes one commit per pull request, built by GitHub from the pull request's own title and
body. Squash is the only merge method the repository offers; merge commits and rebase merges are
off. A ruleset on `main` requires a pull request, requires `check`, `tests` and `pr` to be green,
requires the branch to be up to date, forbids force-pushes and deletion, and names no bypass actor
— not the author, not an administrator. It requires **no approving review**.

The decision has two halves, and the second only makes sense after the first.

## The branch's commits are drafts; the pull request is the commit

Before this, nothing distinguished the two: a merge commit published every commit on the branch, so
each one had to be worth publishing. That was a reasonable thing to ask of a human writing six
commits. It is not a reasonable thing to ask of a working session that writes forty, half of them
corrections of the other half, which is what this repository's history will increasingly be made
of. The choice is between policing forty messages nobody will read and publishing one that somebody
will.

So the branch is scratch space, and the pull request carries the whole weight.
`squash_merge_commit_title` is `PR_TITLE` and `squash_merge_commit_message` is `PR_BODY` — both
fixed, neither derived from the branch. `COMMIT_OR_PR_TITLE`, the default we were on, takes the
single commit's subject when the branch has one commit and the pull request's title when it has
more: the same work lands under a different subject depending on how many times you committed, and
a rule that reads the count is not a rule.

What this costs is granularity in `main`, and it is a real cost: `git blame` on anything in the
pull request answers with the squash commit, `git bisect` cannot tell two tickets in one branch
apart, and reverting one of them is no longer `git revert <sha>`. The answer is not to keep merge
commits — it is that a pull request should be one ticket. Where it genuinely cannot be, the detail
survives on the pull request page, which GitHub keeps in `refs/pull/N/head` after the branch is
gone.

What this also costs is the issue references that used to ride in the commit messages, since
`PR_BODY` does not carry them. That is why `pr` exists: it refuses a pull request whose title and
body together name no issue and do not say `No ticket`. The check is the price of the setting, and
it was added in the same change.

## The gate is a check, not an approval

The ruleset asks for zero approving reviews, which reads like a weaker rule than it is.

We are two people. GitHub does not let anyone approve their own pull request, so one required
approval means every change either waits for the other person or does not land — on a repository
where most pull requests are opened by one of us working with an agent, and several land in a day.
A required approval under those conditions does not produce review; it produces a rubber stamp, or
a stall, and both are worse than what we do now, which is that the human reviews the work before it
is a pull request at all. That review is real and it stays. It just is not the gate.

A check is a gate that cannot be rubber-stamped. `check`, `tests` and `pr` either pass or they do
not, nobody is waiting on anybody, and `allow_auto_merge` means a pull request can be queued behind
its own result: the agent opens it, enables auto-merge, and the merge happens when CI says so or
never. That is the arrangement this repository is built for, and it is what makes the three
seconds `pnpm check` takes worth having.

There is no bypass actor, deliberately. An administrator bypass is an escape nobody records; the
real escape is to edit the ruleset, which is a change with a name and a timestamp on it. The day
something urgent has to land past a red CI, we would rather it be visible.

## Considered Options

- **One required approval.** Rejected for the arithmetic above: with two people it is a stall, and
  the day a third person joins the stall becomes a stamp. Revisit when more than one person pushes
  daily — the rule is cheap to turn on and the ruleset is the only thing that changes.
- **Rebase merge, kept alongside squash.** Rejected because it publishes the branch's commits
  unamended, which is the thing this decision is here to stop. Leaving it enabled would mean the
  shape of `main` depends on which button somebody clicks.
- **Conventional Commits, enforced on the title.** Rejected. Fifty merged subjects here are
  sentences that say what the change does, and `feat:`/`docs:` would be a taxonomy imposed on them
  for the sake of a changelog nobody has asked for. `pr` checks the shape those sentences already
  share — a capital letter, no trailing period, short enough for a subject line.
- **A merge queue.** Rejected on volume: it exists to serialise pull requests that pass alone and
  fail together, and with two aligned people there is nothing to serialise. The trigger would be
  two pull requests a day colliding in `main`.
- **Required signed commits.** Deferred, not rejected. It is the right control for a public
  repository where agents commit, and the cost is that every checkout needs signing configured
  before it can commit at all. It belongs in a change of its own, after the Broker's own
  deployment is settled.
