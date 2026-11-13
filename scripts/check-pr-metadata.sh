#!/usr/bin/env bash
#
# Check the title and body a merge publishes: `merge_commit_title` is
# `PR_TITLE`, `merge_commit_message` is `PR_BODY`, and both stay editable
# after review.
#
# Usage: scripts/check-pr-metadata.sh "<title>" "<body>"

set -euo pipefail

title=${1-}
body=${2-}

# A ceiling, not a target: it refuses a title that turned into a paragraph.
# The published subject runs longer — GitHub appends " (#123)" and the `[#12]`
# prefix spends seven more.
readonly max_title=100

failures=()
fail() { failures+=("$1"); }

if [[ -z ${title//[[:space:]]/} ]]; then
  fail "The title is empty."
fi

if ((${#title} > max_title)); then
  fail "The title is ${#title} characters; the limit is ${max_title}."
fi

if [[ $title == *. ]]; then
  fail "The title ends in a period. A commit subject does not."
fi

# No Conventional Commits: subjects here are sentences, not a `feat:`/`docs:`
# taxonomy. This checks the shape they share — a capital, optionally behind
# the `[#12]` prefix.
if [[ -n ${title//[[:space:]]/} && ! $title =~ ^(\[#[0-9]+\][[:space:]]+)?[A-Z] ]]; then
  fail "The title should start with a capital letter, or with [#12] and then one."
fi

# A low floor on purpose: this refuses an empty box, not a short explanation.
body_text=${body//[[:space:]]/}
if ((${#body_text} < 20)); then
  fail "The body is too short to say anything. It becomes the commit message."
fi

# Either half may carry the reference; both land in the same commit. Spelling
# out `No ticket` makes an unticketed change a sentence somebody wrote.
if [[ ! ${title}${body} =~ (#[0-9]+|No\ ticket) ]]; then
  fail "No issue reference (#12) in the title or the body. Write 'No ticket' if there is none."
fi

if ((${#failures[@]} > 0)); then
  printf 'The title and body are what land in `main`, and they do not:\n\n' >&2
  printf '  - %s\n' "${failures[@]}" >&2
  printf '\nEdit the pull request; this check re-runs on an edit.\n' >&2
  exit 1
fi

echo "Title and body check out; they are what the merge will publish."
