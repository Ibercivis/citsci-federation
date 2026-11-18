#!/bin/sh
# Research notes are opened on purpose, never in passing.
#
# `AGENTS.md` keeps a verdict per note and says to take it from there, opening a
# note "only when one of its branches is yours"; the `deferred/` rule says not
# to read those at all unless the task at hand is that topic. Both are prose,
# and prose did not hold: one session read all four notes with those two lines
# in its context, and the biggest of them is 4,846 words.
#
# Claude Code runs this as a PreToolUse hook. It answers "ask", which forces a
# permission prompt, so a person decides per file. In a headless run nobody can
# answer and the call is refused — which is the behaviour we want there, and the
# reason this does not use `deny`: when somebody is present, the answer is
# theirs to give.
#
# Two ways past it, both of them fine. A path named with `@` is inserted into
# the prompt with no tool call, so no hook sees it; that is the human doing the
# confirming this hook exists to ask for. And a `grep -r` over `docs/` that
# never names the directory returns lines without tripping this: lines leak,
# files do not. Gating `docs/` whole would prompt on every session.
#
# Wired on Bash|Read|Grep|Glob in `.claude/settings.json`.

set -u

input=$(cat)

# The fast path out, before jq is ever spawned: this hook runs on every Bash
# call, and almost none of them mention a note.
case "$input" in
  *docs/notes*) ;;
  *) exit 0 ;;
esac

# One haystack for every tool: a Bash command line, and the path and pattern
# fields of the file tools. No `tool_name` is read, so a tool whose arguments
# are shaped differently still lands in here rather than slipping through.
haystack=$(printf '%s' "$input" | jq -r '
  [.tool_input.command, .tool_input.file_path, .tool_input.path, .tool_input.pattern]
  | map(select(. != null)) | join(" ")
' 2>/dev/null) || exit 0

# The substring above is only a filter: it matches this hook's own source, and
# the commit that wrote it. What counts is the path arriving as an argument.
case "$haystack" in
  *docs/notes*) ;;
  *) exit 0 ;;
esac

jq -n '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "ask",
    permissionDecisionReason: (
      "This is a research note: dated evidence for one topic, long on purpose. "
      + "AGENTS.md carries its verdict in the Research notes index, which is the "
      + "cheaper read. Approve this only if that note’s topic is the task at hand."
    )
  }
}'
