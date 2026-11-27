#!/bin/sh
# Prints the URL a browser is sent to when a Brokered App asks the Broker to
# sign somebody in. Paste it in a browser and the Broker's own sign-in happens:
# the login page, an Identity Source if you pick one, the consent screen naming
# the application, and the redirect back carrying an authorization code.
#
#   scripts/sign-in-url.sh              # LostAtNight
#   scripts/sign-in-url.sh geonity      # or openred
#   open "$(pnpm -s sign-in-url)"       # macOS, straight to the browser
#
# This exists because not every application has a sign-in button yet
# (`issue #30`), and the Broker's half is worth exercising before they do. The
# redirect back lands on a page that cannot finish the sign-in, so the browser
# ends there with `code=` in the address bar — which is the Broker having done
# everything that is its to do. Delete this script once
# every application has its own button.
#
# Nothing here redeems the code: that needs the client secret, and a URL in an
# address bar is not where a secret goes. `pnpm test` redeems codes, over the
# protocol, with no browser in it.

set -eu

root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"

set -a
# shellcheck disable=SC1091
. ./.env
set +a

app=${1:-lostatnight}
case "$app" in
  lostatnight) client=$LOSTATNIGHT_CLIENT_ID; callback=$LOSTATNIGHT_BASE_URL/accounts/oidc/callback ;;
  # Geonity's callback is a page of its web app, which hands the code to its
  # API (`issue #31`). Reached from here, that page has no sign-in of its own
  # to finish, so it says the sign-in did not work: the code in the address
  # bar is still the Broker's half, done.
  geonity)     client=$GEONITY_CLIENT_ID;     callback=$GEONITY_WEB_BASE_URL/auth/ibercivis/callback ;;
  # OpenRed's callback is a page of its React app, which hands the code to its
  # API (`issue #30`) — Geonity's shape again, and it answers the same way when
  # reached from here, with nothing of its own to finish.
  openred)     client=$OPENRED_CLIENT_ID;     callback=$OPENRED_WEB_BASE_URL/auth/ibercivis/callback ;;
  *)
    echo "No such application: $app" >&2
    echo "One of: lostatnight, geonity, openred" >&2
    exit 2
    ;;
esac

# PKCE, which every client in the realm requires, and a nonce. Which clients the
# Broker refuses a nonce-less request from is a client policy, and that policy
# has already moved once; sending a nonce is never wrong, so this sends one and
# does not track it. The verifier is thrown away with this shell: nothing below
# redeems the code it protects.
verifier=$(openssl rand -hex 32)
challenge=$(
  printf %s "$verifier" | openssl dgst -binary -sha256 | openssl base64 -A |
    tr '+/' '-_' | tr -d '='
)

# `:` and `/` are legal in a query value, but an address bar is not the only
# thing that reads this URL, and a redirect URI that survives a copy-paste
# through a chat window is worth two sed expressions.
redirect=$(printf %s "$callback" | sed 's|:|%3A|g; s|/|%2F|g')

printf '%s/protocol/openid-connect/auth?client_id=%s&response_type=code&scope=openid&nonce=%s&code_challenge=%s&code_challenge_method=S256&redirect_uri=%s\n' \
  "$BROKER_ISSUER" "$client" "$(openssl rand -hex 8)" "$challenge" "$redirect"
