# Brokered Apps close their own registration and keep their own sign-in

Each Brokered App removes its own registration path and sends new people to the Broker, while
keeping its existing sign-in working **indefinitely** for accounts that already exist. There is no
sunset date, and the pilot does not promise to remove it.

The reason is arithmetic. If an application keeps taking new registrations of its own, the pilot ends
with exactly as many password stores as it started with, plus one more in the Broker. Closing
registration is the only part of the integration that makes the number go down.

## Considered Options

- **Keep application registration open alongside the Broker.** Rejected: the pilot could then not
  honestly claim to reduce the foundation's exposure, which is one of the things it exists to show.
- **Migrate the existing accounts now and close local sign-in too.** Rejected: migration is out of
  the pilot, and breaking what people already rely on while the pilot is still being evaluated is
  the fastest way to have it judged on the wrong thing.

## Consequences

This is a change to each application **beyond the authentication hook**, which the spec had promised
would be the only change. The amended promise is "the authentication hook and the registration link".
It is one link, but it has to be asked for rather than assumed, and the spec says so.

**The closure reaches the web front end, not the API endpoint.** Two of the pilot's applications are a
Django API serving both a React front end and a Flutter client, and mobile is out of the pilot. So the
registration *link* closes while the registration *endpoint* stays alive for as long as a mobile client
depends on it. The honest consequence is that exposure falls on the web and not on mobile, and this ADR
promises exactly that much and no more. Mobile closes when mobile enters scope.

A public client with PKCE is already the shape a Flutter client needs, so **nothing in the Broker has to
change** to serve one — only a redirect URI for the application's own scheme. That is why working the
integration out once, in a single application, is worth doing even though mobile is out of scope: the
cost is a redirect URI and an example, and the value is a reference for the teams who will not be in the
room when they need it.

Local sign-in with no sunset is an acceptable **end state**, not a temporary concession. If the
migration never happens, two ways in coexist forever and nothing is broken — which is also what makes
it safe to defer the migration decision for as long as it takes.

A person who already had an account and signs in through the Broker instead gets a **separate**
Person, with none of their old contributions. The applications have to say so at the point of choice,
because the alternative is somebody discovering it afterwards.
