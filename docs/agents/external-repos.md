# External repositories: the `federation` branch

Scope: every repository that is **not this one** — the Ibercivis application repositories that become
Brokered Apps, and anything else whose code the pilot has to change. Work inside
`citsci-federation` itself is unaffected.

## The rule

**Never commit to `main` or `master` in an external repository — and never commit to `federation`
either.** All pilot work lives on a branch named exactly `federation` — no prefix, no suffix, one per
repository. `federation` is the main branch of our prototype, and it is treated like one:

- It is created from the **latest commit of `main`**, and refreshed from there. One repository
  deviates; see **Where `federation` is cut from** below.
- **Nothing lands on it except through a reviewed pull request.** Changes are written on a topic
  branch cut from `federation` and reach `federation` by a PR with `--base federation`. A commit
  made directly on `federation` is a commit nobody read.
- Pull requests target `federation`, never `main` — unless a defect in `main` itself argues for
  one. See **A pull request against `main`** below; the default is never.
- The pilot deploys from `federation`. Production keeps following `main`, and the one exception
  below is the only thing the pilot ever puts there.
- The application's **container recipe for the pilot** lives here too — a Dockerfile and the
  environment it needs, so the application can join the Brokered Composition (ADR-0009). It is written
  for the pilot and for nothing else, and `main` never sees it.
- The repository's default branch stays as it is. We don't change it, and we don't ask for it.

If `federation` already exists in a repository, use it rather than recreating it. Refreshing it from
`main` is a deliberate act: take `main`'s latest commit, and say in the pull request that you did it.

## A pull request against `main`, exceptionally

**The default is never, and it is there for safety.** `main` is what production follows, and a
change we put on it is not ours to take back.

One thing lifts the default: **a clear defect in `main` itself** — the application broken on its own
terms, by the standard of whoever maintains it, with or without a pilot. Not pilot work with a good
reason behind it, and not an improvement we would like the application to have. A defect we are
unsure of waits.

The pull request **says what the defect is and argues for itself**, in the application's own words
(below). One that does not is the rule being broken rather than applied. Merging it is still a human
reading the diff (ADR-0014).

Two have gone through. [OpenRed#3](https://github.com/Ibercivis/OpenRed/pull/3) fixed a CI workflow
that failed on Python versions the runners no longer offer, and two dependencies missing from
`requirements.txt` without which a fresh clone does not start — both states of `main` that were not
the pilot's doing, though re-pointing `main` is what made the first one visible.
[OpenRed#4](https://github.com/Ibercivis/OpenRed/pull/4) added a compose file for running the suite
locally, which is **no defect at all** and would not have opened the door by itself. Convenience
travels well beside a real fix; that is the thing to watch for.

**A question in the body is not a gate.** `OpenRed#3` put three judgement calls to the owner and
merged with no reply, so all three stand as it proposed them. A pull request against `main` is
merged like any other. An answer that matters is obtained before the merge — the body is where it
gets recorded, not where it gets asked.

## Vocabulary: the application's words, never ours

**Everything we add to an external repository is named and explained in that application's own
terms.** The words this project runs on — pilot, Broker, Brokered App, Person, ADR-0009 — are
defined in `citsci-federation` and resolve nowhere else. To the people who maintain the application
they name nothing, and a name that explains nothing misleads instead: `requirements-pilot.txt` was
the local container's dependency list, so it was jargon *and* wrong about what the file was. That
is what [OpenRed#1](https://github.com/Ibercivis/OpenRed/pull/1#discussion_r4548674206) was asked
to change, and the reviewer was right on both counts.

The defaults cover almost everything:

- the local environment and its files — `local`, `local_dev/`, `LOCAL-DEV.md`
- what exists only because of the Broker — `federation`

Where our context is genuinely needed — usually *why a file exists at all* — it goes **once**, in
prose, in `LOCAL-DEV.md` or in the pull request body, with a link to the document that defines the
term. Never in a filename, never repeated comment by comment. Someone who does not follow that link
still has to understand what the file does.

This binds the pull request body and the replies to review comments exactly as it binds the code.

## Our issues close by hand

A pull request in an application repository says what becomes of the issue of ours it serves, in
GitHub's cross-repository spelling, in its body:

    Closes Ibercivis/citsci-federation#62     the pull request finishes the issue
    Part of Ibercivis/citsci-federation#62    it advances the issue, which stays open

An integration ticket here is wider than one pull request there — `Part of` is the usual answer, and
the acceptance criteria say which it is. Pick the true one, as in this repository.

**Neither line closes anything, `Closes` included.** A closing keyword is read only when the pull
request targets its own repository's default branch, and ours target `federation`: the keyword is
ignored, no link is made, and the merge leaves the issue open. The branch is what disqualifies it,
and the branch is not for trading — `main` is what production follows.

The line earns its place as a mention. The bare `Ibercivis/citsci-federation#62` registers a
cross-reference on that issue's timeline, so the issue shows which external pull request answers it
without anybody linking them by hand. **Whoever merges closes the issue**, in the pass they already
read the diff in (ADR-0014).

Two things would automate it: a token with write access to this tracker, held in a repository that
is not ours, or a scheduled job here that closes an issue once a cross-referenced pull request has
merged. The second, if the volume ever argues for it.

## Where `federation` is cut from

`main`'s latest commit, in **every** repository. There is no exception left; there was one until
12 November 2026, and the paragraph below is why it went away rather than being granted.

### OpenRed's `main` was re-pointed, once

Until 12 November 2026 `Ibercivis/OpenRed` deployed the branch `feature/weather-cache-and-stats`,
while `main` had stood still since July 2025 — it predated a model rewrite, holding neither the data
model nor the sign-in path the integration changes, so a `federation` cut from it would have
described a different application with nothing to integrate. The pilot moved `main` to that deployed
commit, so the default branch, the CI workflow and the documented update procedure now all describe
the application that actually runs, and `federation` is cut from `main`'s latest commit like
everywhere else. The deployed tree did not change by a byte; `main` was relabelled, not rebuilt.

This was a one-off on the application's own line of development, **not** a commit of pilot work onto
`main`, and it is not a precedent. Nor is it the exception above: that one is a pull request, and
this was not. The two commits the old `main` carried are preserved on
`legacy-main-user-groups-heatmap` and left to the application owner to accept or close in
[OpenRed#2](https://github.com/Ibercivis/OpenRed/pull/2).

The measurements that argued for the move are in
[`docs/notes/openred-live-branch.md`](../notes/openred-live-branch.md), which was written **before**
it and whose verdict the move overtook. Read it for the evidence, not for the recommendation.

## Commands

```bash
git fetch origin

# First time in a repository
git switch -c federation origin/main
git push -u origin federation

# Every change after that
git switch federation && git pull --ff-only
git switch -c <topic>            # topic branches come off federation
# ... commit on <topic> ...
git push -u origin <topic>
gh pr create --base federation   # never --base main
```

## Transition: a `federation` that was committed to directly

Until 11 November 2026 the pilot committed straight onto `federation`. Moving such a repository to
the reviewed shape loses nothing, because the commits are on the topic branch before `federation`
moves anywhere:

```bash
git fetch origin
git status --porcelain           # must be empty before going further
git branch <topic> federation    # the work, kept
git switch federation
git reset --hard origin/main     # federation becomes main's latest commit
git rebase federation <topic>    # only if main moved on; stop and report conflicts, don't force them
```

Then push both and open the pull request, whose body says that `federation` was refreshed from
`main`'s latest commit as part of the move.

`git reset --hard` is only safe here because `<topic>` already points at the commits and the working
tree is clean. Check both, and check that **no other session is working in that clone** — a reset
moves `HEAD` out from under anyone who is on `federation`.

## Before the first commit

- `git branch --show-current` prints a **topic branch** — never `federation`, never `main`.
- `gh pr create` carries `--base federation`.
- The body carries `Closes Ibercivis/citsci-federation#<n>`, or `Part of` it, when an issue of ours
  is served by this change. Nothing acts on it; see **Our issues close by hand**.
- `scripts/check-foreign-vocabulary.sh`, from this repository, run in the external clone, prints
  nothing — or every line it printed has been read and kept deliberately. Give it the pull request
  body as well, before `gh pr create` writes it.
- `git log --oneline origin/main..<topic>` shows only pilot work, so the branch is still a
  descendant of `main` and nothing unrelated rode in. This now holds in every repository, OpenRed
  included: before 12 November 2026 the base of that range there was
  `origin/feature/weather-cache-and-stats`.

## Why

The applications are in production and are not ours. A branch that is ours by convention keeps the
integration reviewable and reversible: the change set for each application is exactly
`origin/main..federation`, a deploy is a branch name, and withdrawing the integration costs deleting
a branch rather than reverting commits in someone else's main line. Review before `federation`
rather than after keeps that change set something we have each read.
