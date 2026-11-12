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
| CI | `pnpm check`, then its own Broker and the suite | none |

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
| ↳ or, for free | oxlint `import/no-restricted-paths` | Five lines of `.oxlintrc.json` | [oxc#13789](https://github.com/oxc-project/oxc/issues/13789). Watch that one issue; it is the whole dependency |
| **Dead code** — unused files and exports | knip 6.45 | A third pass, but it is the thing that actually rots in a feature-sliced tree | When nobody would notice an orphan |
| **Mutation testing** | StrykerJS 10.1.1 + `@stryker-mutator/vitest-runner` | The runner forces `threads: true` and one worker, and ignores `coverageAnalysis`. Cost is controlled by `incremental: true`, **not** by `--since`, which does not exist in StrykerJS | One module of pure logic worth really trusting. Never on `pre-commit`, never on every PR |
| **Faster hooks** | hk 2.12.0 — per-file read/write locks, so fixers can run concurrently; ships `ox-lint` and `oxfmt` builtins | Config is Pkl, and it is not on npm. Only published benchmark is the vendor's: ~1.2× ahead of lefthook on a small commit | When `pre-commit` stops feeling instant. 1.3s says not yet |
| **Faster type check** | TypeScript 7 — `tsc` *is* the Go port, ~8–12× on full builds | No compiler API until 7.1 | When `tsc --noEmit` is the slow part of `pnpm check` |
| **Newer runner** | Vitest 5.1 | Breaking: `clearMocks` defaults to `true`, unawaited `resolves`/`rejects` now fail, strict locators. Its own benchmark shows the common case gaining least | Nothing. We are on 3.2.7 and it answers in 1.6s |
| **Coverage** | `@vitest/coverage-v8` | — | A number we would act on. We do not have one yet |

Also considered and rejected: **Vite+** (takes too many decisions for us, and its `vp hooks` fights
lefthook for `core.hooksPath`), **eslint-plugin-boundaries** (requires ESLint), **steiger** (beta,
and its rules are Feature-Sliced Design whatever the billing says).

There is no Rust-based mutation tester for JS/TS, and no Vitest-native one.

_Versions and claims checked 12 November 2026._
