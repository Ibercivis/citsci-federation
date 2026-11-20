<!-- Research note, not a decision. Measured 20 November 2026 against five pull requests. -->

# Seven consecutive words is where repeated prose starts

**Verdict.** A run of **seven or more consecutive words appearing in two places** separates prose
written twice from prose that only shares a domain phrase. Every run of eight or more was a real
copy; everything at six or below was vocabulary. Two choices came out of the measurement rather
than the design: the unit is the **paragraph**, reassembled from contiguous lines, because copies
do not wrap or punctuate alike; and a source file is read in its **comments and docstrings** alone.
The second table below is what reading all of it cost.
`scripts/check-repeated-prose.sh` stays a reminder, never a gate — the margin is too thin to refuse
a merge on.

**Read on only if** you are moving the threshold, putting the check in CI, or wondering why the
comparison works on paragraphs.

## What a run length buys

`Ibercivis/citsci-api#16`, the pull request that wrote one narrative three times, against
`origin/federation`:

| Run | Pair | Real? |
|---|---|---|
| 12 | `LOCAL-DEV.md` ↔ `citsci-api/settings.py` | yes — the code-redemption narrative |
| 11 | `LOCAL-DEV.md` ↔ `users/api/urls.py` | yes — the registration decision |
| 8 | `LOCAL-DEV.md` ↔ a test docstring | yes — the third copy |
| 8 | `citsci-api/settings.py` ↔ a test docstring | yes — the third copy again |
| 8 | `LOCAL-DEV.md` ↔ `users/ibercivis_account.py` | yes — "an address already held by an account here" |
| 6 | four pairs | no — "signing in with an Ibercivis account", a title |
| 5 | five pairs | no — the same, shorter |

Nothing landed on 7, which is why the threshold sits there: a word of margin under the shortest real
copy, a word of clearance over the longest phrase that only named the domain.

The 8-word pairs are the reason a shorter threshold is not safer. The third copy shares only "the
web app sends the person to the" with the other two — it was reworded from there on — so a
threshold of nine would have found two copies of that narrative and missed the third.

## Why paragraphs, and not lines or sentences

The first attempt compared sentences and found **nothing** in that pull request. The three copies
break into sentences at different places: one ends a sentence where another has a semicolon, and
Jaccard over a long sentence is diluted by the half that was reworded. Rewrapping hides a copy the
same way — the same words broken at another column share no line with their original.

Joining contiguous prose lines back into a paragraph and then looking for the longest shared run
of words removes every boundary of ours from the comparison. The run length is also the only
output a reader can check at a glance: it quotes the words that are in both places.

## What the false positives were

Four of this repository's merged pull requests, same tool:

| | Hits at ≥7 | What they were |
|---|---|---|
| `PR #141`, `PR #135` | 0 | — |
| `PR #144` | 1 | **real**: why the two tools are steps and not jobs, written in `ci.yaml` and again in `docs/verification.md` |
| `PR #137` | 4 | one real (a 23-word comment written twice in one file); three judgement calls, two scripts explaining the same thing about forks and branches |

Before the comments-and-docstrings rule, `PR #137` produced **twenty-two** hits, all of them
repeated `gh pr create` fixtures and import blocks in a shell test script. That rule is what makes
the output readable; the threshold alone does not.

`PR #144` is the finding that argues for running this in this repository and not only in the
application ones.

## Why it is not a gate

`PR #137`'s three judgement calls would have refused a merge for two comments that explain the same
mechanism from two sides. The rule they serve — context goes once — needs somebody to agree the
second copy was avoidable, and a check that cannot tell those apart belongs in a checklist.
