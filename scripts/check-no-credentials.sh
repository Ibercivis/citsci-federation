#!/bin/sh
# Refuses a file that carries a live credential, by shape rather than by name.
#
#   check-no-credentials.sh FILE...        exit 0 clean, exit 1 something matched
#
# Called at pre-commit over the staged files, and by private-sync.sh before its
# unattended commit.
#
# Shapes, not words: `security-findings.md` discusses passwords and tokens in
# prose and has to keep committing. The first refusal of an ordinary note is the
# last time anyone leaves this switched on, so a pattern matches only what an
# issuer produces, or an environment assignment with a long value.
#
# It never prints what it matched — a guard that echoes a secret into a log has
# moved it, not stopped it. File, line and pattern name are enough.
#
# Escape hatch for a development constant that looks like a secret: end the line
# with `# not-a-credential`.

set -u

tab=$(printf '\t')
status=0

for file do
  # A staged rename or delete is a name with nothing to read; a match in binary
  # content cannot be reported as a line.
  [ -f "$file" ] || continue
  grep -Iq . "$file" 2>/dev/null || continue

  # A here-document, not a variable: nothing parses the patterns on the way in.
  # Each regex is written so this file does not match itself — a bracket
  # expression is not a member of its own character class — so it can scan
  # itself, which the test does.
  while IFS="$tab" read -r name regex; do
    [ -n "$name" ] || continue

    # The escape hatch applies once here, not inside every pattern. Only line
    # numbers leave grep.
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

  The lines above are shaped like live credentials.

  A credential belongs in no repository — a private one keeps it in its history
  just as long. Put the value in the shared vault and reference the entry.

  If it only looks like a secret, end the line with `# not-a-credential`.

EOF
exit 1
