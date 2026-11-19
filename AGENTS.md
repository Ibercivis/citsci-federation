# Citizen Science Federation

## Language

**Write every document in English**: ADRs, `GLOSSARY.md`, specs, agent docs, orientation docs,
issue and PR bodies, commit messages, and the gitignored notes under `docs/private/`. A Spanish
prompt still produces English documents. Reply to the user in their language. See ADR-0008.

Text addressed outside the project — a mail to a supplier, a message to a partner — is drafted in
the language that person reads. The repo keeps the English record, noting at the top when the
original went out in another language.

Translate any Spanish you find in a document you are already editing, as part of the change.

## What goes in a document

A document here lands in an agent's context before a person opens it. A line that changes no
decision is paid for in every future session, and it rots unseen.

Write only what a reader cannot get by running the code: a decision and what it rules out, a
constraint, the condition that would change our mind, a dead end nobody should walk twice. When a
number carries the argument, it goes in a dated note under `docs/notes/`.

Leave out:

- **Measurements of the present.** Timings, test counts, pass rates, "all green". The command
  answers faster.
- **A defence of something that works.** The day it breaks is the day that reasoning is worth
  writing down.
- **Anything a config file already says.** A rule written in two places will disagree with itself.

Say it plainly: short sentences, one point each, no preamble and no summing up. An agent copies the
register of whatever it reads, which is why this file is written the way it is.

## Agent skills

### Issue tracker

GitHub Issues in `Ibercivis/citsci-federation`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

A commit subject opens with the issue it serves: `[#51] Rename Federated App to Brokered App`. A
commit no issue asked for opens with its subject alone. This repository only — an application
repository has its own issues, and `docs/private/` is committed by its script.

**The prefix is traceability. The pull request body closes the ticket.** GitHub acts only on
`Closes #<n>` in the body, and only on a merge into the default branch; #55 merged without one and
left #52 open. A pull request that finishes a ticket carries that line; one that advances it says
`Part of #<n>`.

**Name the kind when you mention one**: `issue #62`, `PR #63`. A bare `#62` is ambiguous, because
GitHub numbers both from one sequence — a pull request is an issue in its data model, which is why
`/issues/69` redirects to `/pull/69`. This holds in a reply to the user as much as in a document.

The spellings a machine reads are exempt and stay bare: the `[#62]` commit prefix, and `Closes #<n>`
or `Part of #<n>` in a body. GitHub and the hook below match those literally. When a number is
already in hand and its kind is not, `gh pr view <n>` settles it by failing on an issue; `gh issue
view <n>` answers for both and settles nothing.

Two hooks hold this up: one refuses a pull request that says neither, the other assigns the issue
when work lands on an `issue-<n>` branch, which is what a claim means here.

### Pull request bodies

`mattpocock-skills:pr` holds the template — Summary, Evidence, Merge Danger — and it stays as it is.

One thing on top of it: say what the pull request does in two or three sentences, early, so a
reviewer knows what they are looking at before scrolling. Below that, go as deep as the change
needs — nothing limits the total length.

### Review replies

An agent never posts a reply to a review comment the user has not read. Draft it, show it, post
only what the user approved in that turn. `gh` and the GitHub UI are the same thing here.

### Triage labels

The five canonical triage labels, unchanged. See `docs/agents/triage-labels.md`.

### Merging

An agent never merges a pull request: not with `gh`, not in the web UI, not by asking for
auto-merge, which is off at the repository and not an agent's to turn back on. Every merge is a
human pressing the button after reading the diff. Green checks are the precondition, never the
verdict. See ADR-0014.

Bring a branch up to date by rebasing it onto `main`, never by merging `main` into it, so the only
merge commit in its history is the one that lands it. Stop once somebody else has pulled the branch:
rewriting it under them is worse than the merge commit it saves.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Orientation docs

`docs/orientation/` holds short explainers of the spec and the ADRs, for whoever meets the pilot
first. They decide nothing: the spec, `GLOSSARY.md` and `docs/adr/` are the source of truth, and an
explainer that disagrees with them is the thing that is wrong. Keep them **short** — they point at
the source instead of restating it, and a file is deleted once what it explains is understood.
English, titles included (ADR-0008).

**Nothing is published as a Claude artifact.** ADR-0015 holds the reasoning. The `Artifact` tools
are denied in `.claude/settings.json`.

### External repositories

Work on the Ibercivis application repositories never touches `main` or `master`. Each gets a branch
named `federation`, cut from the latest commit of `main`: PRs target it and the pilot deploys from
it. **What we add there is named in that application's words, never in ours** — our vocabulary stays
in this repository. See `docs/agents/external-repos.md`.

### Brokered App integrations

What every integration is held to — security, extensibility, and what it costs the application
being integrated — and the questions its pull request answers. See
`docs/agents/brokered-app-integration.md`. The criteria are weighed in that order and the first is
not traded away; a rule of ours that only hand-written protocol code in each application can
satisfy is evidence against the rule (ADR-0016).

### Local environments

**Every Brokered App gets one, built as it is integrated**, and **none takes data from production**:
the realistic half of the dataset is rebuilt from a public source, the half that would carry
personal data is invented, so there is nothing to anonymise. The environment and its seed command
live on that application's `federation` branch, in a `LOCAL-DEV.md` at its root.

What has to work is **signing in and the profile that follows the Person** (ADR-0009). Everything
else is scenery. A blank map is not a defect: these applications need a Mapbox token nobody has
locally. Record what is blank and move on.

`docs/local-development.md` is the index, and the order that worked for the ones already built.
Read it before building the next one; an application missing from it has no local environment.

### Research notes

`docs/notes/` holds dated evidence, never decisions. Each note opens with its verdict and a "read on
only if" line. Take the verdict from here; open a note only when one of its branches is yours. When
a finding changes a decision, move it into the ADR or spec that owns it — the note keeps the
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
- **OpenRed's live branch** (`openred-live-branch.md`) — **spent as advice.** Its `main` once
  predated a model rewrite; `main` was re-pointed on 12 November 2026 and `federation` is cut from
  it like everywhere else. The rule has no exception left: `docs/agents/external-repos.md`. Open the
  note for the measurements, not for its recommendations.
- **`oxlint --type-check`** (`2026-11-18-oxlint-type-check.md`) — it reproduces `tsc --noEmit`
  exactly, on the pins we have, and needs neither TypeScript 7 nor `tsrs`. Unadopted on value, not
  on risk. Open it before folding the two passes into one, or before putting `tsrs` in the gate —
  `issue #83` watches that.
- **The account REST API** (`2026-11-18-account-rest-api-credential-operations.md`) — it reads
  credentials, Identities and sessions, and changes no password and no address: those are
  `kc_action` browser steps. It cannot replace the Account Console from a server. Open it before
  automating a Person's credential operations or building a profile screen.
- **Conditional subflows and the brokered `email_verified`**
  (`conditional-subflow-and-brokered-email-verified.md`) — no condition Keycloak ships can see what
  an arriving Identity's source said about its address, which is why `broker/verified-email/` is our
  code. Open it before reaching for `conditional-user-attribute`, or to cost anything else that
  needs the brokered context inside a first broker login flow.

### Internal notes

`docs/private/` is gitignored operational material: server inventory, access notes, and the security
findings register described below.
This repo is **public**. Never quote its contents — IPs, SSH users, software versions,
database users, known weaknesses — into issues, PRs, commit messages, orientation docs
or any other published surface. Read it to do the work; describe conclusions without the detail.
Never `git add -f` anything under it.

It is **its own private repository**, `ibercivis-federation/citsci-federation-private`, cloned at
that path: the canonical copy, carrying the history and the backup this folder never had. It lives
in its own organisation so that access to it is the three people who need it, not every owner of
`Ibercivis`. A fresh checkout fetches it once, into an empty `docs/private/`:

    git clone https://github.com/ibercivis-federation/citsci-federation-private.git docs/private

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

Do not modify a production database. No `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `ALTER`, `DROP`,
no `manage.py migrate`, no write from a Django or `psql` shell on a production host — unless the
user asks for that specific change, in that turn, in so many words. Having access is not permission;
neither is a write being the obvious next step. Read-only diagnosis needs no permission. When a
write looks necessary, stop, say exactly what you would run, and let the user decide.

This rule enforces nothing on its own: it is cooperation, chosen over a real boundary for now. See
`docs/notes/deferred/preventing-agent-writes-to-production-databases.md`.

### Deferred notes

`docs/notes/deferred/` holds research that was done, decided on, and parked. Don't read it unless the
task at hand is that topic; its header says what was decided and when.
