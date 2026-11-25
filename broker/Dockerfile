# The Broker's OpenID provider: Keycloak at a pinned version, plus the two
# extensions this repository adds to it — the Person Identifier mapper, and the
# rules that keep an address nobody verified from reaching a Person — and the
# realm it imports.
#
# Both are compiled here rather than committed: the repository carries no
# binaries, and building inside a Maven container means nobody needs Java on
# their machine to work on it.
#
# One stage each, because one jar each: either can be lifted out of this
# repository on its own.

# How long Maven waits out a Central that is refusing it, which is the failure
# this build keeps having (`issue #183`). The resolver retries a 429 by
# itself, and the defaults are three retries at 5 s, 10 s, 15 s: the interval
# grows by multiplying it by the attempt, so the whole of Maven's patience is
# 30 seconds, and Central's throttle outlasts it: the `tests` job's own retry
# comment in `.github/workflows/ci.yaml` says how that is known. Six retries at
# 10 s ask for 10+20+30+40+50+60 instead: 210 seconds, spent where the refusal
# happens rather than in a rebuilt image.
#
# The prefix is the half of this that cannot be read off the documentation.
# `aether.transport.http.` is resolver 2.x, which arrives with Maven 4; this
# image is Maven 3.9 on resolver 1.9, which reads `aether.connector.http.` and
# ignores — in silence, leaving the 30 seconds in place — every property it
# does not know. Both spellings were put to a local server that refuses
# everything it is asked for, and `PR #207` carries what each of them did
# there — the wrong one changed nothing at all.
#
# `intervalMax` is deliberately not set, and it is the trap of the three. It is
# not a cap on the wait: once the next interval would pass it, the resolver
# stops retrying at all. The longest interval asked for above is 60 s and the
# default ceiling is 300 s, so every value worth typing is either inert or a
# cut — the ticket's own 120000 would have done nothing, and 30000 would have
# thrown away three of the six retries.
ARG MAVEN_RETRY="-Daether.connector.http.retryHandler.count=6 -Daether.connector.http.retryHandler.interval=10000"

# Both Maven stages copy `maven-settings.xml` into the user settings, so that
# they resolve from Central alone. The file says why.

FROM maven:3.9-eclipse-temurin-26 AS mapper
ARG MAVEN_RETRY
# Both `mvn` lines below read it, so neither carries the flags itself.
ENV MAVEN_ARGS="${MAVEN_RETRY}"
WORKDIR /build
# The pom alone first, and `package` run on it before any source exists. That
# is the layer a Java-only edit reuses, and `package` is what warms it,
# because `package` is what follows: the same lifecycle resolves the same
# plugins and the same classpath. The second line then compiles against a
# repository that is already complete, which `PR #207` measures by running it
# with `--offline`.
#
# `dependency:go-offline` ran here until `issue #183` counted it, and it was
# over-inclusive and under-inclusive at once: it fetched a few hundred
# artifacts `package` never asks for, and still left `package` resolving from
# Central. The one thing it is named for, leaving the repository complete, is
# the thing it did not do. `PR #207` has the counts, for it and for
# `dependency:resolve`, which was measured at the same time and is no better.
#
# No `mvn` line here names a plugin by its `dependency:`-style prefix, and the
# next one added must not either: a prefix is resolved by two metadata requests
# to Central, and that lookup failed on its own twice in one day (`issue
# #114`). `go-offline` was the only goal that needed a plugin named at all, so
# its coordinate left with it.
#
# A cache mount shared by the two Maven stages was tried and reversed
# (`issue #116`). It saved one of the two downloads, and for that it took the
# dependencies out of the layer and serialised the stages on the lock that
# keeps two Maven processes out of one local repository. What it could not do
# is prevent the resolution failure it was aimed at, which lands on the first
# download into an empty cache — and in CI the cache is empty every run.
#
# The warm-up runs loud, so that a refusal from Central says which request it
# refused. `--quiet` keeps an HTTP status, which the `[ERROR]` summary carries
# either way, and drops the `Downloading from central:` line that names the
# request. The second line keeps `--quiet` and gives up nothing for it: it
# resolves from a complete repository, so it has no download to report.
COPY maven-settings.xml /root/.m2/settings.xml
COPY person-identifier/pom.xml .
RUN mvn --batch-mode package
COPY person-identifier/src ./src
RUN mvn --batch-mode --quiet package

FROM maven:3.9-eclipse-temurin-26 AS condition
ARG MAVEN_RETRY
ENV MAVEN_ARGS="${MAVEN_RETRY}"
WORKDIR /build
COPY maven-settings.xml /root/.m2/settings.xml
COPY verified-email/pom.xml .
RUN mvn --batch-mode package
COPY verified-email/src ./src
RUN mvn --batch-mode --quiet package

# The realm Keycloak imports, derived from the declaration in `realm/` for one
# mode: `testing`, `production` or `demo`, from BROKER_MODE in `.env`. There is no
# default, and `derive.ts` refuses anything else, so an image cannot be built
# without saying which Broker it is. The same Node as the Mock Identity
# Source's, which runs TypeScript by stripping the types.
# MOCK_IDENTITY_SOURCE_ISSUER is written into the testing layer here, and a
# testing build without it fails.
FROM node:26.13.1-alpine AS realm
ARG BROKER_MODE
ARG MOCK_IDENTITY_SOURCE_ISSUER
WORKDIR /realm
COPY realm/ ./
RUN node derive.ts "$BROKER_MODE" "$MOCK_IDENTITY_SOURCE_ISSUER" > realm-citsci.json

# The version is pinned and does not move on its own. Two reasons:
#
# 1. `verified-email/` reads the `email_verified` the identity provider sent,
#    and the note saying a Person was just registered, out of Keycloak fields
#    that no public API promises. A version that renamed or moved the first
#    leaves our rules finding nothing — "nobody verified this address", so the
#    Broker refuses sign-ins it ought to allow, which breaks safe and quietly.
#    The second breaks the other way: finding nothing there means no address is
#    taken off anybody.
# 2. Whether an address counts as verified is decided by this version, and a
#    security property of the design rests on that answer (ADR-0004).
#
# An upgrade is therefore: change this line, rebuild, run `pnpm test`, and read
# what it says before trusting it. Both poms compile against the same version,
# so they move with it or not at all.
#
# Downwards there is a floor: 26.8.0. Below it, Keycloak reads a brokered
# address and the verdict on it out of two different responses, so
# `verified-email/` finds no verdict for whichever address arrived. Everyone
# then counts as unaffirmed, and a Person their own source verified is asked
# for an address again. Measured on 26.7.1 in
# `docs/notes/2026-11-23-trust-email-and-userinfo.md`.
FROM quay.io/keycloak/keycloak:26.8.1
COPY --from=mapper /build/target/person-identifier.jar /opt/keycloak/providers/
COPY --from=condition /build/target/verified-email.jar /opt/keycloak/providers/
# Where `--import-realm` looks. The realm is part of the image rather than
# mounted beside it, so the image is the whole Broker, declaration included.
COPY --from=realm /realm/realm-citsci.json /opt/keycloak/data/import/
# Fixes the build-time options into the image, so both providers are installed
# here and `start` does not have to rebuild on every boot.
#
# `update-email` is on by default in this version and named anyway: it is
# what makes a new address count only once it is confirmed, and an upgrade
# that turned it off by default must not turn that off with it (ADR-0004).
RUN /opt/keycloak/bin/kc.sh build --db=postgres --health-enabled=true --features=update-email
