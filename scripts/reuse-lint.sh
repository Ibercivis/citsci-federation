#!/bin/sh
# Checks every tracked file for copyright and licence information (ADR-0013).
#
# `reuse lint` walks the filesystem itself and asks git what `.gitignore`
# ignores. In an agent's worktree under `.claude/worktrees/`, `.git` is a file
# pointing at a directory outside the mounted volume, so git answers nothing in
# the container, nothing is skipped, and the lint fails on a dependency's
# licence inside `node_modules/` — a `pre-push` nobody can satisfy there.
#
# Handing it the tracked files instead reads the same set with or without a
# worktree. What is lost is the report of licences in `LICENSES/` that no file
# uses, which the REUSE specification does not count as a failure anyway.
set -eu

count=$(git ls-files | wc -l | tr -d ' ')
if [ "$count" -eq 0 ]; then
  echo "reuse-lint: git listed no tracked files, so nothing was checked" >&2
  exit 1
fi

git ls-files -z | xargs -0 docker run --rm \
  --user "$(id -u):$(id -g)" \
  --volume "$PWD:/data" \
  fsfe/reuse:6.3.0@sha256:2748d04c2adeb747c9a44831bc99a9cbfd7bf7ff6fc371a4b63204944e3e47b6 \
  lint-file

echo "reuse-lint: $count tracked files carry copyright and licence information"
