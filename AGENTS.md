# Citizen Science Federation

## Agent skills

### Issue tracker

GitHub Issues in `agualis/citsci-federation`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage labels, unchanged. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Learning artifacts

Published pages that explain the specs and ADRs, indexed in `docs/learn-artifacts.md`.
After publishing one, ask whether to add it to the index. Don't add it unasked.

### Internal notes

`docs/private/` is gitignored operational material (server inventory, access notes).
This repo is **public**. Never quote its contents — IPs, SSH users, software versions,
database users, known weaknesses — into issues, PRs, commit messages, learning artifacts
or any other published surface. Read it to do the work; describe conclusions without the detail.
Never `git add -f` anything under it.
