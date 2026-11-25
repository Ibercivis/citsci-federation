#!/bin/sh
# Checks every application of the Brokered Composition out at its `federation`
# branch, into apps/, which is gitignored.
#
# No application's code is vendored into this repository (ADR-0009). What the
# composition builds from is a working copy of somebody else's repository, and
# this script is the only thing that writes it: run it on an empty machine and
# `pnpm apps:up` has everything it needs but Docker.
#
# `federation` is the branch the pilot deploys from in every one of these
# repositories, and `docs/agents/external-repos.md` says why it is never `main`
# and never a topic branch.
#
# A checkout with local changes is left exactly as it is, with a line saying
# so. That is the case where somebody is debugging an application from inside
# the composition, and losing their work to a scripted reset would be the worst
# thing this script could do.

set -eu

BRANCH=federation

root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
mkdir -p "$root/apps"

# Which repositories, and from where, is `scripts/apps.list` — one list, read
# here and by `check-federation-drift.sh`. That file says why it is a file.
#
# It arrives on fd 3 rather than on stdin, because `git` below is then unable
# to consume the rest of it. What that would cost is a repository skipped, with
# nothing said.
while IFS='|' read -r folder remote <&3; do
  case "$folder" in '' | '#'*) continue ;; esac
  path="$root/apps/$folder"

  if [ ! -d "$path/.git" ]; then
    echo "apps/$folder: cloning $remote at $BRANCH"
    git clone --quiet --branch "$BRANCH" "$remote" "$path"
    continue
  fi

  # Read first, and separately from judging what came back: as one condition,
  # a git that failed looks exactly like a clean checkout, and what follows a
  # clean checkout here is `reset --hard`. Losing somebody's work in progress
  # is the worst thing this script could do.
  if ! dirt=$(git -C "$path" status --porcelain); then
    echo "apps/$folder: git cannot read it, left untouched"
    continue
  fi

  if [ -n "$dirt" ]; then
    echo "apps/$folder: local changes, left untouched (on $(git -C "$path" branch --show-current))"
    continue
  fi

  git -C "$path" fetch --quiet origin "$BRANCH"
  before=$(git -C "$path" rev-parse HEAD)
  git -C "$path" switch --quiet --force "$BRANCH" 2>/dev/null ||
    git -C "$path" switch --quiet --force -c "$BRANCH" "origin/$BRANCH"
  git -C "$path" reset --quiet --hard "origin/$BRANCH"
  after=$(git -C "$path" rev-parse HEAD)

  if [ "$before" = "$after" ]; then
    echo "apps/$folder: already at $BRANCH $(git -C "$path" rev-parse --short HEAD)"
  else
    echo "apps/$folder: $BRANCH moved to $(git -C "$path" rev-parse --short HEAD) — rebuild with --build"
  fi
done 3<"$root/scripts/apps.list"
