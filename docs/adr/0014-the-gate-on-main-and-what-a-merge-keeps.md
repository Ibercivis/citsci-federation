# The gate on `main`, and what a merge keeps

| | |
|---|---|
| **Merge commit, and only that** | Squash and rebase off: the branch's commits are published |
| **The pull request is the merge commit** | `merge_commit_title: PR_TITLE`, `merge_commit_message: PR_BODY` |
| **The method is set in one place** | The repository's settings, beside the message format it feeds. The ruleset leaves `allowed_merge_methods` open rather than restating it |
| **One approving review** | GitHub forbids self-approval, so nothing lands on one pair of eyes |
| **`check`, `tests`, `pr` green** | A check is a gate nobody can rubber-stamp. Not *up to date*: `strict_required_status_checks_policy` is off, below |
| **No force-push, no deletion** | On `main` |
| **Bypass: `agorer`, `frasanz`, `agualis`** | `bypass_mode: pull_request` — a merge somebody chose, never a push. GitHub records each use |
| **Auto-merge off** | Green is the precondition; a human presses the button, and never an agent |

## Why the branch's commits survive

An agent writes down why each step was taken, and that is the part of a change a reader cannot
reconstruct from the diff. Squash discards exactly that. It is the right trade where commits are
noise; here they are the record.

So `main` keeps both views:

    git log --oneline                  every step, with the reasoning for it
    git log --first-parent --oneline   one line per pull request

The second reads well only because the merge commit carries the pull request's own title and body;
GitHub's default would fill it with branch names.

What it costs: `main` is no longer linear, and the branch's commits stop being drafts — their
subjects are what `main` shows, which is what the commit-subject rule in `AGENTS.md` is for, and
why a branch is brought up to date by rebasing onto `main` rather than merging `main` into it.

## Why a review and not only a check

Checks say a change is well formed; only a person says it should exist. The approval is required
because an agent opens most pull requests here, and no check supplies a second pair of eyes.

The three bypass actors are the way out when the reviewer is away. They are named one by one
rather than granted through the repository's admin role: there are ten admins, most of them there
for other work in the organisation, and the escape belongs to the people accountable for the
pilot.

`pr` is the check on the pull request's title and body. They are published as the merge commit's
message and stay editable after review, which is why CI re-reads them on every edit.

## Why the branch need not be up to date

The **Update branch** button defaults to merging `main` *into* the branch, the one shape this ADR
rules out, with the rebase inside a dropdown. No setting reverses the two.

Retiring it takes both `strict_required_status_checks_policy` in the ruleset and
`allow_update_branch` on the repository; either alone leaves the button on screen.

Little is lost with it. Both workflows trigger `on: pull_request`, so Actions already reads
`refs/pull/N/merge` — the branch merged with `main`. `strict` only re-ran that when `main` moved.

What stays open: `main` breaks a green pull request with no textual conflict to announce it, and
`ci.yaml`'s `push: main` job reports it after the merge instead of the gate refusing it.

**What would change this**: that costing more than the rebases did, or the merge queue's condition
below being met.

## Considered Options

| | |
|---|---|
| **No required approval, CI as the only gate** | How this started, on the arithmetic of two people. Reversed by the team the same day: an agent opens most pull requests, and no check is a second pair of eyes |
| **Squash as the only method** | On for a day, then reversed. #55 landed under it and stays as it is |
| **Rebase merge** | Keeps the commits, but nothing stands for the pull request: a revert becomes a range, and GitHub refuses the rebase when the branch carries a merge commit |
| **Conventional Commits on the title** | Subjects here are sentences, not a `feat:`/`docs:` taxonomy for a changelog nobody asked for |
| **Auto-merge** | On for an afternoon: it makes the merge a consequence of the checks, when the checks are only the precondition |
| **A merge queue** | The one thing that closes the window above, asking nobody to rebase. Still nothing to serialise with two aligned people, and the price is now known: neither workflow triggers `on: merge_group`, and `pr` reads a title and body a merge group has not got. Revisit when two pull requests a day collide in `main` |
| **Making the button default to a rebase** | No such setting, asked for since the option shipped in February 2022. Not tied to `allow_rebase_merge` either, which is off here while the dropdown still offers the rebase. Measured in issue #80 |
| **Dismissing an approval when the branch moves** | `dismiss_stale_reviews_on_push` and `require_last_push_approval`, both off: an approval survives the pushes that follow it. Two people who trust each other, deliberately, and not GitHub's default left unread. The first would fire on every rebase onto `main`, which is how a branch is brought up to date here; the second can deadlock a pull request, because the newest push needs an approval from somebody who did not make it and the author cannot approve |
| **Required signed commits** | Deferred, not rejected: every checkout would need signing configured before it could commit |
