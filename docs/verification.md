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
| Is every file's licence declared? | `reuse lint`, from a container | `pnpm reuse:lint` | `REUSE.toml`, ADR-0013 |
| Does a sign-in actually work? | Vitest against a real Broker | `pnpm broker:up && pnpm test` | `compose.yaml`, ADR-0010 |

`pnpm check` is the first four, and is the only definition of "checked". The licence check is the
one that needs Docker running, which makes `pnpm check` need it too; ADR-0013 says why it is worth
that. Every case in the suite reuses one running Broker instead of starting its own, which is why
they cannot run in parallel.

Lint runs `correctness` and `suspicious` only; `.oxlintrc.json` carries the count that decided it.
Type-aware rules are on, which needs the `oxlint-tsgolint` package and works on TypeScript 5.9 —
TypeScript 7 is not a prerequisite.

## Layer 1 — where it runs

| | Runs | Escape |
|---|---|---|
| the editor | oxlint as you type, if you took the extension `.vscode/extensions.json` recommends | not a gate, and not trying to be |
| `pre-commit` | format + lint, staged files only, **checks and never fixes** | `--no-verify` |
| `pre-push` | `pnpm check`; the suite too, when a Broker is up | `--no-verify` |
| CI | `pnpm check`, then its own Broker and the suite | none for the developer |
| the merge button | the ruleset on `main`: a pull request, `check`, `tests` and `pr` green, squash only | none; the ruleset has no bypass actor |

CI cannot be skipped the way a hook can, and since 13 November 2026 **a red CI stops the merge**: a
ruleset on `main` requires a pull request, requires those three contexts to be green, and offers no
merge method but squash. Nobody can bypass it, the author included — the way out is to edit the
ruleset, which is a change anyone can see, rather than a flag nobody sees. ADR-0014 holds the
reasoning, and says why the ruleset asks for no approving review.

`pr` is the third context and the newest. It checks the pull request's **title and body**, because
under squash those two strings *are* the commit that lands: the subject and the message. It asks
for a title short enough for a subject line and a body that says something, and for an issue
reference in one of them or the words `No ticket`. The rules live in
`scripts/check-pr-metadata.sh`, each next to the reason it exists.

Which row a new check joins is not a free choice, and the rule is not here: `CODING_STANDARDS.md`
holds it, along with the reason the suite and `pr` are the two that stay out of `pnpm check`.

## Layer 2 — what we do not have, and what would buy it

Each row carries the one condition that would make us adopt it, and what adopting it would cost.
A row marked *Fired* is decided and not yet built, and carries an issue.

| Gap | Candidate | Real cost | Trigger |
|---|---|---|---|
| **Module boundaries** — features must not import each other ([#43](https://github.com/Ibercivis/citsci-federation/issues/43)) | dependency-cruiser 18.7.2, the only maintained ESLint-free option | A second, non-Rust pass. `pre-push` and CI only | A `src/` with more than one feature in it |
| ↳ or, for free ([#45](https://github.com/Ibercivis/citsci-federation/issues/45) watches it) | oxlint `import/no-restricted-paths` | Five lines of `.oxlintrc.json` | [oxc#13789](https://github.com/oxc-project/oxc/issues/13789). Watch that one issue; it is the whole dependency |
| **Our own CI and scripts** — nothing checks either ([#47](https://github.com/Ibercivis/citsci-federation/issues/47)) | `actionlint` for the workflow, `shellcheck` for `scripts/*.sh`, both in CI only | Two steps. Neither has a first-party npm build, which is why they stay out of `pnpm check` | Fired. The ticket carries the route and why the other two were refused |
| **Dead code** — unused files and exports | knip 6.45 | A third pass, but it is the thing that actually rots in a feature-sliced tree | When nobody would notice an orphan |
| **Mutation testing** | StrykerJS 10.1.1 + `@stryker-mutator/vitest-runner` | The runner forces `threads: true` and one worker, and ignores `coverageAnalysis`. Cost is controlled by `incremental: true`, **not** by `--since`, which does not exist in StrykerJS | One module of pure logic worth really trusting. Never on `pre-commit`, never on every PR |
| **Faster hooks** | hk 2.12.0 — per-file read/write locks, so fixers can run concurrently; ships `ox-lint` and `oxfmt` builtins | Config is Pkl, and it is not on npm. Only published benchmark is the vendor's: ~1.2× ahead of lefthook on a small commit | When `pre-commit` stops feeling instant |
| **Faster type check** | TypeScript 7 — `tsc` *is* the Go port, ~8–12× on full builds | No compiler API until 7.1 | When `tsc --noEmit` is the slow part of `pnpm check` |
| ↳ and then three passes become two | `oxlint --type-check` — reports compiler errors from the same TypeScript program it lints with, and oxc documents it as replacing a separate `tsc --noEmit` in CI | Requires TypeScript 7, so it is the row above or nothing. Keep `tsc --noEmit` until both have run on this tree and the output has been compared | The row above. Neither alone |
| **Coverage** | `@vitest/coverage-v8` | — | A number we would act on. We do not have one yet |
| **Who bumps the pins** ([#49](https://github.com/Ibercivis/citsci-federation/issues/49)) | Dependabot, grouped and scheduled | Exact pins mean every bump is a pull request, so grouping is the whole design. The Keycloak image stays out of it: ADR-0004 rests on that version | Fired, for lack of a trigger. "A version nobody remembers choosing" is not something anyone notices, and that is the argument for a mechanism over a rule |

Also considered and rejected: **Vite+** (takes too many decisions for us, and its `vp hooks` fights
lefthook for `core.hooksPath`), **eslint-plugin-boundaries** (requires ESLint), **steiger** (beta,
and its rules are Feature-Sliced Design whatever the billing says).

There is no Rust-based mutation tester for JS/TS, and no Vitest-native one.

_Versions and claims checked 13 November 2026._
