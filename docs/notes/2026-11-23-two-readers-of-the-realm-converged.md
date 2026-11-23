<!-- Research note, not a decision. Read 23 November 2026, across `PR #176` and `PR #178`. -->

# Two readers of the realm came out the same shape, nine minutes after the first reached `main`

**Verdict.** `declaredCredentials` in `PR #176` and `DeclaredSource.asksFor` in `PR #178` were
written by two authors neither aware of the other's work, the second nine minutes after the first
reached `main`, and both came out as: find the Identity Source by alias, take one fact out of its
`config`, throw a worded error when the realm declares none. The header of `tests/realm.ts` asks
for exactly that. What the convergence adds is that nobody had to be told — it is where the test
layer arrives unprompted whenever a case leans on something the realm owns. Hold the next one to
it: read such a fact through a thrower in `tests/realm.ts`, rather than writing the value into the
case.

**Read on only if** you are writing a case that leans on a realm-declared fact, or you mean to
fold that shape into a single helper.

`PR #178` also carries `sourceAskingForNames` in `tests/mock-source.ts`, which refuses the named
case once the realm stops asking that source for `profile` — the same move one layer out.

The independence is visible because the two collided textually: each added `config?:` to the same
field of `ImportedRealm.identityProviders`, with different types, `PR #178` then taking the wider
spelling `main` had.

## Both readers are on `main`, and the fold is no longer blocked

`PR #178` merged into `issue-24`, a branch cut before `PR #176` landed, so for most of a day one
reader was on `main` and the other was not. `PR #174` ended that: `issue-24` landed as `4dd5797` on
23 November, and `tests/realm.ts` holds `declaredSource` and `declaredCredentials` together. Nothing
is waiting on a branch any more.

They are not the same function yet. `declaredSource` throws once for an alias the realm does not
declare, and again for a provider declaring no scope; `declaredCredentials` reaches through
`?.config` and reports both of those as one error about missing credentials. A helper over the two
has to choose which error a caller gets, and that choice is the fold's only real question.
