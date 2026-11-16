# The Broker's OpenID provider: Keycloak at a pinned version, with the one
# extension this repository adds to it, the Person Identifier mapper.
#
# The mapper is compiled here rather than committed: the repository carries no
# binaries, and building inside a Maven container means nobody needs Java on
# their machine to work on it.

FROM maven:3.9.16-eclipse-temurin-21 AS mapper
WORKDIR /build
# The pom first, so that the dependency download is a cached layer that a
# change to the Java source does not invalidate.
COPY person-identifier/pom.xml .
RUN mvn --batch-mode --quiet dependency:go-offline
COPY person-identifier/src ./src
RUN mvn --batch-mode --quiet package

# Pinned, and pinned because a security property of the design rests on how
# this version treats a verified email address (ADR-0004). It is not allowed to
# move on its own, and the mapper's pom.xml compiles against the same version:
# the two move together or not at all.
FROM quay.io/keycloak/keycloak:26.8.1
COPY --from=mapper /build/target/person-identifier.jar /opt/keycloak/providers/
# Fixes the build-time options into the image, so the provider is installed
# here and `start` does not have to rebuild on every boot.
RUN /opt/keycloak/bin/kc.sh build --db=postgres --health-enabled=true
