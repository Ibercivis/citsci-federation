# The Pilot Composition's reverse proxy is Caddy, not the nginx production runs

The reverse proxy ADR-0001 puts in front of the Broker in every environment is **Caddy**, in the
Pilot Composition and nowhere else. The machines that serve the foundation's applications today are
fronted by nginx, every virtual host of them, and this decision does not propose changing that. If
the Pilot Composition is ever published at a public address — the decision ADR-0009 defers — the
front door there is nginx, and the fifteen lines of `proxy/Caddyfile` become a virtual host.

**ADR-0001 asks for parity of form, not parity of software.** The form is the hostname a Federated
App is told to trust, the `X-Forwarded-*` headers the Broker is configured to read, the place TLS is
terminated, and the absence of any route that reaches the Broker without passing through the proxy.
That shape is identical under either tool, and the failures the ADR exists to surface early —
cookies that do not travel, a `redirect_uri` that does not match, CORS, HTTP where HTTPS is assumed
— are caused by the shape rather than by the proxy that imposes it.

What decides it, then, is the cost of the file. The proxy in the Pilot Composition holds no policy:
it routes one hostname to one container, answers `/healthz` so that `compose up --wait` can tell the
proxy apart from what is behind it, and adds the forwarded headers without being told to. The same
thing in nginx is a longer file in which every header is set by hand — set one wrong and the
Broker publishes an issuer nobody can use, with an error that names nothing. Caddy also obtains
certificates on its own, which costs nothing today (the pilot runs on HTTP locally and its
configured issuer says so out loud) and is the cheapest answer available the day somebody wants to
show the pilot over HTTPS.

## Considered Options

- **nginx, the tool the team already operates.** The strongest case against this decision, and it
  came close: one fewer tool in the house, a configuration language the team can already read, and a
  file that looks liftable into a production virtual host. Rejected because the lift is not actually
  free — local HTTP and production TLS differ, so the file is edited either way — while the cost
  of the longer file and the hand-written headers is paid in the composition every day.
- **Traefik, configured from container labels.** Rejected. It earns its keep when services come and
  go and the proxy has to discover them; the Pilot Composition's services are a short, fixed,
  hand-written list. It would spread the proxy's configuration across every service's labels, which
  is more places to look rather than fewer.
- **No proxy locally.** Not reopened here. ADR-0001 settled it, and Keycloak publishes no port of
  its own precisely so that the question cannot be answered by accident.

## Consequences

**One tool in the house that nothing in production uses.** Accepted, and bounded by what the Pilot
Composition is: disposable (ADR-0009), configured by a single file, and never the way anything is
deployed for real. Nobody has to learn Caddy in order to deploy anything, and nobody is on call for
it.

**The day the proxy holds policy, this decision is wrong.** Rate limits, address allowlists,
anything decided at the edge: policy living in a tool only the pilot runs is a real cost rather than
a notional one, and that is the trigger to revisit this. Today the file holds none of it, terminates
no TLS, and has the admin API switched off so that nothing but the file can configure it.

**Reversing it costs one file.** This is recorded not because it is expensive to change but because
a reader who knows the estate will ask why the one unfamiliar thing is here, and because "parity of
form" in ADR-0001 reads easily as "the same proxy everywhere" — a misreading under which this
decision looks like a breach of that one instead of an application of it.
