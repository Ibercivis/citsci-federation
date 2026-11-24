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

# The value a flag was given, for the three quotings a shell accepts — "x",
# 'x', and a bare word. $1 is an ERE alternation of the flag's spellings, in
# one group, which is what makes the value group 3; $2 is the text to read.
# Empty when the flag is absent.
#
# This reads a command the shell has not expanded yet. That is the whole
# reason it is sed and not a parser: a value built from a variable has no
# value here, and the callers below are written knowing it.
flag_value() {
  for shape in '"([^"]*)"' "'([^']*)'" '([^[:space:]]+)'; do
    value=$(printf '%s' "$2" | sed -E -n "s/(^|.*[[:space:]])$1[ =]+$shape.*/\\3/p" | head -1)
    if [ -n "$value" ]; then
      printf '%s' "$value"
      return 0
    fi
  done
  return 1
}

# The issue a branch name claims. `docs/agents/issue-tracker.md` holds the
# form; the number ends at the first `-`, so `issue-52` and
# `issue-52-rename-the-thing` both answer 52 and `issue-52abc` answers nothing.
# Empty for every other name.
issue_in_branch() {
  case "$1" in
    issue-*)
      candidate=${1#issue-}
      candidate=${candidate%%-*}
      case "$candidate" in
        '' | *[!0-9]*) ;;
        *) printf '%s' "$candidate" ;;
      esac
      ;;
  esac
}

# Which issue this PR serves, in the order of what actually knows, and the
# refusal says which of them answered: every defect this hook has had was a
# refusal that blamed the wrong one (issue #72).
#
# `--head` first: it names the branch the pull request is for, whatever
# directory the command was issued from. A branch read from a directory can
# only ever be a guess at that, and this repository works in worktrees as a
# matter of course — a pull request opened from one was refused over another
# ticket's issue, which no honest body could have satisfied.
#
# Then the `[#52]` the title carries, read out of the title's own value and
# never out of the whole command: PR #70's body held one as an example inside
# a diagram, and the hook refused a pull request that correctly said
# `No ticket`.
#
# The directory's own branch last, and only when `--head` is absent. Given, it
# has already said the pull request is for some other branch.
issue=""
why=""

# `gh` takes `owner:branch` when the head is on a fork.
head=$(flag_value '(--head|-H)' "$command")
head=${head#*:}

issue=$(issue_in_branch "$head")
[ -n "$issue" ] && why="--head names \`$head\`"

if [ -z "$issue" ]; then
  title=$(flag_value '(--title|-t)' "$command")
  issue=$(printf '%s' "$title" | sed -E -n 's/.*\[#([0-9]+)\].*/\1/p' | head -1)
  [ -n "$issue" ] && why="the title carries \`[#$issue]\`"
fi

if [ -z "$issue" ] && [ -z "$head" ]; then
  # Where the command was issued, which is the directory whose branch is the
  # one meant. Claude Code puts it in the payload; without it we are left
  # asking about this hook's own directory, which is the same answer only when
  # nobody is working in a worktree.
  cwd=$(printf '%s' "$input" | jq -r '.cwd // ""')
  [ -n "$cwd" ] && [ -d "$cwd" ] || cwd=$PWD

  branch=$(git -C "$cwd" branch --show-current 2>/dev/null || true)
  issue=$(issue_in_branch "$branch")
  [ -n "$issue" ] && why="\`$cwd\` is on \`$branch\`"
fi

# No issue named anywhere: the PR serves none, and that is allowed.
[ -z "$issue" ] && exit 0

# The body is usually a heredoc inside the command, so the command text holds
# it. `--body-file` is the one spelling that keeps it elsewhere.
#
# A path this hook cannot open is its own refusal, further down. There are two
# ways to get one and neither is the author's mistake: a path built from a
# variable, which has no value until the shell expands it, and a relative path,
# which is relative to wherever the command runs rather than to here. Saying
# the body is silent would be a lie in both — the body was never read.
text=$command
unreadable=""
body_file=$(flag_value '(--body-file|-F)' "$command")
if [ -n "$body_file" ]; then
  if [ -f "$body_file" ]; then
    text="$text
$(cat "$body_file")"
  else
    unreadable=$body_file
  fi
fi

# How the issue may be spelled after the keyword. The bare `#52` is this
# repository's own. `Ibercivis/citsci-federation#52` is GitHub's
# cross-repository form, and it is the only spelling available in an
# application repository, where a bare `#52` points at that repository's own
# issue #52 — which is why `docs/agents/external-repos.md` requires it there.
#
# The prefix is optional rather than alternative, and it is ours alone:
# `other/repo#52` has said nothing about our issue #52 and goes on being
# refused.
reference="(Ibercivis/citsci-federation)?#$issue([^0-9]|$)"

# GitHub's own keywords, and then ours for the deliberate opt-out.
if printf '%s' "$text" |
  grep -Eqi "(clos(e|es|ed)|fix(es|ed)?|resolv(e|es|ed))[[:space:]]+$reference"; then
  exit 0
fi

if printf '%s' "$text" |
  grep -Eqi "(part of|refs|references)[[:space:]]+$reference"; then
  exit 0
fi

if [ -n "$unreadable" ]; then
  cat >&2 <<EOF

  Refusing this pull request: it serves issue #$issue, and the body it names
  could not be read:

    $unreadable

  How we know: $why.

  That is not a claim that the body says nothing — the body was never opened.
  The hook sees the command before the shell expands it, so a path built from
  a variable has no value yet, and a relative path is read against this hook's
  directory rather than yours.

  Give the path literally and absolutely, or pass the body with \`--body\`.

EOF
  exit 2
fi

cat >&2 <<EOF

  Refusing this pull request: it serves issue #$issue and says nothing about
  what happens to it.

  How we know: $why.

  That reference is traceability and nothing more — it shows the origin in
  \`git log --oneline\`. GitHub closes an issue on merge only for a keyword in
  the PR body. Add one line to the body:

    Closes #$issue          the PR finishes the issue
    Part of #$issue         it advances the issue, which stays open

  The second is a real answer, not an escape hatch. Pick the true one.

EOF
exit 2
