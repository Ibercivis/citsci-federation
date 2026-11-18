<!-- Research note, not a decision. Measured 18 November 2026 on one developer machine. -->

# `oxlint --type-check` matches `tsc`, and replacing it buys too little

**Verdict.** `oxlint --type-aware --type-check` reports exactly what `tsc --noEmit` reports — same
codes, same positions, same text — on the pins we already have. It needs neither TypeScript 7 nor
`tsrs`, so the blocker the `docs/verification.md` row carried was never real. Unadopted anyway: all
the type work is 190 ms of a 1.3 s gate, and folding the two passes into one spends `tsc` as the
reference implementation that would reveal a divergence.

**Read on only if** you are folding those two passes into one, or putting `tsrs` in the gate —
`issue #83` holds that.

Two things appear only when both backends run. `tsrs` reports the whole program where
`oxlint-tsgolint` reports the files it was given, which is what `lefthook` passes it on
`pre-commit`. And `tsrs` replaces `oxlint-tsgolint` silently once installed, so there is no
side-by-side comparison to run.
