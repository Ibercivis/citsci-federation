<!-- Research note, not a decision. Read and measured 24 November 2026: `gdalface` at `a70f435`,
`citsci-api` at `24de7ac` and `Geonity` at `aede9ae`, each on `federation`; `django-allauth` 65.15.0
and `dj-rest-auth` 7.2.0 from PyPI; Keycloak at the tag of the pinned image
(`broker/Dockerfile:129`); and the live Broker of `pnpm broker:up`. -->

# What signing out costs, application by application

**Verdict.** Story 17 needs both halves — RP-initiated logout and back-channel logout — and neither
is available to a relying party at the versions both applications pin. `django-allauth` 65.15.0
implements RP-initiated logout only as an **OpenID Provider**
(`allauth/idp/oidc/internal/flows.py:7`); its relying-party OpenID Connect provider exposes two
URLs, `login/` and `login/callback/`
(`allauth/socialaccount/providers/openid_connect/urls.py`), and nothing else. `dj-rest-auth` 7.2.0's
`LogoutView` deletes a DRF token and knows nothing of a provider. So every logout path is written by
hand, per application.

ADR-0016's test does not discharge story 17, and the difference is worth stating: that rule weighs a
**rule of ours** against the bespoke code it would force, and story 17 is a story the spec commits
to, not a rule we may drop on cost. What the measurements below bear on is which shape of the build
is cheapest, and one of them moves work out of the applications and into this repository.

**Three things change what that build is.**

**The ID token cannot be kept by setting a flag.** `SOCIALACCOUNT_STORE_TOKENS` governs
`SocialToken`, and `SocialToken` has no field for an ID token: `token` is the access token,
`token_secret` the refresh token (`allauth/socialaccount/models.py:157`). Turning the setting on
stores no `id_token_hint`. The raw compact JWT exists for the length of one function call, as
`kwargs["response"]["id_token"]` inside `complete_login`
(`allauth/socialaccount/providers/oauth2/views.py:148`), and the OpenID Connect adapter keeps only
its decoded claims (`.../openid_connect/views.py:52`). An application that wants it must intercept
that call.

**`client_id` instead of `id_token_hint` cannot buy its way out of the confirmation page.**
RP-Initiated Logout 1.0 §2: *"the OP MUST ask the End-User this question if an `id_token_hint` was
not provided"*. It is a requirement on any conformant provider, not a Keycloak choice, and Keycloak
honours it unconditionally while a Broker session exists (`LogoutEndpoint.java:177`, and measured
below).

**The logout token's `sub` is not the Person Identifier.** Measured on the live Broker: the ID token
carried `sub = 1e05074f-…-d429832a91cd@ibercivis.es`, the logout token for the same sign-in carried
`sub = 1e05074f-…-d429832a91cd`. `DefaultTokenManager.initLogoutToken` sets the subject from
`user.getId()` and then applies only mappers implementing `LogoutTokenMapper`
(`services/.../jose/jws/DefaultTokenManager.java:371,377`); `PersonIdentifierMapper` implements four
interfaces and not that one. So no application can look up the arriving `sub`: what it stored is the
scoped form. `sid` is the only claim in the token an application can already match, and it costs one
realm attribute per client.

**Read on only if** you are writing the ADR for story 17, opening its build tickets, costing a
Brokered App's sign-out, deciding the realm's session lifetimes, or landing silent sign-in
(`issue #157`) at an application whose sign-out does not yet end the Broker session.

## What the realm permits today, and what it refuses

No client declares `backchannel.logout.url`, so the Broker POSTs nothing. None declares
`backchannel.logout.session.required`, and `isBackchannelLogoutSessionRequired()` is
`Boolean.parseBoolean(attribute)` (`OIDCAdvancedConfigWrapper.java:424`), so the default is `false`
and no `sid` is emitted — matching Back-Channel Logout 1.0 §2.2, where the metadata's default is
false. `frontchannelLogout` is `false` on every client.

One thing the realm file does not say is nevertheless true of the running Broker: the import writes
`post.logout.redirect.uris = "+"` on every client. `+` means *the client's `redirectUris`, plus any
listed* (`OIDCAdvancedConfigWrapper.java:503`), and an unset attribute falls back to the same list
(`:491`). So a post-logout redirect is already permitted — to the redirect URIs and nowhere else.
Measured against the live Broker, with no browser session:

| Request | Answer |
|---|---|
| `client_id=lostatnight`, `post_logout_redirect_uri` under `/accounts/oidc/` | 302 to it |
| `client_id=lostatnight`, `post_logout_redirect_uri` = the site root | 400, `Invalid redirect uri`, `LOGOUT_ERROR` in the log |

That is the realm-side cost of half 1: not "add a post-logout redirect URI" in the abstract, but a
declared one, because the only address each client already permits is a callback. Geonity's is
exactly `${GEONITY_WEB_BASE_URL}/auth/ibercivis/callback`, a page that expects a `code`.

The spec allows Keycloak's reuse of the redirect URIs: §3 forbids post-logout redirection without
`id_token_hint` *"unless the OP has other means of confirming the legitimacy"*, and a pre-registered
URI is that means.

## What the Broker sends, measured

With `backchannel.logout.url` pointed at a listener on the host and the attribute pair set by the
admin API — then removed, leaving the client byte-identical to its declared state:

| `backchannel.logout.session.required` | Logout token payload |
|---|---|
| absent | `aud`, `events`, `exp`, `iat`, `iss`, `jti`, `sub`, `typ: Logout` — **no `sid`** |
| `true` | the same plus `sid`, equal to the ID token's `sid` |

Header `typ` is `logout+jwt`. `exp` is `iat + 120`, which is
`DefaultTokenManager.initLogoutToken:359` following Back-Channel Logout 1.0 §4's *"preferably at
most two minutes"*.

`sid` is `clientSession.getUserSession().getId()` (`:366`) — the Broker session's id, so every
client of one Broker session receives the **same** `sid`. An application therefore indexes its own
session by that string; it does not have to be unique per application.

Without `sid` the spec's instruction is to end everything: §2.4, *"If a `sid` Claim is not present,
the intent is that all sessions at the RP for the End-User … be logged out."* That is more than
story 17 asks and signs the Person out on their phone too. With `sid` the reach is exactly story
17's.

Discovery already advertises both halves unconditionally
(`OIDCWellKnownProvider.java:215-216`): `backchannel_logout_supported` and
`backchannel_logout_session_supported` are `true`, and `end_session_endpoint` is published.

## RP-initiated logout at a live Broker session

Signed in as the declared `demo` Person through the `lostatnight` client, then:

| Logout request | Answer |
|---|---|
| `client_id` + `post_logout_redirect_uri` | 200, the *Logging out* page, a `logout-confirm` form |
| `id_token_hint` + `post_logout_redirect_uri` | 302 straight to the redirect |

`confirmationNeeded` starts `true` and is cleared only by an `id_token_hint` whose `azp` resolves to
a client, or by there being no browser session at all (`LogoutEndpoint.java:177,202,216,260`).

## Where each application would intercept the ID token

**LostAtNight.** The adapter is constructed inside allauth's own module-level views
(`.../openid_connect/views.py:96,107`), so overriding `complete_login` means shadowing the
`openid_connect_callback` URL with the application's own view. Then
`AccountAdapter.get_logout_redirect_url` (`allauth/account/adapter.py:246`) returns the
`end_session_endpoint` URL — and it is read **before** the session is flushed
(`allauth/account/views.py:849-850`), so the stashed token is still there. gdalface already has that
adapter class, and already POSTs to `account_logout` (`templates/account/logout.html:187`).

**Geonity.** citsci-api already owns the interception point: `IbercivisAccountAdapter.complete_login`
(`users/ibercivis_account.py:48`) reads the decoded `id_token` out of `extra_data` and throws the
rest away. Keeping the raw JWT is a line there. Giving it to the browser is the hard part: the
browser never holds a Broker token on purpose (`react/src/lib/ibercivis-account.ts`, header
comment), so either the API hands the ID token out, or it keeps it against the DRF token and answers
a sign-out request with the URL to visit. The second keeps the comment true.

## Session teardown, application by application

**LostAtNight ends real sessions.** Measured in the running container: `SESSION_ENGINE` is
`django.contrib.sessions.backends.db`, the Django 4.2.16 default, unset in both settings modules. It
is server-side, so it can be invalidated — the signed-cookie backend, which could not, is not in
play.

Turning a `sid` into the sessions to delete needs an index, and allauth ships it unused:
`allauth.usersessions` keeps a `UserSession` row per `(user, session_key)` with a `data` JSONField,
and `UserSession.end()` deletes the session from the store and the row
(`allauth/usersessions/models.py:85,96,124`). Rows are created by a receiver on allauth's own
`user_logged_in` signal, so installing the app and running its migration is enough — the middleware
is only for last-seen tracking (`allauth/usersessions/apps.py:22`, `middleware.py:9`). gdalface
does not install it today. The `sid` goes in `UserSession.data` at sign-in; the back-channel view
looks it up there.

**Geonity has nothing per-session to end.** `REST_AUTH` overrides neither `TOKEN_MODEL` nor
`USE_JWT` (`citsci-api/settings.py:235`), so dj-rest-auth's defaults apply:
`rest_framework.authtoken.models.Token` and no JWT (`dj_rest_auth/app_settings.py`). That model's
`user` is a **`OneToOneField`** with no expiry column at all — `key`, `user`, `created`
(`rest_framework/authtoken/models.py:13-18`) — and `default_create_token` does
`get_or_create(user=user)` (`dj_rest_auth/utils.py:4`). One token per Person, handed out again to
every client, valid until something deletes it.

So the answer to the issue's question is **yes, and not only the Flutter app**. Deleting the token
signs out every holder of it. The Flutter client stores it under `auth_key` in
`SharedPreferences` and sends `Authorization: Token …`
(`flutter/lib/services/auth_service.dart:33,81`); on a 401 its `handleUnauthorized` clears the key
and fires the redirect to the login screen (`:25`). The web app does the same in an axios response
interceptor (`react/src/lib/axios.ts:26`). Neither notices at once — each finds out on its next
request. That is the reach story 17 would get at Geonity, and it is wider than story 17 asks.

This already happens, in the other direction and without the Broker: the Flutter client's `logout()`
POSTs to the API's logout endpoint (`auth_service.dart:95`), `geonity-admin`'s `clearAuth` does the
same (`admin/src/features/auth/hooks/useAuth.ts:161`), and dj-rest-auth's `LogoutView` deletes
`request.user.auth_token` (`dj_rest_auth/views.py:159`). Signing out of the phone signs out the
browser. The one client that does **not** call it is the Geonity web app: its navbar sign-out only
drops `localStorage` (`react/src/store/auth.ts:27`, `components/shared/Navbar.tsx:38`).

Honouring `sid` at citsci-api would mean recording `sid → token` at sign-in, which is a new model,
because the DRF token carries no session identity. Without that record the only teardown available
is the whole token.

citsci-api does also create a Django session on every sign-in — `SESSION_LOGIN` defaults to `true`
and `SocialLoginView.process_login` calls allauth's `adapter.login`
(`dj_rest_auth/registration/views.py:170`) — but `SessionAuthentication` is commented out of
`DEFAULT_AUTHENTICATION_CLASSES` (`citsci-api/settings.py:215`), so that session authenticates
nothing and ending it achieves nothing.

**`geonity-admin` does not reach the Broker.** Read on the `federation` branch: its only ways in are
email and password, and Google, both against citsci-api's own endpoints
(`admin/src/lib/api/auth.ts:72,107`). There is no Ibercivis button and no reference to the Broker in
`admin/src`. It is out of scope for half 1 and in scope for half 2 by accident: it holds the same
per-Person token under `geonity.authKey`, so a token deleted for the web app signs the panel out too.

## The hand-written code

Grounded in the files above, in the register these repositories are written in — gdalface spent 334
lines of tests on the sign-in alone (`gdalface/tests_ibercivis_account.py`).

- **LostAtNight, half 1** — a view shadowing the callback URL, an adapter subclass, a
  `get_logout_redirect_url` override. Three files, 60–80 lines.
- **LostAtNight, half 2** — a back-channel view, `allauth.usersessions` installed, its `sid` written
  at sign-in. Two files and a migration, 100–140 lines.
- **citsci-api, half 1** — keep the raw JWT, and an endpoint answering with the end-session URL. One
  file, 40–60 lines, plus somewhere to keep the token.
- **citsci-api, half 2** — a back-channel view, and a `sid → token` record if `sid` is honoured. Two
  files and a migration, 80–120 lines.
- **Geonity web app** — call that endpoint and follow the URL instead of clearing `localStorage`.
  About 20 lines. Half 2 is none of its business: the API holds the credential.

One cost is avoidable. `allauth.socialaccount.internal.jwtkit.verify_and_decode` already checks a
JWT's signature against a `keys_url`, its issuer, its audience and its expiry — the four of
Back-Channel Logout 1.0 §2.6's eleven steps that are real cryptography. What stays bespoke is steps
5 to 7: `sub` or `sid` present, the `events` member, and no `nonce` (*"PROHIBITED"*, §2.4), then the
teardown, then 200 on success and 400 on failure (§2.8).

The other cost is not avoidable in any application, and is removable in **this** repository:
`PersonIdentifierMapper` implementing `LogoutTokenMapper` would put the Person Identifier in the
logout token's `sub`, so no application has to reason about the shape of an identifier it was told to
treat as opaque (ADR-0002). That is one interface and one method in
`broker/person-identifier/`. **Unmeasured** — the mapper was not built. Implementing it and
re-running the capture above settles it.

## Reliability: one attempt, then silence

Measured, with a listener standing in for the application:

| The application | What the Broker does |
|---|---|
| answers 500 | nothing is logged at the default level; the Person is still redirected; one POST, no retry |
| is unreachable | one `WARN KC-SERVICES0057: Logout for client 'lostatnight' failed: … Connection refused`; exactly one attempt |

Either way `setClientLogoutAction(…, LOGGED_OUT)` runs after the call returns, whatever the status
(`AuthenticationManager.java:583`), and the Broker session ends. The browser path throws the
per-client answer away in a `forEach` (`AuthenticationManager.java:765`) and fires `EventType.LOGOUT`
as a success (`OIDCLoginProtocol.finishBrowserLogout:536`). The per-client outcome is consumed in
exactly one place: the endpoint where Keycloak is itself a relying party receiving a logout token
from upstream, which answers 504 when a downstream logout failed (`LogoutEndpoint.java:635`).
Nothing surfaces it for a Person's own sign-out.

Nor would the admin console: the realm has `eventsEnabled` and `adminEventsEnabled` both `false`,
with `jboss-logging` as the only listener, so a successful `LOGOUT` is not even in the log at the
default level — `LOGOUT_ERROR` is, at `WARN`.

Keycloak is conformant here. Back-Channel Logout 1.0 §2.5: *"In all other cases, the OP SHOULD NOT
retransmit a Back-Channel Logout Request."* RP-Initiated Logout §2 says the quiet part: *"some
logout notification methods from the OP to the RP are unreliable and therefore the notification
might not be received."*

A short application session is therefore not a mitigation at either application, because neither
has one.

## Lifetimes, and which one actually binds

The realm declares no SSO lifetime. `SessionExpirationUtils` falls back to
`Constants.DEFAULT_SESSION_IDLE_TIMEOUT` and `DEFAULT_SESSION_MAX_LIFESPAN` when the realm's value
is `<= 0` (`SessionExpirationUtils.java:157,173`; `Constants.java:71-72`), and the import stores
those same numbers. Read from the live realm: `ssoSessionIdleTimeout = 1800`,
`ssoSessionMaxLifespan = 36000`. The issue's 30 minutes and 10 hours are right.

They are also not the binding constraint. Measured in the running LostAtNight container,
`SESSION_COOKIE_AGE = 1209600` — 14 days, the Django default, with
`SESSION_EXPIRE_AT_BROWSER_CLOSE` false and `SESSION_SAVE_EVERY_REQUEST` false, so it is 14 days
absolute from sign-in. Geonity's DRF token has no expiry column at all. On a shared computer the
Person's longest-lived credential is the application's: 14 days against the Broker's 10 hours at
LostAtNight, and without limit at Geonity. Shortening the Broker's SSO max moves neither.

That is the interaction with story 18 worth recording: the Broker's expiry and an application's are
independent clocks, and the one a Person meets first is the application's. An ADR that shortens the
Broker's session and says nothing about the applications' has changed nothing a Person can see.

## Issue #157: one ordering constraint, per application

`prompt=none` returns a code whenever a Broker session exists. So an application that ends its own
session while leaving the Broker's alive is signed straight back in by the next visit to its sign-in
page — which is where `issue #157` recommends putting the silent request. The constraint is
therefore per application and not global: **no application ships silent sign-in before its own
sign-out ends the Broker session.** Half 1 at LostAtNight does not gate silent sign-in at Geonity.

One thing beyond ordering. After an RP-initiated logout the Broker redirects to
`post_logout_redirect_uri`; if that address is the sign-in page and the sign-in page asks silently,
the Person is signed back in by their own sign-out — or loops. `issue #157`'s mark in
`sessionStorage` is what stops it, and the post-logout destination must be chosen knowing that.

## What this leaves open

- **The `LogoutTokenMapper` route is unbuilt.** Everything above about it is read from Keycloak's
  source, not run.
- **Nothing was measured under load or across two applications at once.** The capture used one
  client and one Broker session.
- **The Flutter client was read, not run.** That its 401 path reaches a production build, and which
  API host a release talks to, is deployment and was not read.
- **`docs/notes/veridas-technical-questions.md` (Q4, §3.4) already asks a supplier how reliable
  back-channel logout is in practice, and what fails silently.** This note answers the second half
  from the source: a non-2xx fails silently. It does not answer how often that happens in a real
  deployment, which is what the question was for.
- **OpenRed is not integrated.** Its `federation` branch holds no Ibercivis sign-in, though the realm
  declares its client and `docs/local-development.md` lists its environment. Two integrations are in
  scope for story 17.
