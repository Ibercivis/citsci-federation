<!-- Research note, not a decision. Read 23 November 2026, across `PR #176` and `PR #178`. -->

# Two readers of the realm came out the same shape, invented an hour apart

**Verdict.** `declaredCredentials` in `PR #176` and `DeclaredSource.asksFor` in `PR #178` were
written an hour apart by two authors, neither aware of the other's work, and both came out as: find
the Identity Source by alias, take one fact out of its `config`, throw a worded error when the realm
declares none. The header of `tests/realm.ts` asks for exactly that. What the convergence adds is
that nobody had to be told — it is where the test layer arrives unprompted whenever a case leans on
something the realm owns. Hold the next one to it: read such a fact through a thrower in
`tests/realm.ts`, rather than writing the value into the case.

**Read on only if** you are writing a case that leans on a realm-declared fact, or you mean to
fold that shape into a single helper.

`PR #178` also carries `sourceAskingForNames` in `tests/mock-source.ts`, which refuses the named
case once the realm stops asking that source for `profile` — the same move one layer out.

The independence is visible because the two collided textually: each added `config?:` to the same
field of `ImportedRealm.identityProviders`, with different types, `PR #178` then taking the wider
spelling `main` had.

## There is nothing to fold until `issue #24` reaches `main`

`PR #178` merged into `issue-24`, a branch cut before `PR #176` landed, so one of these readers is
on `main` and the other is not. A single function factors into nothing, and extracting one from it
now would be a helper with one caller. Once `issue #24` merges, `tests/realm.ts` holds both and the
refactor is small and real. Not before.
