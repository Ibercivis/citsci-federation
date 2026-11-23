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

# One line per repository the composition builds from: the folder under apps/,
# then the remote. The folder is named after the repository rather than after
# the application, because what lands in it is that repository and `git` is run
# in it by hand afterwards.
#
# compose.apps.yaml builds from these paths, and the two lists have to agree:
# a repository added here without a service there is a slow clone nobody uses.
APPS="
gdalface|https://github.com/Ibercivis/gdalface.git
citsci-api|https://github.com/Ibercivis/citsci-api.git
geonity|https://github.com/Ibercivis/Geonity.git
openred|https://github.com/Ibercivis/OpenRed.git
openred-react|https://github.com/Ibercivis/openred-react.git
"

BRANCH=federation

root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
mkdir -p "$root/apps"

echo "$APPS" | while IFS='|' read -r folder remote; do
  [ -n "$folder" ] || continue
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
done
