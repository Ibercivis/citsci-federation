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

FROM maven:3.9.16-eclipse-temurin-21 AS mapper
WORKDIR /build
# The pom first, so that the dependency download is a cached layer that a
# change to the Java source does not invalidate.
COPY person-identifier/pom.xml .
RUN mvn --batch-mode --quiet dependency:go-offline
COPY person-identifier/src ./src
RUN mvn --batch-mode --quiet package

FROM maven:3.9.16-eclipse-temurin-21 AS condition
WORKDIR /build
COPY verified-email/pom.xml .
RUN mvn --batch-mode --quiet dependency:go-offline
COPY verified-email/src ./src
RUN mvn --batch-mode --quiet package

# The realm Keycloak imports, derived from the declaration in `realm/`. The
# same Node as the Mock Identity Source's, which runs TypeScript by stripping
# the types.
FROM node:24.22.3-alpine AS realm
WORKDIR /realm
COPY realm/ ./
RUN node derive.ts > realm-citsci.json

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
RUN /opt/keycloak/bin/kc.sh build --db=postgres --health-enabled=true
