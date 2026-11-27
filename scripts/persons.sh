#!/bin/sh
# Every Person the Broker holds, one row each, with the Identity Sources they
# can arrive through.
#
#   pnpm persons           # once
#   pnpm persons --watch   # redraws until Ctrl-C
#
# This reads the Broker's database because nothing else can: a Brokered App is
# told a Person Identifier and nothing more (ADR-0002), and the account console
# shows one Person — the one looking at it. What a demo has to make visible is
# the thing in between, two Identities resolving to one Person, and that lives
# only here.
#
# `--watch` is for projecting beside a browser: the row appears as somebody
# signs in, and changes as they answer the mail. It is what makes "nothing is
# written until the link is followed" something a room can see rather than
# something they are told (`docs/trying-it-by-hand.md`).
#
# Delete it when a screen of ours shows a Person beside their Identities, or
# when the demo it was written for has been given for the last time.
set -eu

# Whichever stack is up. The Brokered Composition and the Broker alone are two
# compose projects, and this is the one container both of them have.
container=$(docker ps --filter label=com.docker.compose.service=broker-db \
  --format '{{.Names}}' | head -n 1)

if [ -z "$container" ]; then
  echo "persons: nothing named broker-db is running. \`pnpm apps:up\`?" >&2
  exit 1
fi

# `pending` is what the Broker is still waiting for before this Person may
# reach an application; `passwords` is how many credentials it holds for them,
# which is zero for everybody who arrived through an Identity Source.
query="
  SELECT u.id || '@ibercivis.es' AS person_identifier,
         coalesce(u.email, '(withheld)') AS address,
         u.email_verified AS affirmed,
         coalesce((SELECT string_agg(f.identity_provider, ' + ' ORDER BY 1)
                     FROM federated_identity f WHERE f.user_id = u.id), '-') AS identities,
         (SELECT count(*) FROM credential c WHERE c.user_id = u.id) AS passwords,
         coalesce((SELECT string_agg(r.required_action, ', ' ORDER BY 1)
                     FROM user_required_action r WHERE r.user_id = u.id), '-') AS pending
    FROM user_entity u JOIN realm rl ON rl.id = u.realm_id
   WHERE rl.name = 'citsci'
   ORDER BY u.created_timestamp;"

persons() {
  docker exec -i "$container" psql -U keycloak -d keycloak -P pager=off -c "$query"
}

if [ "${1-}" = "--watch" ]; then
  # Home, erase, drop the scrollback, written by hand rather than with `clear`:
  # that one needs terminfo and fails where TERM is unset, which `set -e` would
  # turn into the loop ending on its first pass.
  while true; do
    printf '\033[H\033[2J\033[3J'
    date '+%H:%M:%S'
    persons
    sleep 2
  done
fi

persons
