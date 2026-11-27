#!/bin/sh
# Research notes are opened on purpose, never in passing.
#
# `docs/agents/research-notes.md` keeps a verdict per note and says to take it
# from there, opening a note "only when one of its branches is yours"; the
# `deferred/` rule in `AGENTS.md` says not to read those at all unless the task
# at hand is that topic. Both are prose, and prose did not hold: one session
# read all four notes with those two lines in its context, and the biggest of
# them is 4,846 words.
#
# What it guards is context, not safety. A note that nobody needed costs the
# session its attention, which is why a reader that slips past this hook is a
# tolerable failure and a prompt nobody needed is not.
#
# Claude Code runs this as a PreToolUse hook. It answers "ask", which forces a
# permission prompt, so a person decides per file. In a headless run nobody can
# answer and the call is refused — which is the behaviour we want there, and the
# reason this does not use `deny`: when somebody is present, the answer is
# theirs to give.
#
# It asks for a reader aimed at a note: `cat`, `less`, `more`, `bat`, `nl`,
# `head`, `tail`, `sed`, a `git show <rev>:<note>`, or the `Read` tool. Four
# things that merely carry the path go through, because none of them puts a
# note in the context:
#
#   - The body of a heredoc. A script that mentions the path is data, not an
#     argument, and this was the largest class of all: a measurement over one
#     month of sessions found 246 of 599 prompts avoidable, most of them a
#     `python3 -` or a `cat >` whose body held the string.
#   - Writing a note: `cat > docs/notes/x.md`. Creating one is not reading it.
#   - Metadata: `ls`, `git add`, `git status`, `mkdir`, `echo`, `jq`, `gh`.
#   - A pattern match, in Bash or through the Grep tool. This is the rule the
#     hook already lived by: lines leak, files do not.
#
# Two ways past it, both of them fine. A path named with `@` is inserted into
# the prompt with no tool call, so no hook sees it; that is the human doing the
# confirming this hook exists to ask for. And a `grep -r` over `docs/` that
# never names the directory returns lines without tripping this.
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

ask() {
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: (
        "This is a research note: dated evidence for one topic, long on purpose. "
        + "docs/agents/research-notes.md carries its verdict, which is the cheaper "
        + "read. Approve this only if the topic of that note is the task at hand."
      )
    }
  }'
  exit 0
}

fields=$(printf '%s' "$input" | jq -r '
  [(.tool_input.file_path // ""), (.tool_input.command // "")] | @tsv
' 2>/dev/null) || exit 0

file_path=$(printf '%s' "$fields" | cut -f1)
command=$(printf '%s' "$fields" | cut -f2-)

# The `Read` tool names one file and returns the whole of it. `path` is not
# read: it belongs to Grep and Glob, which return lines and names.
case "$file_path" in
  *docs/notes/*) ask ;;
esac

[ -n "$command" ] || exit 0

# A heredoc body is data the command carries, not a path it opens. The line
# that opens the heredoc stays, because the path can be an argument on it.
stripped=$(printf '%s\n' "$command" | awk '
  {
    if (inside) { if ($0 == delim) inside = 0; next }
    if (match($0, /<<-?[ \t]*['"'"'"]?[A-Za-z_][A-Za-z0-9_]*['"'"'"]?/)) {
      d = substr($0, RSTART, RLENGTH)
      sub(/^<<-?[ \t]*/, "", d)
      gsub(/['"'"'"]/, "", d)
      delim = d; inside = 1
    }
    print
  }
')

# A reader, at the start of the command or of one of its segments, after any
# environment assignments, with a note as its argument. `[^;&|>]*` is what
# keeps a write out: in `cat > docs/notes/x.md` a redirection stands between
# the verb and the path.
readers='cat|less|more|bat|nl|head|tail|sed'
if printf '%s' "$stripped" | grep -Eq \
  "(^|[;&|(])[[:space:]]*([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*($readers)[[:space:]][^;&|>]*docs/notes/[^[:space:]]*\.md"; then
  ask
fi

# `git show <rev>:<path>` prints the whole file.
if printf '%s' "$stripped" | grep -Eq 'git[[:space:]]+show[^;&|]*:docs/notes/'; then
  ask
fi

exit 0
