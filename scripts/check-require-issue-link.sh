#!/usr/bin/env bash
#
# The cases `hooks/require-issue-link.sh` has to get right. `pnpm check` runs
# this.
#
# The seam is the hook's own process: a Claude Code hook payload on stdin, an
# exit status out — 0 lets the command run, 2 refuses it and publishes the
# message below it on stderr. Nothing here reaches inside the script.
#
# Three kinds of case, and nothing else earns a place: a refusal the hook once
# got wrong, the refusal it exists for, and a spelling that reading less of
# the command could have gone blind to. Why each wrong one was wrong lives in
# the hook, next to the code that answers for it.
#
# Do not write this file from a shell heredoc. Its fixtures contain the words
# `gh pr create`, the hook under test matches them at the start of any line,
# and it will refuse the command that writes them. Use an editor.

set -euo pipefail

# `pnpm check` runs from `pre-push`, and git hands a hook its own repository in
# the environment. Inherited, those variables answer every `git` call below
# with this checkout's branch whatever directory it was asked about, and five
# cases fail for a reason that has nothing to do with the hook.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX GIT_COMMON_DIR \
  GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES

hook=$(cd "$(dirname "$0")" && pwd)/hooks/require-issue-link.sh

# `pwd -P` because a case's directory has to be the path git will report, and
# on macOS `mktemp -d` hands back one that reaches it through a symlink.
work=$(cd "$(mktemp -d)" && pwd -P)
trap 'rm -rf "$work"' EXIT

# Nothing below should ever discover a repository above its own.
export GIT_CEILING_DIRECTORIES="$work"

# The hook asks git for a branch, so every case runs inside a checkout whose
# branch it chose. `no-issue` is the one that claims no ticket — a case about
# the title says only what it means to say from there. Made up front, so a git
# that cannot do this fails here rather than inside a case.
#
# `git branch --show-current` answers before the first commit, which makes an
# empty repository enough.
for branch in issue-52 issue-116 no-issue; do
  mkdir -p "$work/checkout-$branch"
  git -C "$work/checkout-$branch" init -q -b "$branch"
done

checkout_on() { printf '%s' "$work/checkout-$1"; }
unticketed=$(checkout_on no-issue)

failures=()
total=0

# A case about the directory the command came from sets this, and `run`
# clears it, so it cannot leak into the next case.
payload_cwd=""

# The payload Claude Code hands a PreToolUse hook, with the command in it.
run() {
  printf '%s' "$2" |
    jq -Rs --arg cwd "$payload_cwd" \
      'if $cwd == "" then {tool_input: {command: .}}
       else {cwd: $cwd, tool_input: {command: .}} end' |
    (cd "$1" && "$hook" 2>"$work/stderr")
}

note() {
  payload_cwd=""
  failures+=("$1"$'\n'"$(sed 's/^/    /' "$work/stderr")")
}

# $1 what the case is called, $2 the directory the hook runs in, $3 the command
allowed() {
  total=$((total + 1))
  local status=0
  run "$2" "$3" || status=$?
  payload_cwd=""
  ((status == 0)) || note "$1: refused (exit $status), and should not have been."
}

# ...and $4 a phrase the refusal has to carry, because a refusal that names
# the wrong cause is the whole defect this file was written for.
refused() {
  total=$((total + 1))
  local status=0
  run "$2" "$3" || status=$?
  payload_cwd=""
  if ((status != 2)); then
    note "$1: allowed (exit $status), and should have been refused."
  elif ! grep -qF -- "$4" "$work/stderr"; then
    note "$1: refused, but the message never says \"$4\"."
  fi
}

# --- The issue is named by the title, never by the body ----------------------

# shellcheck disable=SC2016  # the fixture is command text the hook reads
# before any shell expands it; expanding it here would erase the case.
allowed "a bracketed number that appears only in the body" "$unticketed" '
gh pr create --title "Refuse a pull request that says nothing" --body "$(cat <<EOF
The subject carries the issue, as in [#52] Rename the thing, and nothing more.

No ticket
EOF
)"
'

# --- A body kept in a file ---------------------------------------------------

cat >"$work/body.md" <<'EOF'
This pull request advances the ticket without finishing it.

Part of #52
EOF

allowed "a --body-file given as a quoted literal path" "$unticketed" \
  "gh pr create --title \"[#52] A thing\" --body-file \"$work/body.md\""

# The refusal that has to stay, with a message of its own: there is no path
# here to open, so the body was never read, and saying it says nothing lies.
# shellcheck disable=SC2016  # the fixture is command text the hook reads
# before any shell expands it; expanding it here would erase the case.
refused "a --body-file the shell has not expanded yet" "$unticketed" \
  'gh pr create --title "[#52] A thing" --body-file "$dir/body.md"' \
  "could not be read"

# --- The branch the pull request is for, not the one a directory is on -------

allowed "a pull request for a branch checked out in another worktree" \
  "$(checkout_on issue-116)" \
  'gh pr create --head issue-38 --title "[#38] A thing" --body "Part of #38"'

refused "the same pull request, saying nothing" \
  "$(checkout_on issue-116)" \
  'gh pr create --head issue-38 --title "[#38] A thing" --body "It does a thing."' \
  "issue #38"

# `--head` given and naming no issue settles it: this pull request is for some
# other branch, so whatever directory it was issued from says nothing about it.
allowed "a pull request for a branch that is no issue's" \
  "$(checkout_on issue-116)" \
  'gh pr create --head dependabot/npm_and_yarn/toolchain --title "Bump the toolchain group" --body "Upstream release notes."'

# Without `--head`, the payload says where the command came from, and that
# directory's branch is the one meant — not this hook's own, which belongs to
# whichever checkout the harness happens to have started in.
payload_cwd=$(checkout_on issue-52)
refused "the branch of the directory the command came from" "$unticketed" \
  'gh pr create --title "A thing" --body "It does a thing, at some length."' \
  "is on \`issue-52\`"

# --- The mistake it exists for -----------------------------------------------
#
# PR #55 merged without a closing keyword and left issue #52 open. Every case
# above narrows what the hook reads, so these catch a narrowing gone too far.

refused "an issue named by the branch, and no keyword anywhere" \
  "$(checkout_on issue-52)" \
  'gh pr create --title "A thing" --body "It does a thing, at some length."' \
  "is on \`issue-52\`"

refused "an issue named by a double-quoted title, and no keyword anywhere" "$unticketed" \
  'gh pr create --title "[#52] A thing" --body "It does a thing, at some length."' \
  "the title carries"

# --- The spellings the narrowing could have gone blind to --------------------
#
# The hook used to read the whole command, so every one of these reached it by
# accident. It now reads one flag's value at a time, and a flag it does not
# know is a mistake it stops refusing.

refused "an issue named by a single-quoted title" "$unticketed" \
  "gh pr create --title '[#52] A thing' --body \"It does a thing, at some length.\"" \
  "issue #52"

refused "an issue named by an unquoted title" "$unticketed" \
  'gh pr create --title=[#52] --body "It does a thing, at some length."' \
  "issue #52"

refused "an issue named by the title's short flag" "$unticketed" \
  'gh pr create -t "[#52] A thing" --body "It does a thing, at some length."' \
  "issue #52"

allowed "a body file named by the short flag" "$unticketed" \
  "gh pr create --title \"[#52] A thing\" -F \"$work/body.md\""

allowed "a head named by the short flag" "$(checkout_on issue-116)" \
  'gh pr create -H issue-38 --title "[#38] A thing" --body "Part of #38"'

# `gh` takes `owner:branch` when the head is on a fork.
allowed "a head on a fork" "$(checkout_on issue-116)" \
  'gh pr create --head someone:issue-38 --title "[#38] A thing" --body "Part of #38"'

# --- The cross-repository spelling of a reference ----------------------------
#
# A pull request in an application repository cannot say `Part of #52`: a bare
# number there points at that repository's own issue #52. The hook read only
# the bare form and refused the line `docs/agents/external-repos.md` requires
# instead (issue #150). The spelling is valid for a pull request here too,
# which is what these cases are.

allowed "a closing keyword in the cross-repository spelling" "$(checkout_on issue-52)" \
  'gh pr create --title "A thing" --body "It does a thing. Closes Ibercivis/citsci-federation#52"'

allowed "part of, in the cross-repository spelling" "$(checkout_on issue-52)" \
  'gh pr create --title "A thing" --body "It does a thing. Part of Ibercivis/citsci-federation#52"'

# Another repository's issue #52 is not ours, and a body that advances it has
# said nothing about what becomes of ours.
refused "a cross-reference to another repository's issue" "$(checkout_on issue-52)" \
  'gh pr create --title "A thing" --body "It does a thing. Part of other/repo#52"' \
  "is on \`issue-52\`"

# --- What it lets through ----------------------------------------------------

allowed "a body that says what becomes of the issue" "$(checkout_on issue-52)" \
  'gh pr create --title "A thing" --body "It does a thing. Closes #52"'

allowed "a pull request that serves no issue at all" "$unticketed" \
  'gh pr create --title "A thing" --body "No ticket. It does a thing."'

# The words have to be an invocation rather than a mention. This hook's own
# documentation mentions them, and the first thing it ever did was refuse the
# commit that wrote it.
allowed "a command that only mentions the phrase" "$(checkout_on issue-52)" \
  'grep -rn "gh pr create" scripts/'

# --- The report --------------------------------------------------------------

if ((${#failures[@]} > 0)); then
  printf '\n  %d of %d cases in require-issue-link.sh fail:\n\n' "${#failures[@]}" "$total" >&2
  printf '  - %s\n\n' "${failures[@]}" >&2
  exit 1
fi

printf 'require-issue-link.sh: %d cases.\n' "$total"
