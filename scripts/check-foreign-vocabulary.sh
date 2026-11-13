#!/usr/bin/env bash
# Our vocabulary must not leave this repository. See docs/agents/external-repos.md,
# "Vocabulary: the application's words, never ours".
#
# This is a reminder, not a gate: it cannot run as a git hook in somebody else's
# repository, so the checklist calls it by hand before a pull request is opened.
# It reads added lines and added paths -- what we wrote -- and leaves the
# application's own text alone.
#
# Run it from inside the external repository's clone:
#
#   .../citsci-federation/scripts/check-foreign-vocabulary.sh         # the branch's diff
#   .../check-foreign-vocabulary.sh --base origin/main                # against another base
#   .../check-foreign-vocabulary.sh pr-body.md                        # whole files
#   gh pr view 1 --json body -q .body | .../check-foreign-vocabulary.sh -
#
# Exit 0 when it finds nothing, 1 when it finds something. A hit is not a defect
# by itself: one sentence of context in LOCAL-DEV.md, or a link to an ADR, is
# allowed and will still be printed. What is checked is that somebody read it.
set -euo pipefail

# Ours in any casing. Kept lowercase: the diff scan lowercases what it compares.
LOOSE='pilot|brokered app|federated app|federation proxy|broker'
# The common noun is the application's; the capitalised term is ours.
STRICT_GREP='\b(Person|Persons)\b'
STRICT_AWK='(^|[^A-Za-z])(Person|Persons)([^A-Za-z]|$)'

base=""
files=()
while [ $# -gt 0 ]; do
  case "$1" in
    --base) base="${2:?--base needs a ref}"; shift 2 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) files+=("$1"); shift ;;
  esac
done

hits=0
report() { [ -n "$1" ] && { printf '%s\n' "$1"; hits=1; }; return 0; }

if [ ${#files[@]} -gt 0 ]; then
  for f in "${files[@]}"; do
    if [ "$f" = "-" ]; then
      text=$(cat); src="(stdin)"
    else
      text=$(cat -- "$f"); src="$f"
    fi
    # The match runs on the text, the filename is added afterwards, so a path
    # that itself contains one of the words cannot flag every line in it.
    report "$(printf '%s\n' "$text" | grep -nEi "$LOOSE" | sed "s|^|$src:|" || true)"
    report "$(printf '%s\n' "$text" | grep -nE "$STRICT_GREP" | sed "s|^|$src:|" || true)"
  done
else
  # No files named: read the branch. The base is the one the pull request will
  # use -- `federation` where it exists, `main` in a repository without one yet.
  if [ -z "$base" ]; then
    if git rev-parse --verify --quiet origin/federation >/dev/null; then
      base=origin/federation
    else
      base=origin/main
    fi
  fi
  echo "# added lines and added paths, against $base" >&2

  report "$(git diff --name-only --diff-filter=AR "$base...HEAD" \
    | grep -Ei "$LOOSE" | sed 's|^|added path: |' || true)"

  # Added lines only, each with the file and the line it landed on. The filter
  # lives inside awk so it sees the content alone, never the prefix.
  report "$(git diff --unified=0 "$base...HEAD" | awk -v loose="$LOOSE" -v strict="$STRICT_AWK" '
    /^\+\+\+ b\// { file = substr($0, 7); next }
    /^@@/        { split($0, a, "+"); split(a[2], b, /[ ,]/); line = b[1]; next }
    /^\+/ {
      content = substr($0, 2)
      if (tolower(content) ~ loose || content ~ strict) print file ":" line ":" content
      line++
    }
  ')"
fi

if [ "$hits" -eq 0 ]; then
  echo "nothing of ours in it."
  exit 0
fi
echo >&2
echo "Our vocabulary, in somebody else's repository. See docs/agents/external-repos.md." >&2
exit 1
