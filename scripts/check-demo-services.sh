#!/bin/sh
# What compose starts beside the realm in `demo`, which `compose.yaml` declares
# as profiles and nothing else asserts.
#
# A demo Broker imports the realm the base declaration already covers, so what
# is left to check is the services: the mail catcher the Brokered Composition's
# applications send to, and no Mock Identity Source, because every Identity a
# demo shows has to come from a real source.
#
# `docker compose config` interpolates `.env` and resolves the profiles without
# starting anything, so this reads the configuration compose would act on.
# `BROKER_MODE` is set here rather than in `.env` because compose lets the
# environment override that file, which is how a mode is chosen for one command.
set -eu

root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"

services=$(BROKER_MODE=demo docker compose config --services)

failed=0

if ! echo "$services" | grep -qx mailpit; then
  echo "check-demo-services: demo starts no mail catcher, and every" >&2
  echo "application of the composition sends its mail there." >&2
  failed=1
fi

if echo "$services" | grep -qx mock-source; then
  echo "check-demo-services: demo starts the Mock Identity Source, which is" >&2
  echo "the one thing a demo must not show." >&2
  failed=1
fi

if [ "$failed" -ne 0 ]; then
  echo "The services demo asks compose for:" >&2
  echo "$services" | sed 's/^/  /' >&2
  exit 1
fi

echo "check-demo-services: demo starts the mail catcher and no Mock Identity Source"
