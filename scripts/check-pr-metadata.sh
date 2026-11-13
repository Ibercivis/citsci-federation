#!/usr/bin/env bash
#
# Check the two strings a merge publishes.
#
# `merge_commit_title` is `PR_TITLE` and `merge_commit_message` is `PR_BODY`,
# so this pair is the message of the commit `main` records for the pull
# request. Unlike a commit message it stays editable after review, which is
# why a check on it is worth running.
#
# Usage: scripts/check-pr-metadata.sh "<title>" "<body>"
#
# CI passes the two through the environment rather than into the command line,
# so that a title containing shell syntax stays data.

set -euo pipefail

title=${1-}
body=${2-}

# GitHub appends " (#123)" to the subject it builds, so the cap is on the title
# alone and the published subject runs about seven characters longer. Subjects
# here are whole sentences, and they now open with the `[#12]` the issue
# convention asks for, which spends seven more before the sentence starts.
#
# So this is a ceiling, not a target. It is here to refuse a title that has
# turned into a paragraph, not to make anyone count characters; a limit set
# close to what has already been written is one that fires on ordinary work.
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

# No Conventional Commits prefix is demanded, and that is deliberate: this
# repository's subjects are sentences that say what the change does, and a
# `feat:`/`docs:` taxonomy would have to be imposed on 50 merged commits that
# do without it. What is checked is the shape those sentences already share —
# a capital letter, optionally behind the `[#12]` ticket prefix some of them
# carry.
if [[ -n ${title//[[:space:]]/} && ! $title =~ ^(\[#[0-9]+\][[:space:]]+)?[A-Z] ]]; then
  fail "The title should start with a capital letter, or with [#12] and then one."
fi

# A body is what the merge commit says beyond its subject, and `PR_BODY` is
# where it comes from. The floor is low on purpose: this refuses an
# empty box, not a short explanation.
body_text=${body//[[:space:]]/}
if ((${#body_text} < 20)); then
  fail "The body is too short to say anything. It becomes the commit message."
fi

# The issue this serves, named where the merge commit will carry it. Either
# half may do —
# `[#52]` in the title counts — because both halves land in the same commit.
# `No ticket` is the way out for a change no issue asked for, and spelling it
# out is the point: it makes an unticketed change a sentence somebody wrote.
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
