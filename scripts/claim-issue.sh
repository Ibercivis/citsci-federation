#!/bin/sh
# Marks the issue a branch serves as taken, by assigning it, the first time
# work touches that branch. Claude Code runs this after every Bash call and at
# the start of every session; `docs/agents/issue-tracker.md` calls this a claim
# and already defines it as an assignee.
#
# The point is not bookkeeping. An unassigned open ticket reads as free, so two
# sessions pick up the same one, and the frontier query has nothing to filter
# on. The branch is the earliest moment the intention is unambiguous.
#
# It attempts the claim exactly once per branch per clone, recorded in the git
# directory, which is private to this checkout and never committed. One attempt
# rather than one success, on purpose: a hook that retries a failing network
# call on every Bash command is a hook somebody switches off. When the attempt
# fails it says so rather than passing in silence.
#
# It never fails the hook that calls it.

set -u

branch=$(git branch --show-current 2>/dev/null) || exit 0

case "$branch" in
  issue-*) ;;
  *) exit 0 ;;
esac

issue=${branch#issue-}
case "$issue" in
  '' | *[!0-9]*) exit 0 ;;
esac

git_dir=$(git rev-parse --git-dir 2>/dev/null) || exit 0
marker="$git_dir/claimed-issue-$issue"
[ -e "$marker" ] && exit 0

# Before the network, not after: one attempt is the budget either way, and a
# crash between the two should not buy a second one.
: >"$marker" 2>/dev/null || exit 0

if ! ticket=$(gh issue view "$issue" --json state,assignees 2>/dev/null); then
  printf '{"systemMessage":"Could not reach issue #%s to mark it as started. Assign it yourself if you are working on it."}\n' "$issue"
  exit 0
fi

state=$(printf '%s' "$ticket" | jq -r '.state // ""')
assigned=$(printf '%s' "$ticket" | jq -r '.assignees | length')

# A closed ticket is not started, and one somebody already holds is not ours to
# take: either way the branch has an owner and there is nothing to record.
[ "$state" = "OPEN" ] || exit 0
[ "$assigned" = "0" ] || exit 0

if gh issue edit "$issue" --add-assignee @me >/dev/null 2>&1; then
  printf '{"systemMessage":"Issue #%s is now assigned to you: work on it has started."}\n' "$issue"
else
  printf '{"systemMessage":"Could not assign issue #%s. Assign it yourself if you are working on it."}\n' "$issue"
fi

exit 0
