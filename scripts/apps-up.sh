#!/bin/sh
# Brings up the whole Brokered Composition (ADR-0009): the Broker, the proxy in
# front of it, the mail catcher, and every Brokered App that has been
# integrated — each built from its own `federation` branch.
#
# This is the one command. It checks the applications out, builds what has
# changed, waits for the composition to be reachable, migrates and seeds any
# application whose database is empty, then reads every address back through
# the proxy and says what answered.
#
# Run it as often as you like: it seeds only a database with no accounts in it,
# because after the first sign-in through the Broker an application holds
# accounts the seed command did not create — and both seed commands refuse to
# touch a database like that, which is the right refusal rather than a problem
# to work around.
#
# With no arguments it builds. Given any, they replace that default and are
# passed to `docker compose up` as they are, which is what makes the one worth
# knowing work: `apps-up.sh --no-build` skips the image check on a day nothing
# changed. `--build` cannot simply be hardcoded here and added to — compose
# refuses `--build --no-build` together, and refuses it before anything in this
# script has run.

set -eu

root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"

compose() {
  docker compose -f compose.yaml -f compose.apps.yaml "$@"
}

# Every address the composition serves is declared in `.env` and read from
# there — by the proxy, by the realm, by each application, and here.
#
# Except BROKER_MODE when the shell sets it: compose lets the shell override
# `.env`, and `BROKER_MODE=demo pnpm apps:reset` has to mean what it says.
# Sourcing the file would put `testing` back, and COMPOSE_PROFILES with it.
#
# So the mode is restored and the profiles are dropped rather than restated:
# unset, COMPOSE_PROFILES is absent from compose's environment, and compose
# interpolates the `COMPOSE_PROFILES=${BROKER_MODE}` in `.env` against the mode
# above. Which services a mode starts stays declared in one place.
shell_mode=${BROKER_MODE-}
set -a
# shellcheck disable=SC1091
. ./.env
if [ -n "$shell_mode" ]; then
  BROKER_MODE=$shell_mode
  unset COMPOSE_PROFILES
fi
set +a

# The mode is left to `.env` and the shell rather than chosen here, so the
# applications come up in `testing` or `demo`, whichever they say. In
# `production` they cannot: each sends its mail to the catcher, which that mode
# does not run, and compose would refuse with an error that names a dependency,
# not the mode.
if [ "$BROKER_MODE" = production ]; then
  echo "BROKER_MODE is production, which runs no mail catcher, and every" >&2
  echo "application of the composition sends its mail there." >&2
  echo "Bring them up in demo or testing instead; a change of mode needs a reset:" >&2
  echo "  BROKER_MODE=demo pnpm apps:reset" >&2
  exit 1
fi

# The Broker-only stack and this one are one proxy and one port 8080 apart, so
# compose fails to bind rather than explaining itself. Said here instead.
if [ -n "$(docker compose -f compose.yaml ps --status running --quiet 2>/dev/null)" ]; then
  echo "The Broker-only stack is up, and it holds port 8080." >&2
  echo "Bring it down first: \`docker compose down\` keeps its data," >&2
  echo "\`pnpm broker:down\` throws it away." >&2
  exit 1
fi

echo "== the applications, at their federation branch"
./scripts/checkout-apps.sh

echo
echo "== the composition"
[ "$#" -gt 0 ] || set -- --build
compose up -d --wait "$@"

# The migration and the seed of one application. `migrate` runs every time and
# does nothing when there is nothing to apply; the seed runs only when the
# application holds no accounts at all.
seed() {
  app=$1
  accounts=$(
    compose exec -T "$app" python manage.py shell -c \
      'from django.contrib.auth import get_user_model; print(get_user_model().objects.count())' |
      tr -d '\r' | tail -n 1
  )

  case "$accounts" in
    '' | *[!0-9]*)
      echo "$app: could not read the account count ('$accounts'), not seeding"
      return 1
      ;;
    0)
      echo "$app: seeding"
      compose exec -T "$app" python manage.py seed_local
      ;;
    *)
      echo "$app: $accounts accounts already, not seeding"
      ;;
  esac
}

migrate() {
  echo "$1: migrating"
  compose exec -T "$1" python manage.py migrate --noinput >/dev/null
}

# What this run could not do, reported at the end rather than by stopping:
# the addresses below are what somebody came for, and a seed that could not be
# read is worth less than knowing whether the composition answers at all.
failed=0

echo
echo "== the data each application existed with before the pilot"
for service in lostatnight geonity-api openred-api; do
  if migrate "$service"; then
    seed "$service" || failed=1
  else
    # Seeding a database the migration could not finish would fail for a
    # reason that says nothing, so it is skipped and this is what is reported.
    echo "$service: migration failed, not seeding"
    failed=1
  fi
done

# What a browser would get, asked for the way a browser asks: by hostname,
# through the proxy. A 502 means that application is not up; a 400 usually
# means it refused the hostname, which is the one failure this composition's
# shape exists to surface early.
echo
echo "== every address, read back through the proxy"
check() {
  # `-w '%{http_code}'` prints 000 of its own accord when the connection never
  # happened, and curl exits non-zero as well — so a fallback that echoed 000
  # too would make `000000`, which matches nothing below and reads as ok. This
  # one only covers curl failing to run at all.
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$1") || code=${code:-000}
  case "$code" in
    000 | 400 | 502 | 503) failed=1; verdict="FAILED" ;;
    *) verdict="ok" ;;
  esac
  printf '%-7s %s  %s\n' "$verdict" "$code" "$1"
}

check "$BROKER_ISSUER/.well-known/openid-configuration"
check "$LOSTATNIGHT_BASE_URL/"
check "$GEONITY_API_BASE_URL/admin/login/"
check "$GEONITY_WEB_BASE_URL/"
check "$GEONITY_ADMIN_BASE_URL/"
check "$OPENRED_API_BASE_URL/admin/login/"
check "$OPENRED_WEB_BASE_URL/"
check "$MAIL_BASE_URL/"

echo
echo "The Broker's admin console: ${BROKER_ISSUER%/realms/*}/admin/ (admin / admin)"
echo "Every seeded account's password is printed by the seed above."
echo "Mail: $MAIL_BASE_URL — nothing in the composition can reach a real address."
echo
echo "Logs: pnpm apps:logs <service>.  Down, keeping the data: pnpm apps:down."

exit "$failed"
