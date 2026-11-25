<!-- Research note, not a decision. Read 24 November 2026. Keycloak's provider code at tag 26.8.1,
which is the tag `broker/Dockerfile` still pins. The administration guide at
`keycloak.org/docs/latest/server_admin/`, which served 26.8.2 when it was read. This repository at
`main` plus the working tree. Nothing measured: no Broker was started. It feeds issue #124, whose
measurements are in `docs/notes/2026-11-23-adding-a-local-credential-to-a-brokered-person.md`. -->

# One lever is declared and narrow, and it keeps the mail link

**Verdict.** CONDITIONAL on the `reset-password` execution, in a reset-credentials flow of our own,
is available by declaration. The realm importer and the Admin REST API both accept it: neither
checks `REQUIREMENT_CHOICES`, which feeds the admin console's dropdown and nothing else. At runtime
a CONDITIONAL execution that is not a subflow is never treated as disabled, so it runs and takes the
one branch that asks whether a password exists. What it stops is the password, not the mail link: a
Person holding none would be returned to the application signed in, with no page shown and no
credential written. The Account Console's button has no declared lever but the realm-wide one
already ruled out, and `resetPasswordAllowed: false` takes recovery from every Person, including the
Local Credential holders ADR-0005 commits recovery to. Anything narrower than those three is code of
ours, in a jar this repository already builds.

**Read on only if** you are writing the case issue #124 asks for, declaring a reset-credentials flow
in `broker/realm/`, costing a condition or a required action of our own, or deciding what ADR-0005
says about recovery.

## CONDITIONAL on `reset-password` is accepted everywhere it has to be

Four reads, at tag 26.8.1.

- **The importer validates nothing.** `DefaultExportImportManager.java:1624` is
  `Requirement.valueOf(rep.getRequirement())`, inside a `try` whose only `catch` handles the
  pre-8.0 spelling `OPTIONAL`. `RepresentationToModel.java:1157` does the same for the other import
  path. Neither consults the authenticator's factory.
- **The Admin REST API validates nothing either.**
  `AuthenticationManagementResource.java:808` compares the submitted name to the current one and
  calls `Requirement.valueOf` on it.
- **`REQUIREMENT_CHOICES` is a dropdown.** Its only reader is
  `AuthenticationManagementResource.java:739`, which copies the factory's choices into the
  `AuthenticationExecutionInfoRepresentation` the admin console renders. For a **subflow** execution
  the same method hardcodes the four including CONDITIONAL (`:706-710`), which is where the
  documentation's rule lives.
- **The runtime runs it.** `DefaultAuthenticationFlow.java:347` puts a CONDITIONAL execution in the
  required list alongside the REQUIRED ones. The line that drops a condition that did not match,
  `:292`, calls `isConditionalSubflowDisabled`, and that method returns `false` at `:371` for
  anything with `!model.isAuthenticatorFlow()`. A CONDITIONAL authenticator execution with no
  condition beside it is therefore executed, not skipped.

`ResetPassword.java:35-37` then takes the second branch of its own `if` — `isConditional() &&
configuredFor(context)` — and `:44-46` is the `isConfiguredFor(PasswordCredentialModel.TYPE)` that
asks whether the Person holds a password. So the targeting is exactly "holds a password", not
"arrived through a source". A Local Credential holder who forgot theirs is unaffected.

## The documentation says this requirement does not exist here

The administration guide, serving 26.8.2, on the Requirement column: "This requirement type is only
set on sub-flows." It then describes a CONDITIONAL subflow with no condition in it as acting
Disabled — which is `isConditionalSubflowDisabled`'s empty-list case, and not what happens to an
execution that is not a subflow.

`ResetPassword.getHelpText()` still says "OPTIONAL", which is what CONDITIONAL was called before
8.0. The branch is a vestige of that requirement, kept working by `:35-37` and documented nowhere.
An upgrade is free to drop it.

## `"requirement": "OPTIONAL"` reads like the lever and is a no-op

`DefaultExportImportManager.java:1626-1631` catches the `IllegalArgumentException` and calls
`MigrateTo8_0_0.migrateOptionalAuthenticationExecution`. That method (`:91-121`) wraps the execution
in a new CONDITIONAL subflow whose condition is `conditional-user-configured`, with the execution
itself REQUIRED inside it.

That condition asks each sibling's `Authenticator.configuredFor(session, realm, user)`
(`ConditionalUserConfiguredAuthenticator.java:64`). `ResetPassword` inherits that method from
`AbstractSetRequiredActionAuthenticator.java:100-102`, where it returns `true` unconditionally — a
different method from the `configuredFor(AuthenticationFlowContext)` at `ResetPassword.java:44`,
which is the one that reads the credential. So the condition always matches and the subflow always
runs. Declaring OPTIONAL produces a flow that looks narrowed in the admin console and behaves like
REQUIRED.

## What declaring our own flow costs

Three things.

**The mail link stops being a password reset and becomes a sign-in.** With the execution CONDITIONAL
and the Person holding no password, nothing adds `UPDATE_PASSWORD`, `ResetPassword` calls
`context.success`, and the flow has no further execution.
`ResetCredentialsActionTokenHandler.java:106-108` ends a non-brokered reset by calling
`super.authenticationComplete()`. The existing note already measured that this flow returns an
authorization code, and that `ResetCredentialEmail`'s `force-login` default does not ask a brokered
Person to sign in again. So the predicted result is: mail arrives, link clicked, browser returns to
the application authenticated, no page, no credential. **Unmeasured.** It is one run of the existing
recovery case against a realm carrying the flow, watching whether the `password-new` page appears.

**The built-in flow stays in the realm.** `importAuthenticationFlows` calls
`DefaultAuthenticationFlows.migrateFlows` at `:1522`, before it reads the bindings, and that method
(`DefaultAuthenticationFlows.java:71-75`) creates "reset credentials" whenever no flow carries that
alias and binds it. `:1549-1558` then rebinds to whatever `resetCredentialsFlow` names. Declaring
the binding wins; the built-in flow remains, unbound and unreachable. `checkFlows` in
`broker/realm/flows.ts` sees only declared flows, so it will not notice it.

**The three executions become ours.** `DefaultAuthenticationFlows.java:160-195` is what we would be
copying: `reset-credentials-choose-user`, `reset-credential-email`, `reset-password`, plus a
conditional OTP subflow we have no use for. Everything the provider changes in that flow on an
upgrade stops arriving.

## No shipped condition can see what we would want to condition on

Four conditions were read, and none answers either question — "does this Person hold a password",
"did this Person arrive through a source".

- `conditional-user-configured`: always true here, for the reason above.
- `conditional-credential`: reads `AuthenticatorUtil.getAuthnCredentials(...)`, the credentials
  **used in this authentication process** (`ConditionalCredentialAuthenticator.java:52-65`), not the
  ones the Person holds. Placed ahead of `reset-password` it sees nothing used, so it reports `none`
  for everybody.
- `conditional-role`: a brokered Person and a registered one both hold `default-roles-citsci`
  (`docs/notes/2026-11-18-account-rest-api-credential-operations.md`).
- `conditional-user-attribute`: reads `user.getAttributeStream(name)`
  (`ConditionalUserAttributeValue.java:51`). Nothing in the realm writes an attribute naming the
  source.

That last one has a declared way to be fed, and it is the only route found to a flat refusal without
code of ours. `hardcoded-attribute-idp-mapper` (`HardcodedAttributeMapper.java:82`) writes a fixed
attribute on a brokered Person, on the create path via `preprocessFederatedIdentity` (`:95-99`) and
on every later arrival via `updateBrokeredUser` (`:102-106`) when the mapper's sync mode is FORCE. A
CONDITIONAL subflow holding `conditional-user-attribute` and `deny-access-authenticator` would then
refuse the flow for a Person carrying it. What it costs:

- It refuses recovery to a Person who holds **both** a Local Credential and a social Identity.
  ADR-0004 joins those into one Person by address, so that is an ordinary Person, not an edge case.
- It marks nobody retroactively. FORCE catches a Person on their next arrival; one who never comes
  back is unmarked.
- Whether the attribute survives at all is **unmeasured**. `broker/realm/base.json` declares no
  `unmanagedAttributePolicy`, and the create path builds the Person through the user profile. The
  mapper's own writes go straight to `UserModel`, which may or may not be filtered. One sign-in
  through the Mock Identity Source and one `GET /admin/realms/citsci/users/<id>` settles it.

## `resetPasswordAllowed: false` is realm-wide, and ADR-0005 is against it

Four gates read it: `AuthorizationEndpoint.java:277` (the application-initiated entry),
`LoginActionsService.java:459` and `:531` (the direct entry and every step of the flow),
`ResetCredentialsActionTokenHandler.java:58` (an already-issued link stops working). `RealmBean`
reads it for the login page, which is where the "Forgot password?" link goes away.

It is not a narrowing of anything. ADR-0005 names "Broker-owned password recovery" as part of what
the Local Credential is; turning this off withdraws that, and the Person it hurts is the one the ADR
was written for.

It leaves the administrator's path alone: `UserResource.java:1026` and `:1063`
(`resetPasswordEmail`, `executeActionsEmail`) check no such flag, so a set-password mail can still
be sent by hand.

## The console's button cannot be suppressed by declaration

`CredentialTypeMetadata.java:238-243` nulls `createAction` and `updateAction` unless
`verifyRequiredAction` passes, and that method (`:262-270`) checks exactly one thing: that the
required action is registered in the realm and enabled. `PasswordCredentialProvider.java:341-347`
sets `createAction` for a Person not configured for a password, and that is the whole decision. No
realm setting, no client scope, no per-client flag enters it.

So the only declaration that removes the button removes it for everybody — the UPDATE_PASSWORD
required action, already settled against in the previous note, because registration's own first
password depends on it.

A theme is not a lever. The button is `SigningIn.tsx` rendering a link, and the link is an
authorization request with `kc_action=UPDATE_PASSWORD`; hiding it leaves the URL.

**The authorization endpoint does not refuse `kc_action` on any ground we could use.**
`AuthenticationManager.java:1370-1374` refuses it when the required action is disabled, and
`:1481-1483` is the same check for the action list. Nothing else refuses. The password policy's
`maxAuthAge` reaches this path — `UpdatePassword.java:202-219` prefers it over the required
action's own config — but `OIDCLoginProtocol.java:578-592` shows what it does: force
re-authentication, not refusal. Re-authenticating a brokered Person means their source again, which
they have.

## Nothing per-Person is a lever before the fact

The Admin API adds required actions to a Person; it has no way to take an enabled action out of one
Person's reach. `UserResource.java:890-900` deletes a credential, which removes a password somebody
already set. Brute-force protection counts failed guesses. All three are after the fact.

## What code of ours would have to do

Two shapes, both small, and the repository already carries one of them.

A **`ConditionalAuthenticator`** reading `session.users().getFederatedIdentitiesStream(realm, user)`
(`UserProvider.java:254`), or the Person's password, placed in a CONDITIONAL subflow in our
reset-credentials flow ahead of `deny-access-authenticator` or `reset-password`.
`broker/verified-email/` already builds `citsci-condition-unverified-email` for the first broker
login flow, with a Maven stage in `broker/Dockerfile` and a case in
`tests/verified-email-join.test.ts`.
A second condition is a class in that jar, not a new artefact.

A **`RequiredActionProvider`** registered under the id `UPDATE_PASSWORD`, refusing when the Person
holds a delegated Identity and no password. That closes the console and the recovery page at once,
because both arrive at the same provider. It also replaces a provider whose behaviour registration
depends on, so the thing it must not break is the first password of a registered Person.

ADR-0016's terms: the cost it refuses to pay is **security-sensitive code written once per Brokered
App, maintained by people who did not ask for it**. A condition in the Broker's own jar is not that
ledger — it is one artefact, in this repository, covered by this repository's suite. The weighing
ADR-0016 asks for still applies to the first criterion: a lever that leaves the mail link signing
People in has not improved security, it has moved what the link does.

## Unmeasured, and what would settle each

- Whether a CONDITIONAL `reset-password` execution survives a realm import and reads back as
  CONDITIONAL from `GET /admin/realms/citsci/authentication/flows/<alias>/executions`. The code says
  yes at every step; nobody has run it.
- Whether the mail link then signs a passwordless Person in with no page. Predicted above.
- Whether a `hardcoded-attribute-idp-mapper` attribute survives with no `unmanagedAttributePolicy`
  declared, on the create path and on a FORCE re-arrival.

The first two are `issue #213`, which the shape of the decision in `issue #124` now rests on.
