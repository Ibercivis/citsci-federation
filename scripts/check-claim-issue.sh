#!/usr/bin/env bash
#
# The cases `hooks/claim-issue.sh` has to get right. `pnpm check` runs this.
#
# The seam is the hook's own process: the branch of the directory it runs in
# goes in, and what it asks the issue tracker comes out. A stub `gh` on PATH
# records every call and fails, which is what lets a case observe the number
# the hook read without a network and without assigning anybody to a live
# ticket.
#
# Failing the stub is not a shortcut around the success path. It is the one
# branch whose message names the issue out loud, so the number is observable
# twice: in the call the hook made, and in what it told the person.
#
# The claim itself is not asserted here. `gh issue edit` is the hook's last
# line and the stub never gets that far — what these cases hold is the step
# that was wrong: which issue, if any, the branch names.

set -euo pipefail

# `pnpm check` runs from `pre-push`, and git hands a hook its own repository in
# the environment. Inherited, those variables answer every `git` call below
# with this checkout's branch whatever directory it was asked about.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX GIT_COMMON_DIR \
  GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES

hook=$(cd "$(dirname "$0")" && pwd)/hooks/claim-issue.sh

# `pwd -P` because a case's directory has to be the path git will report, and
# on macOS `mktemp -d` hands back one that reaches it through a symlink.
work=$(cd "$(mktemp -d)" && pwd -P)
trap 'rm -rf "$work"' EXIT

# Nothing below should ever discover a repository above its own.
export GIT_CEILING_DIRECTORIES="$work"

export GH_LOG="$work/gh-calls"
mkdir -p "$work/bin"
cat >"$work/bin/gh" <<'STUB'
#!/bin/sh
printf '%s\n' "$*" >>"$GH_LOG"
exit 1
STUB
chmod +x "$work/bin/gh"
export PATH="$work/bin:$PATH"

# Every case runs inside a checkout whose branch it chose. `no-issue` claims no
# ticket; the rest are the spellings the rule has to answer for. One claiming
# case per checkout, because the hook spends its one attempt on the first.
#
# `git branch --show-current` answers before the first commit, which makes an
# empty repository enough.
for branch in issue-102-hooks-directory issue-102 issue-77-twice \
  issue-102abc issue-abc no-issue; do
  mkdir -p "$work/checkout-$branch"
  git -C "$work/checkout-$branch" init -q -b "$branch"
done

failures=()
total=0
hook_status=0

# The hook reads no payload: the harness hands it one and it ignores it, so a
# case is the directory it runs in and nothing else.
run() {
  : >"$GH_LOG"
  hook_status=0
  (cd "$work/checkout-$1" && "$hook" >"$work/stdout" 2>"$work/stderr") ||
    hook_status=$?
}

note() { failures+=("$1"); }

# A hook on `PostToolUse` has no call left to refuse, and `hooks/README.md`
# gives any status but 0 and 2 to the person alone. Every case holds it to 0.
exits_zero() {
  ((hook_status == 0)) ||
    note "$1: the hook exited $hook_status, and a claim must never fail its event."
}

# $1 what the case is called, $2 the branch, $3 the issue it names
claims() {
  total=$((total + 1))
  run "$2"
  exits_zero "$1"
  if ! grep -qFx "issue view $3 --json state,assignees" "$GH_LOG"; then
    note "$1: the hook asked about $(wc -l <"$GH_LOG" | tr -d ' ') call(s), none of them issue #$3:
$(sed 's/^/      /' "$GH_LOG")"
  elif ! grep -qF "#$3" "$work/stdout"; then
    note "$1: the hook asked about issue #$3 but never said so: $(cat "$work/stdout")"
  fi
}

# $1 what the case is called, $2 the branch
claims_nothing() {
  total=$((total + 1))
  run "$2"
  exits_zero "$1"
  if [ -s "$GH_LOG" ]; then
    note "$1: the hook asked the tracker about a branch that names no issue:
$(sed 's/^/      /' "$GH_LOG")"
  elif [ -s "$work/stdout" ]; then
    note "$1: the hook said something about a branch that names no issue: $(cat "$work/stdout")"
  fi
}

# --- The slug every branch here actually carries ------------------------------
#
# The hook read `issue-<n>` and digits to the end of the name, and no branch in
# this repository is spelled that way. So it returned before the network and an
# open ticket somebody was working on went on reading as free: #102 came out of
# a whole session unassigned, which is the failure the hook exists to prevent
# (issue #205).

claims "a slugged branch" issue-102-hooks-directory 102

claims "a bare branch" issue-102 102

# --- The one direction the widening could have gone too far -------------------
#
# The number ends at the first `-` or at the end of the name. A rule that
# looked for digits anywhere would read 102 out of this and assign an issue
# the branch never named.

claims_nothing "a branch whose number runs into the slug without a boundary" issue-102abc

claims_nothing "a branch under the prefix that names no number" issue-abc

claims_nothing "a branch that is no issue's" no-issue

# --- One attempt, not one success --------------------------------------------
#
# The attempt is recorded before the call, and the record is what stops a hook
# that runs after every command from retrying a failing network call. The stub
# fails, so this is a branch whose claim did not happen and will not be tried
# again.

total=$((total + 1))
run issue-77-twice
exits_zero "a second attempt on the same branch"
run issue-77-twice
if [ -s "$GH_LOG" ]; then
  note "a second attempt on the same branch: the hook asked again:
$(sed 's/^/      /' "$GH_LOG")"
fi

# --- The report --------------------------------------------------------------

if ((${#failures[@]} > 0)); then
  printf '\n  %d of %d cases in claim-issue.sh fail:\n\n' "${#failures[@]}" "$total" >&2
  printf '  - %s\n\n' "${failures[@]}" >&2
  exit 1
fi

printf 'claim-issue.sh: %d cases.\n' "$total"
