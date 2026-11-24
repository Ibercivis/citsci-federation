# The Claude Code hooks

The harness is what runs these, on the events `.claude/settings.json` wires each one to. Nothing in
`package.json` or `lefthook.yml` calls them; the only other thing that does is a `check-*` script
driving one through its cases.

## The contract

A hook reads **a JSON payload on stdin** — the tool call, its input, the session's directory —
and answers on two channels.

**The exit status**, which is the only one that can refuse:

| exit | what the harness does |
| --- | --- |
| `0` | lets the call through |
| `2` | **refuses it**, and hands stderr back to the agent as the reason |
| anything else | **lets the call through**, and shows stderr to the person only |

The third row is why this directory exists. A gate in `scripts/` reads argv and exits 1 to fail;
write a hook that way and it does not fail — it does not block. The tool call proceeds and the
agent never learns why. Nothing in the payload or the exit status makes that mistake visible, so
the directory has to.

Only a `PreToolUse` hook has a call left to refuse. On the other events `2` means something else or
nothing at all, and the hooks wired to them return 0 whatever happens: a sync or a claim that goes
wrong says so and carries on, because a hook that interrupts a session over its own bad day is a
hook somebody switches off.

**JSON on stdout**, which is how a hook says anything richer than yes or no — and the channel the
exit status cannot reach. `hookSpecificOutput.permissionDecision` answers `"ask"`, which forces a
permission prompt instead of deciding for the person; `systemMessage` tells them something without
touching the call at all. Exit 0 alongside it: the status is not the answer here, the payload is.
`ask-before-reading-a-note.sh` needs the first, `claim-issue.sh` the second, and neither could be
written with exit statuses alone.

## Writing a new one

- Take the whole payload from stdin, and get out before spawning `jq` when the call is obviously
  not yours. A hook on Bash runs on every command.
- Add it to `.claude/settings.json` and open a fresh session: the harness reads that file once, at
  the start. A hook whose path is not there does not announce itself — the call just goes through.
- Its cases, if it earns some, drive this seam from outside: a payload in, a status or a JSON answer
  out, nothing reaching inside the script. `check-require-issue-link.sh` is the one that does.
  `CODING_STANDARDS.md` says why those cases live in `scripts/` rather than here.
