# External repositories: the `federation` branch

Scope: every repository that is **not this one** — the Ibercivis application repositories that become
Federated Apps, and anything else whose code the pilot has to change. Work inside
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
- Pull requests target `federation`, never `main`.
- The pilot deploys from `federation`. Production keeps following `main` and this work never touches it.
- The application's **container recipe for the pilot** lives here too — a Dockerfile and the
  environment it needs, so the application can join the Pilot Composition (ADR-0009). It is written
  for the pilot and for nothing else, and `main` never sees it.
- The repository's default branch stays as it is. We don't change it, and we don't ask for it.

If `federation` already exists in a repository, use it rather than recreating it. Refreshing it from
`main` is a deliberate act: take `main`'s latest commit, and say in the pull request that you did it.

## Where `federation` is cut from

`main`'s latest commit, in every repository but one.

**OpenRed** (`Ibercivis/OpenRed`) is cut from `origin/feature/weather-cache-and-stats`, because
**`main` predates a model rewrite: it has neither the data model nor the sign-in path the integration
changes.** `main` holds only `Measurement` and `Track` in `measures/models.py` and one route,
`/api/measurements/`, while the live React front end and the deployed devices call
`/api/radiation-measurements/`, `/api/stations/`, `/api/stats/`, `/api/tracks/` and
`/api/ingest/radiation/`; the whole sign-in surface ADR-0007 asks us to change exists only on the
feature branch. A `federation` cut from `main` would not be a behind-the-times OpenRed, it would be a
different application with nothing to integrate. The branch is eighteen commits ahead of `main` and
two behind, and the local environment was built against it.

The deviation is therefore not a tolerated staleness but the only cut that describes the
application. Every pull request that targets that `federation` says so. `main` is where the branch
would be re-cut from the day that work merges — see
[`docs/notes/openred-live-branch.md`](../notes/openred-live-branch.md) for the evidence, for what
that merge would cost, and for why it is the application owner's call and not ours.

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
- `git log --oneline origin/main..<topic>` shows only pilot work, so the branch is still a
  descendant of `main` and nothing unrelated rode in. In OpenRed the base of that range is
  `origin/feature/weather-cache-and-stats`.

## Why

The applications are in production and are not ours. A branch that is ours by convention keeps the
integration reviewable and reversible: the change set for each application is exactly
`origin/main..federation`, a deploy is a branch name, and abandoning the pilot costs deleting a
branch rather than reverting commits in someone else's main line. Review before `federation` rather
than after keeps that change set something we have each read.
