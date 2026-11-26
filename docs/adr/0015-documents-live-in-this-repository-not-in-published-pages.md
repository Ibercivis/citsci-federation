# Documents live in this repository, not in published pages

Everything this project keeps as a record is a **file in this repository**: ADRs, the spec, the
glossary, the agent docs, the notes, and the short explainers that used to be published pages.
Those explainers now live in `docs/orientation/` as Markdown. **Nothing the project relies on is
published as a Claude artifact**, and the `Artifact` tools are denied in `.claude/settings.json` so
that an agent cannot publish one by reflex.

The reason is that a document outside version control **drifts in silence**. A file in the
repository is diffed, reviewed in a pull request, renamed when the vocabulary is renamed, and
visible to everybody who can read the repo. A published page has none of that: no diff, no review,
no blame, and a sharing state of its own that nobody audits. Nothing fails when it goes stale.

This is not a prediction; it is what happened. Two pages were published in November 2026 and both
rotted within a week of the decisions they explained. They still said *Federated App* after issue
#51 renamed it to Brokered App. One page's third figure asserted that two Identities sharing an
email address produce two Persons — the opposite of what ADR-0004 then decided, which is what issue
#20 was opened for. The same page's third card promised the Broker holds no passwords, which
ADR-0005 had already overturned. Had those pages been files, the renaming commit and both ADRs
would have had to touch them, and a reviewer would have seen the contradiction in the diff.

There is a second reason, specific to this project: these documents are read by **agents**, into a
context window. A short file that points at the spec costs a reader once; a page that restates the
spec costs them twice and then disagrees with it. Keeping explainers in the repository is what makes
their length something a reviewer can see and object to.

This supersedes the *learning artifacts* practice, which ADR-0008 named among the documents written
in English. The language rule is unaffected: orientation docs are written in English like everything
else.

## Considered Options

- **Keep publishing pages, and index them in the repository.** This was the practice in force, as
  `docs/learn-artifacts.md`. Rejected: an index records a link, not the content, so the drift stays
  invisible — the index cannot be reviewed against what it points at. It also promised that pages
  would be deleted once understood, which never happened, because nothing in a repository fails when
  a page outlives its purpose.
- **A rule in `AGENTS.md`, without denying the tool.** Rejected, and this is the one place where this
  repository does not settle for cooperation. The harness's own `Artifact` tool instructs the agent
  to publish finished work meant for other people, and to do it unprompted. A cooperative line in
  `AGENTS.md` would compete with that instruction in every session, which is a bet lost eventually.
  The production-database rule (`docs/notes/deferred/`) stays cooperative because no real boundary
  was available there; here one is, and it costs three lines.
- **Published pages for figures only, Markdown for prose.** The honest cost of this decision: an SVG
  figure reads better than an ASCII diagram, and the four figures were the best part of what was
  retired. Rejected anyway, because the figures were also the part that contradicted the ADRs, and a
  diagram nobody can diff is exactly the artefact that goes wrong quietly. A figure worth keeping is
  worth committing — as ASCII, or as an SVG file in the repository.

## Consequences

`docs/learn-artifacts.md` is deleted and `AGENTS.md` describes `docs/orientation/` in its place. The
two published pages were distilled into `docs/orientation/architecture.md` and
`docs/orientation/keycloak.md` — rewritten from the spec and the ADRs rather than copied, since both
were by then wrong — and then deleted, on 16 November 2026. The links already shared with the team
are dead on purpose: a dead link sends the reader to the spec, a stale page does not. Issue #20 is
resolved by that retirement rather than by redrawing the figure.

The deny rule binds the agent in the legitimate cases too. Publishing anything, even at the user's
explicit request, now means removing those three lines by hand — and an agent cannot do it, because
auto mode's classifier refuses an agent that edits its own permissions. That friction is the
decision working, not a defect in it.

What survived the distillation is worth naming, because it is the test of whether a page was worth
publishing at all: of two pages, one table — Keycloak's vocabulary against the glossary's. Everything
else was either already in `broker/README.md` and the spec, or wrong.
