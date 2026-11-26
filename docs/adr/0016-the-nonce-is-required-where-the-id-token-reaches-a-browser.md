# The nonce is required where the ID token reaches a browser, and nowhere else

The realm requires a `nonce` of **public** clients only. A confidential client — a server-rendered
Brokered App that holds a secret and fetches its own tokens — signs people in without one.
`pkce-enforcer` and `reject-implicit-grant` keep applying to every client, whatever its own
settings say.

**What a nonce does.** The application puts a random value in the authorization request and keeps
it in the session; the Broker copies it into the ID token; the application compares the two and
throws the token away if they differ. It binds *that* ID token to *that* sign-in.

**Where the binding is worth having.** Where a browser can see the ID token. A public client has no
secret to hold, so its tokens are handled where a script can reach them, and an ID token obtained
elsewhere could be passed off as the result of this sign-in. A confidential client redeems its code
at the token endpoint itself, over a channel no browser is on, and the ID token never passes
through one. There is nothing for the nonce to bind.

**What binds the response for the clients we exempt.** `state`, which the libraries do send and do
verify before anything else — that is the CSRF binding Keycloak's own `secure-session` executor
names as the thing it is for ("lacks 'nonce' parameter in OIDC flow or 'state' parameter in OAuth2
grant"). The executor insists on the OpenID Connect parameter and cannot see that the OAuth 2.0 one
is already in use and already checked.

**What made this a decision rather than a preference.** No release of `django-allauth` sends a
nonce for OpenID Connect — not 65.0.2, not 65.15.0 — and it offers no hook that would check one,
because it does not pass a nonce into its ID token validation. Requiring it of every client
therefore refuses every Django Brokered App outright, and the only way to satisfy the requirement
is hand-written OIDC glue in somebody else's production application: security-sensitive code,
written once per application, maintained by people who did not ask for it, verifying nothing.
That is a cost on every future integration, paid for a protection the client shape cannot use. The
spec promises that adding a Brokered App is adding declared configuration, and this is what keeping
that promise costs.

## Considered Options

- **A nonce from every client, as the realm required until now.** Rejected on the above: it is
  unsatisfiable by the libraries these applications are built on, and buys nothing where it is
  satisfiable by hand.
- **No nonce from anybody.** Rejected: a single-page application is in scope among the integrated
  applications, its ID token does reach a browser, and the requirement costs such a client nothing
  — every browser OIDC library sends a nonce.
- **A nonce from every client, satisfied by code we write in each application.** Rejected: the
  nonce would be sent and never verified, because the library takes the identity from the token
  without consulting it. A requirement met by a parameter nobody checks is worse than no
  requirement, because it reads as a protection in the configuration.
- **Keeping the requirement and waiting for `django-allauth` to send a nonce.** Rejected as a
  blocker: an upstream change on nobody's timetable cannot gate the integrations. Proposing it
  upstream stays worth doing, and would let this ADR be revisited.

## Consequences

**Keycloak decides it per request, by client access type.** The `secure-session` executor moves
into a profile of its own, applied by a policy whose condition is `client-access-type: public`.
Nothing is enforced by a per-client setting that the next registration could forget.

**The first public client in the realm is held to it without anyone acting.** That is the point of
the condition: the rule follows the shape rather than the name. It also means a client turned from
confidential to public starts being refused without a nonce, which is correct and will look like a
regression to whoever does it.

**Two cases in `tests/hardening.test.ts` carry it.** The refusal, driven through the public client
and the misconfigured one; and — new, and the reason this ADR exists — a request shaped exactly as
a mainstream library sends one, with no nonce, which is **accepted**. A hardening suite that only
asserts refusals cannot tell that what is refused is unsafe requests rather than ordinary ones.

**The spec's protocol line now says of whom.** `nonce` required, of the clients whose ID token
reaches a browser. The six-move sign-in in the orientation doc stops implying that every
application reads the ID token and verifies its signature: a server-rendered one may take the
identity from `userinfo` over the back channel, and `Ibercivis/gdalface` does.

**An application that does read the ID token still should verify it**, and the JWKS stays published
for exactly that. What changes is that the Broker no longer requires a parameter from an
application that has no use for it.
