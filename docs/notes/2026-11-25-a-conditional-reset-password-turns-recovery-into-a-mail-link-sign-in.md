<!-- Research note, not a decision. Measured 25 November 2026 on the local Broker against the pinned
Keycloak 26.8.1 (`broker/Dockerfile`), with a reset-credentials flow declared in `broker/realm/base.json`
for the measurement and reverted afterwards, imported into a wiped volume (`pnpm broker:reset`). Driven
over the real OIDC protocol through the confidential and public stand-in clients, with each Person read
back from the Admin API. Derived, not measured: nothing — the one claim issue #213 sent this to settle is
measured below, and the provider code is cited only where it says why. It feeds issue #124. -->

# A CONDITIONAL `reset-password` survives the import and turns recovery into a sign-in by mail link

**Verdict.** The derived claim held in full. The realm import accepts `"requirement":
"CONDITIONAL"` on the `reset-password` execution and the Admin API reads it back as CONDITIONAL,
while still offering only REQUIRED, ALTERNATIVE and DISABLED as its choices. With that flow bound,
recovery for a Person who holds no password mails the same "Reset password" link, serves **no page at
all**, and sends the browser back to the application **with an authorization code** — the Person is
signed in. Nothing is written: no credential, no required action, no change to the Person's record,
not even a changed timestamp. Recovery for a Person who does hold a password is untouched: the link
still serves "Update password" and the new one replaces the old. So the lever does not close the path
to a Local Credential, it converts it into a passwordless sign-in by mail link, and issue #124 is
choosing between two paths rather than deciding whether to close one.

**Read on only if** you are writing the case issue #124 asks for, declaring a reset-credentials flow
in `broker/realm/` — the declaration to transcribe is below — or deciding what ADR-0005 says about
recovery.

## The declaration, to transcribe

What was measured, in `broker/realm/base.json`. One entry in `authenticationFlows`, plus the
binding:

```json
"resetCredentialsFlow": "citsci reset credentials",
```

```json
{
  "alias": "citsci reset credentials",
  "providerId": "basic-flow",
  "topLevel": true,
  "builtIn": false,
  "authenticationExecutions": [
    { "authenticator": "reset-credentials-choose-user", "requirement": "REQUIRED", "priority": 10, "authenticatorFlow": false, "userSetupAllowed": false },
    { "authenticator": "reset-credential-email", "requirement": "REQUIRED", "priority": 20, "authenticatorFlow": false, "userSetupAllowed": false },
    { "authenticator": "reset-password", "requirement": "CONDITIONAL", "priority": 30, "authenticatorFlow": false, "userSetupAllowed": false }
  ]
}
```

The shipped flow's conditional OTP subflow is left out: the realm configures no OTP.

`derive.ts` and `checkFlows` take it as declared. The import wipes nothing and refuses nothing, and
a realm already in the database is not re-imported — the measurement needed `pnpm broker:reset`.

## The import keeps CONDITIONAL, and the dropdown still denies it

`GET /admin/realms/citsci/authentication/flows/citsci%20reset%20credentials/executions`, after the
import:

| execution | `requirement` | `requirementChoices` |
|---|---|---|
| `reset-credentials-choose-user` | REQUIRED | REQUIRED |
| `reset-credential-email` | REQUIRED | REQUIRED |
| `reset-password` | **CONDITIONAL** | REQUIRED, ALTERNATIVE, DISABLED |

The requirement the execution holds is not among the choices the same response offers for it. That
is `REQUIREMENT_CHOICES` being a dropdown and nothing else, as the previous note read off the code.
The admin console would show this execution with no way to express what it is set to.

`resetCredentialsFlow` reads back as `citsci reset credentials`. The built-in `reset credentials`
flow is still in the realm, unbound — the other prediction, also confirmed.

## A Person holding no password: no page, and a code

One Person, created by a first arrival through an Identity Source that affirms addresses, holding no
credential. Then recovery, driven from the "Forgot password?" link on the sign-in page the
application sent them to.

- The mail arrives, subject **"Reset password"**, carrying the `login-actions/action-token` link.
- The link serves **nothing**. The browser goes straight back to the application's callback with an
  authorization code, which redeems to an ID token carrying the Person Identifier that arrival had
  and an `auth_time` of that moment.
- The Admin API reads the Person back **byte for byte as before**: `credentials` empty,
  `requiredActions` empty, `federated_identity` still the affirming source, `emailVerified` true,
  `createdTimestamp` unchanged.
- Arriving through the source again afterwards carries the same Person Identifier.

So whoever holds the mailbox holds a session, and the Person's record says it never happened. The
realm declares no event store (`eventsEnabled` false), so the server log is the only place anything
of it survives.

"No page at all" is exact only where the Person has already granted that application consent. Driven
from the other stand-in client, which this Person had never signed into, the link serves the
Broker's ordinary consent page — "Grant Access to Brokered App (public)" — and the code follows the
Yes. It is the consent step every sign-in has, not a credential page: no form on it asks for a
password.

## A Person holding one: unchanged

Same path, for a Person holding a `password` credential. The link serves
`login-actions/required-action` carrying `password-new`, `password-confirm` and `logout-sessions`,
headed **"Update password"**. Choosing one sends the browser back to the application with a code, the
new password authenticates, the old one is refused in the browser, and the credential list is one
`password` either side.

`tests/local-credential.test.ts` passes against the flow unchanged, registration included — the
whole suite does. Nothing in the Broker's measured behaviour moves except the one case above, which
the suite has no case for.

## Why, in the provider's code

The citations the previous note derived this from, confirmed at tag 26.8.1:

- `DefaultAuthenticationFlow.java:347-348` adds a CONDITIONAL execution to the required list beside
  the REQUIRED ones; `:371-372` returns `false` from `isConditionalSubflowDisabled` for anything with
  `!model.isAuthenticatorFlow()`. So the execution runs.
- `ResetPassword.java:34-37` is the `if` whose second branch is `isConditional() &&
  configuredFor(context)`, and `:45` is the `isConfiguredFor(PasswordCredentialModel.TYPE)` it calls.
  No password, no `UPDATE_PASSWORD`, and `context.success` either way.
- `ResetCredentialsActionTokenHandler.java:107` then ends a non-brokered reset with
  `super.authenticationComplete()`, which is the authorization code.

`ResetPassword.getHelpText()` still describes the branch as OPTIONAL, the pre-8.0 name for
CONDITIONAL. The behaviour is undocumented in the administration guide, which says the requirement
"is only set on sub-flows".

## What this leaves issue #124

The lever works and does what it was read to do. What it buys is that no Local Credential appears;
what it costs is a sign-in granted on the mailbox alone, to a Person whose own source was never
asked, leaving no trace on the Person. Compared against the path it replaces — recovery that mints a
password, measured in `2026-11-23-adding-a-local-credential-to-a-brokered-person.md` — the reach is
the same mailbox either way. Only the artefact differs: a credential the Person never chose, or a
session nobody can see afterwards.

Out of scope here and still unmeasured: whether a `hardcoded-attribute-idp-mapper` attribute
survives with no `unmanagedAttributePolicy` declared, which is the other half of
`2026-11-24-what-would-turn-off-adding-a-local-credential.md`.
