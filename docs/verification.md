# Verification tooling

What runs against this repository, and what we would add next. Three layers: what checks the code
today, where it runs, and what is deliberately absent.

Nothing is decided here. Every tool's reasoning lives next to the tool, in its own config file,
and this page is an index onto that — a rule written in both places is a rule that will disagree
with itself. `CODING_STANDARDS.md` holds the two rules no tool enforces.

## Layer 0 — what checks the code

| Question | Tool | Command | Reasoning lives in |
|---|---|---|---|
| Is it formatted? | oxfmt | `pnpm format:check` | `.oxfmtrc.json` |
| Is it wrong? | oxlint, type-aware | `pnpm lint` | `.oxlintrc.json` |
| Does it type-check? | `tsc --noEmit` | `pnpm typecheck` | `tsconfig.json` |
| Does a sign-in actually work? | Vitest against a real Broker | `pnpm broker:up && pnpm test` | `compose.yaml`, ADR-0010 |

`pnpm check` is the first three, and is the only definition of "checked": **1.3 seconds** on the
whole tree. The suite is 12 cases in **1.6 seconds**, because every case reuses one running Broker.

Lint runs `correctness` and `suspicious` only. Chosen by counting, not by taste: those two found 1
finding here, `style` found 276. Type-aware rules are on, which needs the `oxlint-tsgolint`
package and works on TypeScript 5.9 — TypeScript 7 is not a prerequisite.

Every version in `package.json` is exact. A caret on a linter means a commit rejected by a diff
that is not yours.

## Layer 1 — where it runs

| | Runs | Escape |
|---|---|---|
| `pre-commit` | format + lint, staged files only, **checks and never fixes** | `--no-verify` |
| `pre-push` | `pnpm check`; the suite too, when a Broker is up | `--no-verify` |
| CI | `pnpm check`, then its own Broker and the suite | none for the developer |

CI cannot be skipped the way a hook can, but **a red CI does not stop a merge**: `main` carries no
branch protection and no rulesets, so the workflow reports and nothing acts on the report.

One definition, three callers. A new check is added to `pnpm check`, never to the hook or the
workflow alone: a check that lives only in CI is one nobody can run before pushing, and a check
that lives only in the hook is one `--no-verify` deletes.

The suite is the single exception, because it is the one check with a precondition. A hook that
fails for environmental reasons is a hook people pass `--no-verify` to by habit, so it steps aside
when no Broker is running. CI has no such excuse — it starts one.

## Layer 2 — what we do not have, and what would buy it

Each row has a trigger. None of them is due yet, and adding one before its trigger costs CI time
for nothing.

| Gap | Candidate | Real cost | Trigger |
|---|---|---|---|
| **Module boundaries** — features must not import each other ([#43](https://github.com/Ibercivis/citsci-federation/issues/43)) | dependency-cruiser 18.7.2, the only maintained ESLint-free option | A second, non-Rust pass. `pre-push` and CI only | A `src/` with more than one feature in it |
| ↳ or, for free ([#45](https://github.com/Ibercivis/citsci-federation/issues/45) watches it) | oxlint `import/no-restricted-paths` | Five lines of `.oxlintrc.json` | [oxc#13789](https://github.com/oxc-project/oxc/issues/13789). Watch that one issue; it is the whole dependency |
| **Our own CI and scripts** — nothing checks either | `actionlint` for the workflow, `shellcheck` for `scripts/*.sh` | One step each, seconds | Arguably already fired: a YAML typo in `ci.yaml` was caught by hand while writing it |
| **Errors before the commit, not at it** | oxlint's editor integration — `oxc.oxc-vscode`, or `oxlint --lsp` elsewhere; type-aware is supported in VS Code | Per-person config. The repo's share is a `.vscode/extensions.json` recommendation | Whenever either of us wants it. The hook is the backstop, not the feedback loop |
| **Dead code** — unused files and exports | knip 6.45 | A third pass, but it is the thing that actually rots in a feature-sliced tree | When nobody would notice an orphan |
| **Mutation testing** | StrykerJS 10.1.1 + `@stryker-mutator/vitest-runner` | The runner forces `threads: true` and one worker, and ignores `coverageAnalysis`. Cost is controlled by `incremental: true`, **not** by `--since`, which does not exist in StrykerJS | One module of pure logic worth really trusting. Never on `pre-commit`, never on every PR |
| **Faster hooks** | hk 2.12.0 — per-file read/write locks, so fixers can run concurrently; ships `ox-lint` and `oxfmt` builtins | Config is Pkl, and it is not on npm. Only published benchmark is the vendor's: ~1.2× ahead of lefthook on a small commit | When `pre-commit` stops feeling instant. 1.3s says not yet |
| **Faster type check** | TypeScript 7 — `tsc` *is* the Go port, ~8–12× on full builds | No compiler API until 7.1 | When `tsc --noEmit` is the slow part of `pnpm check` |
| ↳ and then three passes become two | `oxlint --type-check` — reports compiler errors from the same TypeScript program it lints with, and oxc documents it as replacing a separate `tsc --noEmit` in CI | Requires TypeScript 7, so it is the row above or nothing. Keep `tsc --noEmit` until both have run on this tree and the output has been compared | The row above. Neither alone |
| **Newer runner** | Vitest 5.1 | Breaking: `clearMocks` defaults to `true`, unawaited `resolves`/`rejects` now fail, strict locators. Its own benchmark shows the common case gaining least | Nothing. We are on 3.2.7 and it answers in 1.6s |
| **Coverage** | `@vitest/coverage-v8` | — | A number we would act on. We do not have one yet |
| **Who bumps the pins** | Dependabot or Renovate, grouped and scheduled | Exact pins mean every bump is a pull request, so grouping is the whole design | When a version here is old enough that neither of us remembers choosing it |

Also considered and rejected: **Vite+** (takes too many decisions for us, and its `vp hooks` fights
lefthook for `core.hooksPath`), **eslint-plugin-boundaries** (requires ESLint), **steiger** (beta,
and its rules are Feature-Sliced Design whatever the billing says).

There is no Rust-based mutation tester for JS/TS, and no Vitest-native one.

_Versions and claims checked 12 November 2026._
