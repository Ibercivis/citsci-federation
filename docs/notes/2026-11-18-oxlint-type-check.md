<!-- Research note, not a decision. The source of truth about what we check and why is
`docs/verification.md`. Nothing here has been adopted. Measured 18 November 2026 on one developer
machine, macOS, against this repository's tree: 26 formatted files, 11 linted. Every number is the
best of seven runs of the binary, not of `pnpm`, so process startup is included but pnpm's is not.
No production host was involved. -->

# `oxlint --type-check` matches `tsc`, and the pass it would replace is not the slow one

**Verdict.** `oxlint --type-aware --type-check` reproduces `tsc --noEmit` **exactly** on this tree —
same codes, same line and column, same text — and it does so on the pins we already have, with the
`oxlint-tsgolint` backend. It needs neither TypeScript 7 nor `tsrs`. What it saves is about 75 ms of
a 1.3 s gate whose licence check is three quarters of the total, so the row in
`docs/verification.md` stays unadopted on value, not on risk. `tsrs` is a separate question and
`issue #83` holds it.

**Read on only if** you are deciding whether one pass replaces two (§1, §2), whether to put `tsrs`
in the gate (§2, §3), or why a trigger written as "when `tsc --noEmit` is the slow part" never fires
(§2).

**Already carried into `docs/verification.md`**, so settle it there: the row's candidate, its real
cost and its trigger. What follows is the evidence.

## 1. Diagnostic parity

A probe file was seeded with errors chosen to exercise this `tsconfig.json`'s strictness rather than
the easy cases: `TS2305` (the `JsonWebKey` move that the toolchain bump produced), `TS2322` twice —
one of them from `noUncheckedIndexedAccess` — `TS2375` from `exactOptionalPropertyTypes`, `TS18047`
from `strictNullChecks`, `TS4114` from `noImplicitOverride`, and `TS2801` for a promise used as a
condition. Outputs were compared as sets of `file:line:column` plus error code, which is what
survives the two tools' different formatting.

| Configuration | Against `tsc --noEmit` 7.0.2 |
|---|---|
| oxlint 1.93.0 + `oxlint-tsgolint` 7.0.2007 — **the pins we have** | identical, 4 of 4 |
| oxlint 1.94.0 + `oxlint-tsgolint` 7.0.2007, whole tree | identical, 7 of 7 |
| oxlint 1.94.0 + `tsrs` 0.25.0-ts7.1.0-beta, whole tree | identical, 7 of 7 |

Type-aware lint findings are also identical across the two backends: the same three, from
`typescript/no-floating-promises`, `typescript/await-thenable` and `unicorn/no-unnecessary-await`.
Rules outside `correctness` and `suspicious` were not exercised, because `.oxlintrc.json` does not
enable them.

## 2. Where the time actually goes

| | `oxlint-tsgolint` 7.0.2007 | `tsrs` 0.25.0-ts7.1.0-beta |
|---|---|---|
| `oxlint`, no flags, as `pnpm lint` runs it | 114 ms | 101 ms |
| `oxlint --type-aware --type-check` | 118 ms | 102 ms |

`tsc --noEmit` on TypeScript 7.0.2: **78 ms**. `tsrs --noEmit`, its own compiler entry point: 60 ms.

The rest of the gate, for scale: `oxfmt --check .` 103 ms, and `reuse lint` in its container
**966 ms**. So `pnpm check` spends about 1.3 s, of which the licence check is three quarters and the
whole of the type work is 190 ms. Folding `tsc --noEmit` into the lint pass saves ~75 ms, about 6%;
changing backend on top of that saves ~15 ms more.

This is why the trigger the row carried for months — "when `tsc --noEmit` is the slow part of
`pnpm check`" — had not fired and was not going to. On a tree this size every number above is
dominated by process startup, which is also why the 5× and 7× in oxc's announcement can be neither
confirmed nor refuted here.

## 3. Four differences worth knowing before anyone adopts either

1. **Path arguments scope the two backends differently.** Given explicit file arguments,
   `oxlint-tsgolint` confines compiler diagnostics to those files; `tsrs` reports the whole program.
   Passing one file, `tsrs` surfaced a `TS2801` belonging to another. `pnpm lint` passes no paths, so
   this is invisible today — but `lefthook.yml` runs `oxlint … {staged_files}` on `pre-commit`, so
   adding `--type-check` there would make a one-file commit report the whole tree under `tsrs` and
   not under `tsgolint`.
2. **`tsrs` takes over silently.** With both packages installed, oxlint 1.94.0 used `tsrs` — the
   program-wide scoping above is how it was detected, not a document. There is no side-by-side
   comparison to run inside one install.
3. **Nested elaboration is lost.** `tsc` prints the sub-diagnostics under an error — "Types of
   property 'trustEmail' are incompatible" and what follows. oxlint prints the head message only.
   Same error, less to read.
4. **`tsrs` tracks a different compiler than we pin.** Its version string says `ts7.1.0-beta`; we
   pin TypeScript 7.0.2. They agreed on every diagnostic above, which is a measurement of this tree
   and not a guarantee.
