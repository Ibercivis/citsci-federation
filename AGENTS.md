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

GitHub Issues in `Ibercivis/citsci-federation`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

A commit in this repository opens its subject with the issue it serves, as `[#51] Rename Federated
App to Brokered App`, so its origin shows in `git log --oneline`; a commit no issue asked for opens
with its subject alone. Only this repository's commits: an application repository has issues of
its own, and `docs/private/` is committed by its script.

### Review replies

An agent never posts a reply to a review comment the user hasn't read. Draft them, show them, post
only what the user approved in that turn — `gh` and the GitHub UI are the same thing here.

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
from it. **What we add there is named in that application's words, never in ours** — our vocabulary
stays in this repository. See `docs/agents/external-repos.md`.

### Local environments

**Every Brokered App gets one, built as it is integrated**, and **none of them takes data from
production**: the realistic half of the dataset is rebuilt from a public source and the half that
would carry personal data is invented, so there is nothing to anonymise. The environment and its
seed command live on that application's `federation` branch, in a `LOCAL-DEV.md` at its root.

What has to work is **signing in and the profile that follows the Person** (ADR-0009). Everything
else is scenery, so a blank map is not a defect: these applications need a Mapbox token nobody has
locally, and hunting for one is wasted time. Record what is blank and move on.

The index, and the order that worked for the ones already built, is `docs/local-development.md`.
Read it before building the next one; an application missing from it has no local environment.

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
- **OpenRed's live branch** (`openred-live-branch.md`) — **spent as advice.** Its `main` predated a
  model rewrite, so `federation` was cut from `feature/weather-cache-and-stats`; on 12 November 2026
  `main` was re-pointed to the deployed commit, and `federation` is now cut from `main` like
  everywhere else. The rule has no exception left — it lives in `docs/agents/external-repos.md`.
  Open the note for the measurements that argued for the move, not for its recommendations.

### Internal notes

`docs/private/` is gitignored operational material: server inventory, access notes, and the security
findings register described below.
This repo is **public**. Never quote its contents — IPs, SSH users, software versions,
database users, known weaknesses — into issues, PRs, commit messages, learning artifacts
or any other published surface. Read it to do the work; describe conclusions without the detail.
Never `git add -f` anything under it.

It is **its own private repository**, `Ibercivis/citsci-federation-private`, cloned at that path: the
canonical copy, carrying the history and the backup this folder never had. A fresh checkout fetches
it once, into an empty `docs/private/`:

    git clone https://github.com/Ibercivis/citsci-federation-private.git docs/private

Nobody runs git in there by hand afterwards. `scripts/private-sync.sh`, wired to the `SessionStart`
and `Stop` hooks, pulls it when a session opens and commits and pushes it when a turn ends. Commit
straight to `main` — there are no pull requests on it. A `pre-commit` job refuses any commit that
stages `docs/private/` into *this* repository, and the nested repository makes its files unstageable
here in the first place.

### Security findings

A weakness found in a Brokered App's code is recorded in `docs/private/security-findings.md` in the
turn it is found, and reaches nothing public — the Internal notes rule above covers it. Before
recording one, or reporting one to its owner: `docs/agents/security-findings.md`.

### Migration requirements

What an integrated Brokered App's **existing** accounts would need to move onto the Broker is
recorded per app in `docs/migration/<app>.md`, as the integration turns it up. Migration is outside
the pilot's committed scope and a record is not a commitment. Requirements are public, measurements
taken from a production database are not: `docs/agents/migration-requirements.md`.

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
