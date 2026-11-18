<!-- Research note, not a decision. Measured 18 November 2026 against the pinned Keycloak 26.8.1. -->

# The account REST API reads credentials and cannot change them

**Verdict.** The account REST API does not replace the Account Console for credential operations.
It reads the Person's account, their password's metadata, their Identities and their sessions. It
edits Profile attributes. It changes no password and no address. Both of those are browser steps,
started with `kc_action=UPDATE_PASSWORD` or `kc_action=UPDATE_EMAIL` on an authorization request.
The console is an SPA over this API plus those two redirects. A front end of our own could replace
it the same way, but no server-side call could.

**Read on only if** you are automating a Person's credential operations, or proposing a profile
screen to replace the console (ADR-0005).

Measured with an access token the `account-console` client obtained by the code flow, for a Person
who registered a Local Credential and confirmed it.

| Call | Answer |
|---|---|
| `GET /account` | 200: the account, `emailVerified`, the user profile metadata |
| `POST /account` with a new `email` | 204, **and the address is unchanged**. No mail is sent |
| `POST /account` with a new `firstName` | 204, and the name is written |
| `GET /account/credentials` | 200: the password, `removeable: false`, `updateAction: UPDATE_PASSWORD` |
| `DELETE /account/credentials/<id>` | 400, `Credential type cannot be removed` |
| `GET /account/linked-accounts` | 200: every Identity Source, `connected` for the Person's own |
| `GET /account/sessions` | 200: the Person's sessions, per client |

The silent 204 on an address is not `update-email`'s doing: it held with the feature off. The user
profile metadata `GET /account` returns marks `email` read-only, as it marks `username`. Here the
address is the username and `editUsernameAllowed` is off. Turn either of those around and this call
may start writing an unconfirmed address. `tests/local-credential.test.ts` makes the call to catch
that.

A user declared in the realm file, like `demo`, gets 401 on every call. It holds none of the realm's
default roles, where a registered Person holds `default-roles-citsci`. Probe as a registered Person.
