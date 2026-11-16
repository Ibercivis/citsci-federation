#!/bin/sh
# Refuses a file that carries a live credential, by shape rather than by name.
#
#   check-no-credentials.sh FILE...        exit 0 clean, exit 1 something matched
#
# Two callers, for the two directions a secret can leave a laptop:
#
#   lefthook.yml       pre-commit, over staged files, so a pasted .env does not
#                      reach a public remote.
#   private-sync.sh    before its unattended commit, where the file would
#                      otherwise be published without anyone reading it back.
#
# Why shapes and not words. A register that documents weaknesses discusses
# passwords, database users and tokens in prose, and it has to keep committing:
# the moment this refuses an ordinary note, somebody passes --no-verify by
# habit and the check is worth nothing from then on. So every pattern below
# matches either a string only a credential issuer produces, or an environment
# assignment at the start of a line with a long value — which is what a pasted
# .env looks like and what prose does not look like.
#
# It never prints what it matched. A hook that echoes a secret into a terminal,
# a CI log or an agent transcript has moved it somewhere new rather than
# stopped it. File, line and the name of the pattern are enough to go and look.
#
# Escape hatch, for a development constant that genuinely looks like a secret:
# end the line with `# not-a-credential`. The declared development stack needs
# this, because reproducible fake secrets are the point there.

set -u

tab=$(printf '\t')
status=0

for file do
  # A path git hands us can be gone by now — a rename or a delete is staged as
  # a name with nothing to read — and binary content is skipped because a match
  # in it cannot be reported as a line.
  [ -f "$file" ] || continue
  grep -Iq . "$file" 2>/dev/null || continue

  # The patterns are read from a here-document rather than a variable so that
  # no command substitution parses them: a single quote inside a here-document
  # nested in `$( )` breaks bash's parser, which cost an afternoon once.
  #
  # Each regex is also written so this file does not match itself. A bracket
  # expression is not a member of its own character class, so `AKIA[0-9A-Z]{16}`
  # as text fails `AKIA[0-9A-Z]{16}` as a pattern, and the scanner can scan
  # itself — which the test does.
  while IFS="$tab" read -r name regex; do
    [ -n "$name" ] || continue

    # The escape hatch is applied here, once, rather than inside every pattern,
    # so it reads the same whichever one fired. Only line numbers leave grep.
    lines=$(grep -nE "$regex" "$file" 2>/dev/null | grep -v '# not-a-credential' | cut -d: -f1 || true)
    [ -z "$lines" ] && continue

    status=1
    for line in $lines; do
      printf '  %s:%s\t%s\n' "$file" "$line" "$name" >&2
    done
  done <<'PATTERNS'
aws-access-key-id	(^|[^A-Za-z0-9])(AKIA|ASIA)[0-9A-Z]{16}([^A-Za-z0-9]|$)
google-oauth-client-secret	GOCSPX-[A-Za-z0-9_-]{20,}
google-api-key	(^|[^A-Za-z0-9])AIza[0-9A-Za-z_-]{35}([^A-Za-z0-9]|$)
private-key-block	-----BEGIN ([A-Z]+ )*PRIVATE KEY-----
github-token	(^|[^A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{36}
slack-token	(^|[^A-Za-z0-9])xox[baprse]-[A-Za-z0-9-]{10,}
stripe-live-key	(^|[^A-Za-z0-9])sk_live_[A-Za-z0-9]{20,}
mapbox-secret-token	(^|[^A-Za-z0-9])sk\.eyJ[A-Za-z0-9_-]{20,}
credentials-in-url	[a-z][a-z0-9+.-]+://[^:@/[:space:]]+:[^@/[:space:]]{6,}@
env-assignment	^[A-Za-z_][A-Za-z0-9_]*(SECRET|PASSWORD|PASSWD|TOKEN|APIKEY|API_KEY|ACCESS_KEY|PRIVATE_KEY|CREDENTIAL)[A-Za-z0-9_]*[[:space:]]*=[[:space:]]*.?[^[:space:]]{12,}
PATTERNS
done

[ "$status" -eq 0 ] && exit 0

cat >&2 <<'EOF'

  The lines above carry something shaped like a live credential.

  A credential does not belong in any repository: not in a public one, and not
  in a private one either, whose history keeps it just as long. Put the value
  in the shared vault and reference the entry.

  If this is a development constant that only looks like a secret, end the line
  with `# not-a-credential` and it is left alone.

EOF
exit 1
