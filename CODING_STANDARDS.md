# Coding standards

Short on purpose. Almost everything this repository asks of its code is
enforced by something that runs, and what runs says it better than a document
would: `.oxlintrc.json` carries the lint policy and the reason behind every
rule that is switched off, `.oxfmtrc.json` the formatting, `lefthook.yml` what
happens on commit and on push, `tsconfig.json` what TypeScript is allowed to
let through, and `.github/workflows/ci.yaml` what runs where no `--no-verify`
reaches. Read those before this file; a rule written in both places is a rule
that will disagree with itself. `docs/verification.md` indexes them, and says
what we would add next and what would trigger it.

What is left here is what no tool checks and a reviewer would not notice.

## `pnpm check` is the definition of a check

Three things run against this repository: the formatter, the linter and the
type checker. `pnpm check` runs all three, the `pre-push` hook runs
`pnpm check`, and CI runs `pnpm check`. There is one definition and three
callers.

So a new check is added to `pnpm check`, never to the hook or the workflow
alone. A check that lives only in CI is one nobody can run before pushing, and
a check that lives only in the hook is one `--no-verify` deletes.

The end-to-end suite stays out of it, because it is the one check with a
precondition: it needs a Broker answering. `pre-push` runs it when one is up
and skips it when none is, CI starts its own and has no such escape, and
locally it is `pnpm broker:up` then `pnpm test`. `lefthook.yml` holds the
reasoning.

## Dependency versions are exact

Every version in `package.json` is a single version, not a range. Install with
`pnpm add --save-exact` (or `-E`), and when something is upgraded, upgrade it
on purpose.

The reason is the toolchain rather than the libraries. A linter and a formatter
decide whether a commit is allowed to land, so a caret that quietly moves one
of them turns "the formatter changed its mind" into "your commit is rejected
and the diff is not yours", on whichever machine installed last. CI runs
`pnpm install --frozen-lockfile`, which is what makes these versions mean
anything; nothing stops the next `pnpm add` from writing a caret except this
paragraph.
