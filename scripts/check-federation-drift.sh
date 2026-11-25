#!/bin/sh
# How far behind its own default branch each application's `federation` branch
# has fallen.
#
# `federation` is the branch the pilot deploys from in every application
# repository (`docs/agents/external-repos.md`). It was cut from the default
# branch once and does not follow it, so the gap it carries only grows, and
# nothing in the composition notices: `pnpm apps:up` builds whatever
# `federation` points at and says every address answered. LostAtNight's reached
# 54 commits behind, with a merge base a year old, and that was discovered while
# an integration was being reviewed against a tree from December 2025.
#
# So this reads the number on a cadence instead of discovering it. It needs no
# clone: two calls to GitHub's API per repository, over the five in
# `scripts/apps.list`.
#
# What it does not do is refresh anything. The mechanics of a refresh — why
# force-pushing `federation` is safe for the Composition, and who has to be
# told before it happens — are in `issue #118`, and they are a person's
# decision, not this script's.
#
# Run it by hand with `pnpm federation-drift:check`.
# `.github/workflows/federation-drift.yaml` runs it weekly, which is the only
# thing that makes it a number somebody sees.

set -eu

# Five commits, chosen rather than derived: at the ordinary rate of nine
# commits in ten days a `federation` branch crosses this within the week, so a
# weekly run that passes means somebody refreshed it and a run that fails means
# nobody did. It is a tighter limit than the drift that caused any harm so far,
# and that is the point — 54 commits behind is what the loose end looks like.
#
# Raise it for one run with `FEDERATION_DRIFT_LIMIT=20 pnpm
# federation-drift:check`; changing what the weekly run asks for means editing
# this line, in a pull request.
LIMIT=${FEDERATION_DRIFT_LIMIT:-5}

# This check outlives its reason. It exists because `federation` branches sit
# unrefreshed for as long as the pilot deploys from them, and the pilot ends in
# January 2027: after that a gap between `federation` and `main` is somebody
# else's business, and a red run every Monday is noise that trains people to
# ignore a red run.
#
# Which is why the reminder is the check itself rather than a line in a
# document. Past this date it fails saying what to delete, and deleting it is
# the whole of the work.
EXPIRES=20270131
EXPIRES_READABLE="31 January 2027"

root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"

if [ "$(date -u +%Y%m%d)" -gt "$EXPIRES" ]; then
  echo "check-federation-drift: the pilot ended, and this check did not." >&2
  echo "It was written to expire on $EXPIRES_READABLE. Delete it:" >&2
  echo "  scripts/check-federation-drift.sh" >&2
  echo "  .github/workflows/federation-drift.yaml" >&2
  echo "  the federation-drift:check script in package.json" >&2
  echo "  its two rows in docs/verification.md" >&2
  echo "scripts/apps.list stays: checkout-apps.sh reads it too." >&2
  exit 1
fi

# `gh` rather than `curl`: it carries the authentication a person already has
# and the token CI already has, and the five repositories are public, so
# `GITHUB_TOKEN` is enough to read them.
if ! command -v gh >/dev/null 2>&1; then
  echo "check-federation-drift: needs the gh CLI, which is not installed." >&2
  echo "This check reads five repositories' branches, not this working tree," >&2
  echo "so there is nothing it can usefully say without it." >&2
  exit 1
fi

failed=0
drifted=0

echo "check-federation-drift: against each repository's own default branch"
echo

# Read on fd 3, so a `gh` inside the loop cannot consume the rest of the list
# and lose a repository without saying so.
while IFS='|' read -r folder remote <&3; do
  case "$folder" in '' | '#'*) continue ;; esac

  # `Ibercivis/Geonity` out of `https://github.com/Ibercivis/Geonity.git`. The
  # list holds the remote because `checkout-apps.sh` clones from it; this is
  # the same fact in the shape the API asks for.
  slug=${remote#https://github.com/}
  slug=${slug%.git}

  # Asked rather than assumed, because they do not agree: four of these
  # repositories branch from `main` and openred-react from `master`. A
  # hardcoded `main` answers 404 there, which would read as a repository with
  # no `federation` branch.
  # On a failure the capture holds the response body and `gh`'s own summary of
  # it, in that order and on one line. `##*gh: ` keeps the summary, which is
  # the half that names the cause — a 404, a rate limit, an expired token.
  if ! base=$(gh api "repos/$slug" -q .default_branch 2>&1); then
    printf '%-8s %-14s could not read the default branch: %s\n' FAILED "$folder" "${base##*gh: }"
    failed=1
    continue
  fi

  # `compare/base...federation` counts in both directions at once:
  # `behind_by` is the commits on the default branch that `federation` lacks,
  # which is the number this check exists for, and `ahead_by` is ours. The
  # merge base's date is printed beside them because it says how old the tree
  # the pilot builds from is, but it gates nothing: an application whose
  # default branch has gone quiet sits at 0 behind with an ageing merge base,
  # and there is nothing wrong with that.
  if ! answer=$(gh api "repos/$slug/compare/$base...federation" \
    -q '[(.behind_by|tostring), (.ahead_by|tostring), .merge_base_commit.commit.committer.date] | join(" ")' 2>&1); then
    printf '%-8s %-14s no comparison against %s: %s\n' FAILED "$folder" "$base" "${answer##*gh: }"
    echo "         (a repository with no \`federation\` branch answers this way)"
    failed=1
    continue
  fi

  # Split on the join above. `set --` rather than a read, so the three stay in
  # this shell.
  # shellcheck disable=SC2086
  set -- $answer
  behind=$1
  ahead=$2
  merge_base=${3%T*}

  if [ "$behind" -ge "$LIMIT" ]; then
    verdict=DRIFTED
    drifted=1
    failed=1
  else
    verdict=ok
  fi

  # The default branch sits in a column of its own width, because `master` is
  # a character longer than `main` and a table that shifts by one is a table
  # read wrong.
  printf '%-8s %-14s %4s behind %-7s %4s ahead  merge base %s\n' \
    "$verdict" "$folder" "$behind" "$base" "$ahead" "$merge_base"
done 3<"$root/scripts/apps.list"

if [ "$drifted" -ne 0 ]; then
  echo
  echo "A \`federation\` branch is $LIMIT or more commits behind the branch it was cut" >&2
  echo "from. The pilot deploys from it, so what is running is that far out of" >&2
  echo "date — and an integration reviewed against it is being reviewed against a" >&2
  echo "tree nobody else has." >&2
  echo "Refreshing one is a person's decision: \`issue #118\` holds what it costs" >&2
  echo "and who has to be told first." >&2
fi

exit "$failed"
