#!/bin/sh
# Leaves this machine with nothing of the pilot running and no data behind it,
# so that the next `pnpm apps:up` is a first run again.
#
# Two kinds of stack, treated differently, and the difference is ownership.
# This repository's own two — the Brokered Composition and the Broker alone —
# lose their volumes, because starting from zero is the whole point of asking
# for this. The per-application stacks of `docs/local-development.md` belong to
# other repositories: they are stopped and their data is kept, because somebody
# may be mid-debug in one and stopping a container costs nothing to undo.
#
# They are stopped at all because they are what gets mistaken for the
# composition: they publish ports on localhost, the composition publishes none,
# and `localhost:8000` answering while `lostatnight.localhost:8080` does not is
# a confusing half-hour. None of them holds port 8080, so none of them blocks
# the composition — this is hygiene, not a precondition.

set -eu

root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"

# A project compose has never heard of makes `down` print a warning and exit 0,
# so this is here for the output rather than for the exit code: a line naming
# what was not there is worth more than a warning that reads like a failure.
exists() {
  docker compose ls --all --quiet | grep -qx "$1"
}

echo "== this repository's stacks, data and all"
for project in citsci-apps citsci-broker; do
  if exists "$project"; then
    docker compose -p "$project" --profile '*' down -v --remove-orphans
  else
    echo "$project: not there"
  fi
done

echo
echo "== the per-application stacks, stopped, their data kept"
# The names each of those repositories gives its own compose project. They are
# not ours to keep in step: a name that has moved makes a line saying so, and
# that stack stays up, which is the harmless half of being wrong here.
for project in lostatnight-local citsci-api openred-local; do
  if exists "$project"; then
    docker compose -p "$project" down --remove-orphans
  else
    echo "$project: not there"
  fi
done

echo
echo "== still running"
docker compose ls

echo
echo "Up again, from nothing: pnpm apps:up — slower than usual, because the"
echo "front ends' node_modules were volumes and went with the rest."
