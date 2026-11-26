# Brokered Apps close their own registration and keep their own sign-in

Each Brokered App removes its own registration path and sends new people to the Broker, while
keeping its existing sign-in working **indefinitely** for accounts that already exist. There is no
sunset date, and no phase of this work promises to remove it.

The reason is arithmetic. If an application keeps taking new registrations of its own, the foundation
ends with exactly as many password stores as it started with, plus one more in the Broker. Closing
registration is the only part of the integration that makes the number go down.

## Considered Options

- **Keep application registration open alongside the Broker.** Rejected: the project could then not
  honestly claim to reduce the foundation's exposure, which is one of the things it exists to show.
- **Migrate the existing accounts now and close local sign-in too.** Rejected: migration is out of
  scope, and breaking what people already rely on while the Broker is being rolled out is
  the fastest way to have it judged on the wrong thing.

## Consequences

This is a change to each application **beyond the authentication hook**, which the spec had promised
would be the only change. The amended promise is "the authentication hook and the registration link".
It is one link, but it has to be asked for rather than assumed, and the spec says so.

**The closure reaches the web front end, not the API endpoint.** Two of the integrated applications are a
Django API serving both a React front end and a Flutter client, and mobile is out of scope. So the
registration *link* closes while the registration *endpoint* stays alive for as long as a mobile client
depends on it. The honest consequence is that exposure falls on the web and not on mobile, and this ADR
promises exactly that much and no more. Mobile closes when mobile enters scope.

**Which client shape a native app takes depends on its backend, not on being mobile.** An application
whose API already authenticates its users, as Geonity's does, uses the split flow: the client starts the
code flow with PKCE and receives the code, and the API redeems it with the secret, so the client is
confidential and the secret never reaches the phone. An application with no such backend uses a public
client with PKCE. The Broker serves both already, so **nothing in it has to change** for a Flutter
client: only a redirect URI for the application's own scheme. With the split flow the application pays
one more thing: its API redeems with one redirect URI, and has to accept the mobile one as well. That is
why working the integration out once, in a single application, is worth doing even though mobile is out
of scope: the cost is a redirect URI and an example, and the value is a reference for the teams who will
not be in the room when they need it.

Local sign-in with no sunset is an acceptable **end state**, not a temporary concession. If the
migration never happens, two ways in coexist forever and nothing is broken — which is also what makes
it safe to defer the migration decision for as long as it takes.

A person who already had an account and signs in through the Broker instead is **refused** wherever
the application holds one account per address, as `django-allauth` does by default and Geonity keeps.
Nobody ends up with a second, empty account they take for their own. Only someone arriving with an
address the application does not hold gets a separate Person, with none of their old contributions. The
applications have to say so at the point of choice, in the order it happens, because the alternative is
somebody discovering it afterwards.

Making the separate account anyway means storing it without its address or under a mangled one. Both
break password reset and mail, and both are hand-written code in the application (ADR-0016).

The cost: someone with an existing account cannot use the Broker at that application until migration
links the two. ADR-0018 holds what that linking is, and no application has enabled it.

## Amended on 2026-11-20

Geonity's integration (issue #31) rewrote two paragraphs above. The mobile paragraph assumed a public
client; which shape applies depends on whether the application's API redeems the code, and Geonity's
does. An existing account holder signing in through the Broker got a separate Person; where the
application holds one account per address, they are refused.
