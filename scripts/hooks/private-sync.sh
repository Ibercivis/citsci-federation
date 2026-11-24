#!/bin/sh
# Keeps docs/private/ — a separate private repository mounted at a gitignored
# path — in step with its remote, so that neither of us has to remember a
# second git. Wired to Claude Code's SessionStart and Stop hooks.
#
#   private-sync.sh pull    before work: take what the other person recorded
#   private-sync.sh push    after work:  commit and publish what this turn wrote
#
# Two rules it does not break:
#
#   It never fails the hook that calls it. A sync problem is reported and the
#   session carries on.
#
#   It never leaves the repository half-way through anything, and it never
#   commits into a state a person was in the middle of resolving. Both sides
#   append to the end of the same register, so a genuine conflict is normal;
#   when one happens the repository is returned to where it was and the
#   conflict is handed over whole, because deciding which entry comes first is
#   not a thing a hook should guess at.

set -u

root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
private="$root/docs/private"

[ -d "$private/.git" ] || exit 0

git_private() {
  git -C "$private" -c core.hooksPath= "$@"
}

has_remote() {
  git_private remote get-url origin >/dev/null 2>&1
}

# True while a rebase or merge is unfinished: someone is mid-resolution.
mid_operation() {
  gitdir=$(git_private rev-parse --absolute-git-dir 2>/dev/null) || return 1
  [ -d "$gitdir/rebase-merge" ] || [ -d "$gitdir/rebase-apply" ] ||
    [ -f "$gitdir/MERGE_HEAD" ]
}

held() {
  echo "internal notes: docs/private/ has an unfinished rebase or merge; left untouched." >&2
  echo "  finish it with: git -C docs/private status" >&2
}

case "${1:-}" in
  pull)
    mid_operation && { held; exit 0; }
    has_remote || exit 0
    git_private pull --rebase --autostash --quiet 2>/dev/null && exit 0

    # Do not leave a half-applied rebase behind: put the repository back.
    mid_operation && git_private rebase --abort >/dev/null 2>&1

    echo "internal notes: docs/private/ and its remote have both moved; nothing was changed." >&2
    echo "  reconcile by hand: git -C docs/private pull --rebase" >&2
    ;;

  push)
    mid_operation && { held; exit 0; }

    if [ -n "$(git_private status --porcelain)" ]; then
      git_private add -A
      changed=$(git_private diff --cached --name-only | paste -sd ', ' -)
      git_private commit --no-verify --quiet -m "Update ${changed}" -m \
        "Recorded in a Claude Code session and synced automatically." ||
        echo "internal notes: commit failed in docs/private/" >&2
    fi

    has_remote || exit 0
    [ -z "$(git_private log --branches --not --remotes --oneline 2>/dev/null)" ] && exit 0
    git_private push --quiet 2>/dev/null && exit 0
    echo "internal notes: commits are safe locally but the push failed from docs/private/." >&2
    echo "  the next session's pull will reconcile it, or: git -C docs/private pull --rebase" >&2
    ;;

  *)
    echo "usage: private-sync.sh pull|push" >&2
    ;;
esac

exit 0
