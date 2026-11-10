# Citizen Science Federation

## Language

**Write every document in English**, including the gitignored notes under `docs/private/`: ADRs,
`GLOSSARY.md`, specs, agent docs, learning artifacts, issue and PR bodies, commit messages. This
holds whatever language the request was made in — a Spanish prompt still produces English documents.
Reply to the user in their language; write the files in English. See ADR-0008.

Documents, not conversations: text addressed to someone outside the project (a mail to a supplier,
a message to a partner) is drafted in the language that person reads, and what the repo keeps is the
English record of it, noting at the top when the original was sent in another language.

If you find Spanish in a document you are already editing, translate that document as part of the
change rather than leaving it half-translated.

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
New pages are written in English; the Spanish ones already published are listed in English
and rewritten only when next touched (ADR-0008).

### Internal notes

`docs/private/` is gitignored operational material (server inventory, access notes).
This repo is **public**. Never quote its contents — IPs, SSH users, software versions,
database users, known weaknesses — into issues, PRs, commit messages, learning artifacts
or any other published surface. Read it to do the work; describe conclusions without the detail.
Never `git add -f` anything under it.
