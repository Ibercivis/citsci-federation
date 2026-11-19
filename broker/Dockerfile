# The Broker's OpenID provider: Keycloak at a pinned version, plus the two
# extensions this repository adds to it — the Person Identifier mapper, and the
# condition that refuses to join an address nobody verified — and the realm it
# imports.
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

FROM maven:3.9.16-eclipse-temurin-21 AS mapper
ARG DEPENDENCY_PLUGIN
WORKDIR /build
# The pom first, so that `go-offline` resolves this module's dependencies
# before the source exists and a change to the Java does not re-resolve them.
# What holds them is the cache mount rather than the layer, and both Maven
# stages mount the same one: they ask Central for the same four Keycloak
# artifacts, and a runner has no layer cache to reuse, so without it every
# build fetches each artifact twice.
#
# `sharing=locked` and not the default `shared`, which costs wall clock: the
# two stages build in parallel, so the second waits for the first instead of
# downloading beside it. It is not an optimisation. Two Maven processes
# writing one local repository at the same time is the thing Maven does not
# promise to survive, and a half-written artifact in a cache is a failure that
# outlives the build that caused it.
COPY person-identifier/pom.xml .
RUN --mount=type=cache,target=/root/.m2,sharing=locked \
    mvn --batch-mode --quiet "${DEPENDENCY_PLUGIN}:go-offline"
COPY person-identifier/src ./src
RUN --mount=type=cache,target=/root/.m2,sharing=locked mvn --batch-mode --quiet package

FROM maven:3.9.16-eclipse-temurin-21 AS condition
ARG DEPENDENCY_PLUGIN
WORKDIR /build
COPY verified-email/pom.xml .
RUN --mount=type=cache,target=/root/.m2,sharing=locked \
    mvn --batch-mode --quiet "${DEPENDENCY_PLUGIN}:go-offline"
COPY verified-email/src ./src
RUN --mount=type=cache,target=/root/.m2,sharing=locked mvn --batch-mode --quiet package

# The realm Keycloak imports, derived from the declaration in `realm/` for one
# mode: `testing` or `production`, from BROKER_MODE in `.env`. There is no
# default, and `derive.ts` refuses anything else, so an image cannot be built
# without saying which Broker it is. The same Node as the Mock Identity
# Source's, which runs TypeScript by stripping the types. MOCK_ISSUER is
# written into the testing layer here, and a testing build without it fails.
FROM node:24.22.3-alpine AS realm
ARG BROKER_MODE
ARG MOCK_ISSUER
WORKDIR /realm
COPY realm/ ./
RUN node derive.ts "$BROKER_MODE" "$MOCK_ISSUER" > realm-citsci.json

# The version is pinned and does not move on its own. Two reasons:
#
# 1. `verified-email/` reads the `email_verified` the identity provider sent
#    out of a Keycloak field that no public API promises. A version that
#    renames or moves it leaves our condition finding nothing — and finding
#    nothing means "nobody verified this address", so the Broker would start
#    refusing sign-ins it ought to allow. It breaks safe, and quietly.
# 2. Whether an address counts as verified is decided by this version, and a
#    security property of the design rests on that answer (ADR-0004).
#
# An upgrade is therefore: change this line, rebuild, run `pnpm test`, and read
# what it says before trusting it. Both poms compile against the same version,
# so they move with it or not at all.
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
