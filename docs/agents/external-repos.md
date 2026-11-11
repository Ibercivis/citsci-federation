# External repositories: the `federation` branch

Scope: every repository that is **not this one** — the Ibercivis application repositories that become
Federated Apps, and anything else whose code the pilot has to change. Work inside
`citsci-federation` itself is unaffected.

## The rule

**Never commit to `main` or `master` in an external repository.** All pilot work lives on a branch
named exactly `federation` — no prefix, no suffix, one per repository. `federation` is the main
branch of our prototype:

- It is created from the **latest commit of `main`**, and only ever from there.
- Pull requests target `federation`, never `main`.
- The pilot deploys from `federation`. Production keeps following `main` and this work never touches it.
- The application's **container recipe for the pilot** lives here too — a Dockerfile and the
  environment it needs, so the application can join the Pilot Composition (ADR-0009). It is written
  for the pilot and for nothing else, and `main` never sees it.
- The repository's default branch stays as it is. We don't change it, and we don't ask for it.

If `federation` already exists in a repository, use it rather than recreating it. Refreshing it from
`main` is a deliberate act: take `main`'s latest commit, and say in the pull request that you did it.

## Commands

```bash
git fetch origin

# First time in a repository
git switch -c federation origin/main
git push -u origin federation

# Afterwards
git switch federation && git pull --ff-only
git switch -c <topic>            # topic branches come off federation
gh pr create --base federation   # never --base main
```

## Before the first commit

- `git branch --show-current` prints `federation`, or a topic branch cut from it.
- `gh pr create` carries `--base federation`.
- `git log --oneline origin/main..federation` shows only pilot work, so the branch is still a
  descendant of `main` and nothing unrelated rode in.

## Why

The applications are in production and are not ours. A branch that is ours by convention keeps the
integration reviewable and reversible: the change set for each application is exactly
`origin/main..federation`, a deploy is a branch name, and abandoning the pilot costs deleting a
branch rather than reverting commits in someone else's main line.
