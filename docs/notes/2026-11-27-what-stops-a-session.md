<!-- Research note, not a decision. Measured 27 November 2026 over one month of session transcripts. -->

# Two hooks and a symlink account for the stops, not the permission rules

A session transcript records a `permissionDecision` for every tool call. Three of its sources mean
a person was shown a prompt and answered — `user_temporary`, `user_reject` — and one does not:
`user_permanent` means an existing rule allowed the call, with nobody asked. Counting that last one
as a stop inflates the total by a fifth, which is the first mistake this measurement made.

Over 208 sessions, 599 stops. The allowlist explains almost none of them.

| Cause | Stops |
| --- | --- |
| The note hook | 313 |
| `AskUserQuestion` | 163 |
| The GitHub hook | 105, for 56 distinct actions |
| The shape of a Bash command | 18 |

A `PreToolUse` hook answering `ask` overrides every allow rule, so adding entries to
`permissions.allow` would have addressed the last row and nothing else.

## What the note hook was matching

313 stops, of which 84 open a note's body. The rest carry the path without opening anything: a
heredoc whose script mentions the string, a write, a `git add`, a directory listing, a pattern
match. The largest single class was a `python3 -` or a `cat >` whose body held `docs/notes` — and
a hook that watches the text of a command cannot tell an argument from a string in a script unless
it strips the heredoc first.

## What the symlink was costing

`/tmp` is a symlink to `private/tmp`. A working directory is judged as it is written and no link at
it is followed, so `/tmp` in the permission scope does not cover `/private/tmp`, where the
scratchpad lives. Beyond the prompt, `cd` persists between calls only when the command ends inside
a working directory: a `cd` to the scratchpad did not survive, the next command could not find the
file it had just written, and each retry paid another stop. The worst case in the month was seven
stops for one review comment, which is how a 1.4-retry average hides a tail.

## What would change the conclusion

The GitHub hook's 105 stops are policy, not waste, and were left alone. If `AskUserQuestion` keeps
the second row after the rule in `AGENTS.md`, the cause is the asking and not the counting, and the
rule is the thing that failed. Re-measure the same way: the transcripts hold 30 days.
