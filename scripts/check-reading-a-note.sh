#!/usr/bin/env bash
#
# The cases `hooks/ask-before-reading-a-note.sh` has to get right. `pnpm check`
# runs this.
#
# The seam is the hook's own process: a tool payload goes in on stdin, and
# either an "ask" decision comes out on stdout or nothing does. No file is
# opened and no note is read, so a case costs nothing and says only what the
# hook would have decided.
#
# Why the cases are worth more here than in the other two hooks: this one
# guards context rather than correctness, and it reads the text of a command to
# do it. Text is where it went wrong. The hook matched the substring
# `docs/notes` anywhere in a command, and over one month of sessions 229 of its
# 313 prompts opened no note at all —
# `docs/notes/2026-11-27-what-stops-a-session.md` has the count. Every section
# below is one of the classes that measurement turned up, so a later widening
# or narrowing has to say which of them it is changing.

set -euo pipefail

hook=$(cd "$(dirname "$0")" && pwd)/hooks/ask-before-reading-a-note.sh

failures=()
total=0

note() { failures+=("$1"); }

# A Bash payload. The arguments are the lines of the command, so a heredoc can
# be written as the shell would see it.
command_payload() { printf '%s\n' "$@" | jq -Rs '{tool_input: {command: .}}'; }

# One payload per field the hook reads, each for the reason its own comment
# gives there.
file_payload() { printf '%s' "$1" | jq -Rs '{tool_input: {file_path: .}}'; }
search_payload() { printf '%s' "$1" | jq -Rs '{tool_input: {path: ., pattern: "x"}}'; }

decision() {
  local out
  out=$(printf '%s' "$1" | "$hook" 2>/dev/null) || true
  if [[ $out == *'"ask"'* ]]; then printf 'ask'; else printf 'pass'; fi
}

# $1 what the case is called, $2 the payload
asks() {
  total=$((total + 1))
  [ "$(decision "$2")" = "ask" ] ||
    note "$1: the hook let a note's body through without asking."
}

passes() {
  total=$((total + 1))
  [ "$(decision "$2")" = "pass" ] ||
    note "$1: the hook asked about a call that opens no note."
}

# --- The reads it exists for -------------------------------------------------
#
# A reader with a note as its argument, wherever the segment it opens sits.
# These are the 84 prompts a month that the hook is for, and the only ones it
# should still cost.

asks "the Read tool on a note" "$(file_payload 'docs/notes/2026-11-26-x.md')"
asks "cat" "$(command_payload 'cat docs/notes/2026-11-26-x.md')"
asks "head" "$(command_payload 'head -40 docs/notes/2026-11-26-x.md')"
asks "sed over a range" "$(command_payload "sed -n '1,80p' docs/notes/2026-11-26-x.md")"
asks "a reader in a later segment" "$(command_payload 'cd /r && cat docs/notes/x.md | head -5')"
asks "a reader after an assignment" "$(command_payload 'S=/tmp tail -20 docs/notes/x.md')"

# `git show <rev>:<path>` prints a whole file, and it is the one spelling that
# reaches a note on a branch nobody has checked out.
asks "git show at a revision" "$(command_payload 'git show origin/issue-91:docs/notes/x.md')"
asks "git show piped into grep" \
  "$(command_payload 'git show origin/issue-91:docs/notes/x.md | grep -n "foo"')"

# --- A heredoc body is data, not an argument ---------------------------------
#
# The largest class by far: a script that mentions the path. The hook reads the
# text of a command, so until the body is stripped it cannot tell the two
# apart. These two are verbatim shapes from the measurement.

passes "a script whose body names a note" "$(command_payload \
  'python3 - <<PY' \
  's = "docs/notes/x.md"' \
  'print(s)' \
  'PY')"
passes "a script written out with the string inside" "$(command_payload \
  "cat > p.py <<'PY'" \
  'if "docs/notes" in arg: pass' \
  'PY')"

# --- Writing a note is not reading it ----------------------------------------

passes "writing a note" "$(command_payload \
  "cat > docs/notes/2026-11-27-x.md <<'EOF'" \
  'text' \
  'EOF')"

# --- Metadata --------------------------------------------------------------
#
# Names, sizes and git's own bookkeeping. Together they were a quarter of the
# waste, and not one of them opens a file.

passes "listing the directory" "$(command_payload 'ls docs/notes/')"
passes "listing one note" "$(command_payload 'ls -la docs/notes/x.md')"
passes "staging a note" "$(command_payload 'git add docs/notes/x.md')"
passes "git status on the directory" "$(command_payload 'git status docs/notes/')"
passes "a diff" "$(command_payload 'git diff docs/notes/x.md')"
passes "counting lines" "$(command_payload 'wc -l docs/notes/x.md')"
passes "making the directory" "$(command_payload 'mkdir -p docs/notes/deferred')"
passes "a label" "$(command_payload 'echo "=== docs/notes ==="')"
passes "a path as a value" "$(command_payload 'jq -n "{path:\"docs/notes/x.md\"}" > c3.json')"

# --- Lines leak, files do not ------------------------------------------------
#
# Extended from `grep -r`, where this was always allowed, to the spellings
# that name the directory. A pattern returns what matched it, which is the
# cheap read the index is meant to send a session to.

passes "grep with a pattern" "$(command_payload 'grep -n "What no parser fixes" docs/notes/x.md')"
passes "grep over the directory" "$(command_payload 'grep -rn "foo" docs/notes/')"
passes "the Grep tool" "$(search_payload 'docs/notes')"

# --- Nothing to do with a note -----------------------------------------------
#
# The fast path, which is what keeps this hook off the other several thousand
# Bash calls a month.

passes "a command that names no note" "$(command_payload 'git status --short')"

# --- The report --------------------------------------------------------------

if ((${#failures[@]} > 0)); then
  printf '\n  %d of %d cases in ask-before-reading-a-note.sh fail:\n\n' \
    "${#failures[@]}" "$total" >&2
  printf '  - %s\n\n' "${failures[@]}" >&2
  exit 1
fi

printf 'ask-before-reading-a-note.sh: %d cases.\n' "$total"
