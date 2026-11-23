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

# `maven-dependency-plugin` by full coordinates and an exact version, never as
# the `dependency:` prefix. Resolving a prefix means downloading two metadata
# files from Central — one to learn which plugin the prefix names, one to pick
# its latest version — and that lookup is the only step of this build that has
# failed on its own, twice in one day, while the same image built in the same
# CI run. Naming the plugin completely removes both requests, and pins what
# was whatever Central called latest that morning (`issue #114`).
ARG DEPENDENCY_PLUGIN=org.apache.maven.plugins:maven-dependency-plugin:3.7.0

FROM maven:3.9-eclipse-temurin-26 AS mapper
ARG DEPENDENCY_PLUGIN
WORKDIR /build
# The pom first, so that `go-offline` resolves this module's dependencies
# before the source exists and a change to the Java does not re-resolve them.
# A cache mount shared by the two Maven stages was tried and reversed
# (`issue #116`). It saved one of the two downloads, and for that it took the
# dependencies out of the layer and serialised the stages on the lock that
# keeps two Maven processes out of one local repository. What it could not do
# is prevent the resolution failure it was aimed at, which lands on the first
# download into an empty cache — and in CI the cache is empty every run.
#
# `go-offline` runs loud, so that a refusal from Central says which request it
# refused. `--quiet` keeps an HTTP status, which the `[ERROR]` summary
# carries either way, and drops the `Downloading from central:` line that
# names the request.
#
# `package` keeps `--quiet`, and that is the weaker half of the decision:
# `go-offline` does not leave the repository complete, so `package` resolves
# from Central too. `docs/notes/2026-11-19-what-go-offline-leaves-for-package.md`
# has the counts.
COPY person-identifier/pom.xml .
RUN mvn --batch-mode "${DEPENDENCY_PLUGIN}:go-offline"
COPY person-identifier/src ./src
RUN mvn --batch-mode --quiet package

FROM maven:3.9-eclipse-temurin-26 AS condition
ARG DEPENDENCY_PLUGIN
WORKDIR /build
COPY verified-email/pom.xml .
RUN mvn --batch-mode "${DEPENDENCY_PLUGIN}:go-offline"
COPY verified-email/src ./src
RUN mvn --batch-mode --quiet package

# The realm Keycloak imports, derived from the declaration in `realm/` for one
# mode: `testing` or `production`, from BROKER_MODE in `.env`. There is no
# default, and `derive.ts` refuses anything else, so an image cannot be built
# without saying which Broker it is. The same Node as the Mock Identity
# Source's, which runs TypeScript by stripping the types. MOCK_ISSUER is
# written into the testing layer here, and a testing build without it fails.
FROM node:26.13.1-alpine AS realm
ARG BROKER_MODE
ARG MOCK_ISSUER
WORKDIR /realm
COPY realm/ ./
RUN node derive.ts "$BROKER_MODE" "$MOCK_ISSUER" > realm-citsci.json

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
