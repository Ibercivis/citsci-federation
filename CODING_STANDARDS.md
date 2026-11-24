# Coding standards

Short on purpose. Almost everything this repository asks of its code is
enforced by something that runs, and what runs says it better than a document
would: `.oxlintrc.json` carries the lint policy and the reason behind every
rule that is switched off, `.oxfmtrc.json` the formatting, `lefthook.yml` what
happens on commit and on push, `tsconfig.json` what TypeScript is allowed to
let through, `REUSE.toml` which licence covers which file, and
`.github/workflows/ci.yaml` what runs where no `--no-verify` reaches. Read
those before this file; a rule written in both places is a rule that will
disagree with itself. `docs/verification.md` indexes them, and says what we
would add next and what would trigger it.

What is left here is what no tool checks and a reviewer would not notice.

## `pnpm check` is the definition of a check

The formatter, the linter, the type checker, the cases each Claude Code hook
has to get right, and `reuse lint` — which fails when a file's licence cannot
be established from `REUSE.toml` or its text is missing from `LICENSES/`
(ADR-0013) — all run against this repository. `pnpm check` runs them, the
`pre-push` hook runs `pnpm check`, and CI runs `pnpm check`. There is one
definition and three callers.

So a new check is added to `pnpm check`, never to the hook or the workflow
alone. A check that lives only in CI is one nobody can run before pushing, and
a check that lives only in the hook is one `--no-verify` deletes.

`reuse lint` runs from a container, so `pnpm check` needs Docker running;
ADR-0013 says why.

The end-to-end suite stays out of it, because it has a precondition: it needs
a Broker answering. `pre-push` runs it when one is up
and skips it when none is, CI starts its own and has no such escape, and
locally it is `pnpm broker:up` then `pnpm test`. `lefthook.yml` holds the
reasoning.

The pull request metadata check stays out for the same kind of reason: its input is a
pull request's title and body, which do not exist until there is a pull
request. `.github/workflows/pr.yaml` runs it and
`scripts/check-pr-metadata.sh` is the check itself, runnable by hand with a
title and a body as its first two arguments.

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

Nothing above notices a pin going stale. `.github/dependabot.yml` is what
does.

## A script's name carries what a directory would

`scripts/` is flat but for the one directory below, and the prefix is what
groups the rest. `check-*` is a gate: it reads some state, says what is wrong
and exits non-zero. A gate is named that way wherever it is wired —
`lefthook.yml`, `.github/workflows/pr.yaml`, or a person's shell — because
what the name has to survive is being read in `ls`, not being read beside its
caller.

Issue [#102](https://github.com/Ibercivis/citsci-federation/issues/102) holds
why it stays that way elsewhere: the split by environment that was refused and
why it discriminated nothing. The third reason it gives is spent: the
`shellcheck` glob a nested directory would have emptied is gone, because CI
asks git for every tracked script instead of globbing one directory.

`scripts/hooks/` is the one exception, and what earns it is not a count. A
Claude Code hook obeys a contract a new script can get wrong **silently** —
written like a gate, it refuses nothing and the tool call goes through
unremarked. A name in `ls` cannot carry that, so the directory does, and
`scripts/hooks/README.md` is where the contract itself is written down.
Nothing else in `scripts/` earns a directory until it too has a way of failing
that nobody sees.

A hook's own cases stay out of `hooks/` and reach into it:
`check-require-issue-link.sh` and `check-claim-issue.sh` are gates in
`pnpm check`, and inside that directory they would be the files there
disobeying the contract.

What a gate may share, a hook may not. A gate runs under `set -euo pipefail`,
so a helper it cannot find kills it and the push fails saying why; a hook that
missed one would exit non-zero, and any status but 0 and 2 hands the tool call
through unremarked. So the `check-*` gates may source a helper between them,
and a rule a hook enforces stays written out in that hook.

Issue [#208](https://github.com/Ibercivis/citsci-federation/issues/208) holds
why the ~30 lines the two hook harnesses share stay duplicated at two callers.
A third caller is the condition that changes that answer.
