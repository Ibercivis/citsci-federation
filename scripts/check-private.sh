#!/bin/sh
# Refuses a commit that stages anything under docs/private/.
#
# That path is gitignored because this repository is public and the path holds
# unfixed weaknesses in running systems. `git add -f` defeats the ignore rule,
# and a push to a public remote cannot be undone. This turns the convention in
# CLAUDE.md into a refusal.
#
# It cannot stop `git commit --no-verify`. Nothing short of a server-side check
# can, and the point here is to catch the mistake, not the decision.

set -u

# Matches the path itself as well as anything under it: the nested repository
# makes individual files unstageable, but `git add -f docs/private` still
# records a gitlink, and a pointer to a private repository has no business here.
staged=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '^docs/private(/|$)' || true)

[ -z "$staged" ] && exit 0

cat >&2 <<EOF

  Refusing this commit: it stages internal notes.

$(printf '    %s\n' $staged)

  docs/private/ is its own private repository and must never enter this one,
  which is public. Unstage it and commit there instead:

    git restore --staged docs/private
    git -C docs/private commit -am "<what changed>" && git -C docs/private push

EOF
exit 1
