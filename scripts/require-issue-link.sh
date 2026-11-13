#!/bin/sh
# Refuses a `gh pr create` that serves an issue without saying what becomes of
# that issue. Claude Code runs this as a PreToolUse hook on Bash: exit 2 blocks
# the command and hands the message below back to whoever ran it.
#
# The convention in CLAUDE.md puts the issue in the commit subject, as
# `[#52] ...`, so its origin shows in `git log --oneline`. That is traceability
# and nothing more. GitHub closes an issue on merge only for a closing keyword
# — Closes / Fixes / Resolves #n — in the PR body, and #55 merged without one
# and left #52 open. This is the mistake it refuses, at the only moment the
# body can still be changed cheaply.
#
# It forces nothing but the decision. A PR that serves no issue passes
# untouched; a PR that advances an issue without finishing it says `Part of #n`
# or `Refs #n` and passes too. What it will not let through is silence.
#
# It cannot stop `gh pr create` run outside this harness, and it has nothing to
# say about a PR opened in the browser. Those are for the human to get right.

set -u

input=$(cat)

# The fast path out, before jq is ever spawned: this hook runs on every Bash
# call, and all but a handful have nothing to do with a pull request.
case "$input" in
  *"gh pr create"*) ;;
  *) exit 0 ;;
esac

command=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')

# The substring above is only a filter. A command that merely mentions the
# phrase is not opening a pull request — this hook's own documentation does,
# and the first thing it did was refuse the commit that wrote it. What counts
# is an invocation: the words at the start of the command or of one of its
# segments, after any environment assignments.
printf '%s' "$command" |
  grep -Eq '(^|[;&|(])[[:space:]]*([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*gh[[:space:]]+pr[[:space:]]+create([[:space:]]|$)' ||
  exit 0

# Which issue this PR serves: the branch says so first, because the convention
# cuts `issue-52` for #52; failing that, the `[#52]` the title carries.
issue=""
branch=$(git branch --show-current 2>/dev/null || true)
case "$branch" in
  issue-*)
    candidate=${branch#issue-}
    case "$candidate" in
      '' | *[!0-9]*) ;;
      *) issue=$candidate ;;
    esac
    ;;
esac

if [ -z "$issue" ]; then
  issue=$(printf '%s' "$command" | sed -n 's/.*\[#\([0-9][0-9]*\)\].*/\1/p' | head -1)
fi

# No issue named anywhere: the PR serves none, and that is allowed.
[ -z "$issue" ] && exit 0

# The body is usually a heredoc inside the command, so the command text holds
# it. `--body-file` is the one spelling that keeps it elsewhere.
text=$command
body_file=$(printf '%s' "$command" | sed -n 's/.*--body-file[ =]*\([^ "'"'"']*\).*/\1/p' | head -1)
if [ -n "$body_file" ] && [ -f "$body_file" ]; then
  text="$text
$(cat "$body_file")"
fi

# GitHub's own keywords, and then ours for the deliberate opt-out.
if printf '%s' "$text" |
  grep -Eqi "(clos(e|es|ed)|fix(es|ed)?|resolv(e|es|ed))[[:space:]]+#$issue([^0-9]|$)"; then
  exit 0
fi

if printf '%s' "$text" |
  grep -Eqi "(part of|refs|references)[[:space:]]+#$issue([^0-9]|$)"; then
  exit 0
fi

cat >&2 <<EOF

  Refusing this pull request: it serves issue #$issue and says nothing about
  what happens to it.

  A \`[#$issue]\` in the title is traceability — it shows the origin in
  \`git log --oneline\` and nothing more. GitHub closes an issue on merge only
  for a keyword in the PR body. Add one line to the body:

    Closes #$issue          the PR finishes the issue
    Part of #$issue         it advances the issue, which stays open

  The second is a real answer, not an escape hatch. Pick the true one.

EOF
exit 2
