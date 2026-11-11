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
Pages are written in English, titles included (ADR-0008).

### External repositories

Work on the Ibercivis application repositories never touches `main` or `master`. Each of them gets a
branch named `federation`, cut from the latest commit of `main`: PRs target it and the pilot deploys
from it. See `docs/agents/external-repos.md`.

### Research notes

`docs/notes/` holds dated evidence, never decisions. Each note opens with its verdict and a "read on
only if" line, so take the verdict from here and open a note only when one of its branches is yours.
When a finding changes a decision, move it into the ADR or spec that owns it: the note keeps the
citation, not the authority.

- **AUTHENIX** (`authenix-research.md`) — rejected as our Broker: it mints the subject identifier
  per identity, has no Person, no local credential, no SLA, and its funding ends 31 Dec 2026. Open it
  for eduGAIN reach without eduGAIN membership, for consent and data-subject design, or to defend
  ADR-0002 and ADR-0003.
- **Cos4Cloud** (`cos4cloud-research.md`) — closed H2020 project; nothing adoptable, its sign-on was
  AUTHENIX. Open it for OGC Best Practice 21-068 (STAplus) before the resource-discovery service
  gets a vocabulary, or for what EOSC onboarding really costs.
- **Veridas** (`veridas-technical-questions.md`) — frozen; five questions sent 10 Nov 2026, awaiting
  a reply. It predates the current identity model and contradicts it in places, deliberately.

### Internal notes

`docs/private/` is gitignored operational material (server inventory, access notes).
This repo is **public**. Never quote its contents — IPs, SSH users, software versions,
database users, known weaknesses — into issues, PRs, commit messages, learning artifacts
or any other published surface. Read it to do the work; describe conclusions without the detail.
Never `git add -f` anything under it.

### Production databases

Do not modify a production database. No `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `ALTER`, `DROP`, no
`manage.py migrate`, no write from a Django or `psql` shell on a production host — unless the user
asks for that specific change, in that turn, in so many words. Having access is not permission, and
neither is a write being the obvious next step in the task. Read-only diagnosis needs no permission.
When a write looks necessary, stop, say exactly what you would run, and let the user decide.

This rule enforces nothing on its own: it is cooperation, deliberately chosen over a real boundary
for now. See `docs/notes/deferred/preventing-agent-writes-to-production-databases.md`.

### Deferred notes

`docs/notes/deferred/` holds research that was done, decided on, and parked. Don't read it unless the
task at hand is that topic; its header says what was decided and when.
