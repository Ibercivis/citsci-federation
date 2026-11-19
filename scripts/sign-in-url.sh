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
# This exists because no application has a sign-in button yet (`issue #30`,
# `#31`, `#94`), and the Broker's half is worth exercising before they do. The
# redirect back lands on a path nothing serves yet, so the browser ends on that
# application's 404 with `code=` in the address bar — which is the Broker
# having done everything that is its to do. Delete this script once every
# application has its own button.
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
  lostatnight) client=$LOSTATNIGHT_CLIENT_ID; base=$LOSTATNIGHT_BASE_URL ;;
  # Geonity and OpenRed register their API as the client: the callback is a
  # path on the Django side of each, not on the front end.
  geonity)     client=$GEONITY_CLIENT_ID;     base=$GEONITY_API_BASE_URL ;;
  openred)     client=$OPENRED_CLIENT_ID;     base=$OPENRED_API_BASE_URL ;;
  *)
    echo "No such application: $app" >&2
    echo "One of: lostatnight, geonity, openred" >&2
    exit 2
    ;;
esac

# PKCE, which every client in the realm requires, and a nonce, which the Broker
# requires of a request carrying `openid`. The verifier is thrown away with
# this shell: nothing below redeems the code it protects.
verifier=$(openssl rand -hex 32)
challenge=$(
  printf %s "$verifier" | openssl dgst -binary -sha256 | openssl base64 -A |
    tr '+/' '-_' | tr -d '='
)

# `:` and `/` are legal in a query value, but an address bar is not the only
# thing that reads this URL, and a redirect URI that survives a copy-paste
# through a chat window is worth two sed expressions.
redirect=$(printf %s "$base/accounts/oidc/callback" | sed 's|:|%3A|g; s|/|%2F|g')

printf '%s/protocol/openid-connect/auth?client_id=%s&response_type=code&scope=openid&nonce=%s&code_challenge=%s&code_challenge_method=S256&redirect_uri=%s\n' \
  "$BROKER_ISSUER" "$client" "$(openssl rand -hex 8)" "$challenge" "$redirect"
