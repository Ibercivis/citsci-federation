<!-- Research note, not a decision. Measured 23 November 2026 on the local Broker against the pinned
Keycloak 26.8.1, over the real OIDC protocol, with each Person's record read back from the Admin
API. The realm was the one this branch carries, which differs from `main` only in the join path for
an unaffirmed address; nothing measured here goes through it. Provider code cited at tag 26.8.1. It
feeds issue #124; the rule belongs to ADR-0005. -->

# Recovery mints a Local Credential, and so does the Account Console

**Verdict.** "Forgot password?" is a working path by which a Person who arrived through Google or
GitHub gains a Local Credential on Keycloak 26.8.1. The Broker mails the link, the link sets a
password where the Person held none, and the Person Identifier a Brokered App reads is unchanged
afterwards — as is the Identity link to the source they came in through, which goes on working. It
is not the only such path: the Account Console offers that Person a "Set up password" button, and
that one asks for their session rather than their mailbox. Whether either path is wanted, and which
one a Person is pointed at, is a product decision this note does not make.

**Read on only if** you are settling what ADR-0005 says about a Person's second Identity, costing
what would turn one of these paths off, writing the case issue #124 asks for, or costing a migration
whose accounts arrive holding no password.

## The flow has no case for "no password"

Three reads of the provider's own code, at tag 26.8.1, in
`services/src/main/java/org/keycloak/authentication/authenticators/resetcred/` and
`server-spi-private/src/main/java/org/keycloak/models/utils/DefaultAuthenticationFlows.java`:

- `DefaultAuthenticationFlows.resetCredentialsFlow` ships `reset-password` as **REQUIRED**. Our
  realm declares no reset-credentials flow, so that is the flow the Broker runs — read off the Admin
  API: `reset-credentials-choose-user`, `reset-credential-email`, `reset-password`, each REQUIRED.
- `ResetPassword.authenticate` adds the `UPDATE_PASSWORD` required action whenever its execution is
  required. It asks whether a password exists — `isConfiguredFor(PasswordCredentialModel.TYPE)` —
  only on the branch for a CONDITIONAL execution, which the shipped flow never takes.
- `ResetCredentialChooseUser.action` finds a Person by username and then, because
  `loginWithEmailAllowed` is on, by address. It reads no credential and asks nothing about where the
  Person's Identity came from.

None of the three inspects `federated_identity`. So the flow does not distinguish setting a password
from replacing one, and it does not know a delegated Identity when it sees one.

`ResetCredentialEmail`'s `force-login` option defaults to `only-federated`, and
`UserModel.isFederated()` reads the **user-storage** link — which a brokered Person has none of. So
the Person is not asked to sign in again after choosing the password.

## Measured: one Person, before and after

A Person created by a first arrival through a source that affirms addresses, then recovered at that
address. Read from the Admin API either side.

| | Before | After |
|---|---|---|
| `credentials` | none | one, `type: password` |
| `federated_identity` | the affirming source | unchanged |
| `emailVerified` | true | true |
| `requiredActions` | none | none |
| id, `created_timestamp` | — | both unchanged |

The link arrived at the address (one mail), led to a page carrying `password-new` and
`password-confirm`, and submitting it sent the browser back to the application **with an
authorization code** — signed in, as the `force-login` default above predicts.

Afterwards, measured through the confidential stand-in client: signing in with the address and that
password authenticates, and arriving through the source again authenticates, and both carry the same
`sub` as the first arrival did.

What the whole path needs is the address and the mailbox. Nothing asks for the source. ADR-0004
already grants a mailbox that much, so what is new here is not the reach but the shape of what it
reaches: a credential the Person never chose to have.

The page a Person reaches says **"You need to change your password."** — to somebody who has never
had one.

## The console offers it too, and asks for less

`GET /account/credentials`, for a brokered Person holding no password, answers with one container:
`type: password`, `userCredentialMetadatas: []`, `removeable: false`, and
**`createAction: "UPDATE_PASSWORD"`** — measured, with a token the `account-console` client obtained
by the code flow.

That field is the console's button. `PasswordCredentialProvider.getCredentialTypeMetadata` sets
`createAction` exactly when the Person is not configured for a password and `updateAction` when they
are; `SigningIn.tsx` renders a `setUpNew` link whenever `createAction` is present, calling
`login({ action: container.createAction })`, which is the `kc_action` redirect
`docs/notes/2026-11-18-account-rest-api-credential-operations.md` already describes. The claim about
the rendered page is read from that source, not clicked.

The step itself is measured. In a session the Person holds from arriving through the source, an
authorization request carrying `kc_action=UPDATE_PASSWORD` serves a page asking for a password;
submitting it writes a `password` credential, **sends no mail**, leaves the Identity link in place,
and leaves the Person Identifier a Brokered App reads unchanged.

So the two paths differ in what they ask for. Recovery asks for the mailbox and nothing else. The
console asks for a live session, which means the source.

## A Person holding no address is reachable by neither

Issue #88 takes an unaffirmed address off the Person, so some arrivals leave a Person with no
address at all. Measured on such a Person — created through the source that affirms nothing, holding
`UPDATE_EMAIL`, their username set to their own id:

- Typing the address their source claimed finds nobody.
- Typing their username, which is their id, finds them and mails nothing:
  `ResetCredentialEmail.authenticate` returns early when `user.getEmail()` is empty.

Both answers are the identical reassurance — "You should receive an email shortly with further
instructions." — and in both cases no mail is sent and no credential appears. That Person's only way
in is the source they arrived through, until they answer the `UPDATE_EMAIL` page.

## The lever that looks obvious and is not

Turning off the `UPDATE_PASSWORD` required action would close both paths and take the Local
Credential's own registration with it. With `verifyEmail` on, `RegistrationPassword.buildPage`
leaves the password off the registration form and `success` sets `UPDATE_PASSWORD` once the address
is confirmed — which is why the Broker's registration form asks for an address, a first name and a
last name, and no password (measured). The action is how a registered Person gets their first
password.

What remains: putting the `reset-password` execution on CONDITIONAL in a reset-credentials flow of
our own, which is the branch whose code does test for an existing password — **unmeasured**, and
`ConfigurableAuthenticatorFactory.REQUIREMENT_CHOICES` offers that authenticator only REQUIRED,
ALTERNATIVE and DISABLED, so whether an imported realm is allowed to say CONDITIONAL is the first
thing to find out. Or `resetPasswordAllowed: false`, which takes recovery away from a Person who
genuinely forgot a password they had.

## The provider documents neither case

The administration guide at `keycloak.org/docs/latest/server_admin/`, which served 26.8.2 when it was
read, describes the emailed link under "Enabling forgot password" as asking the user to update their
password. It says nothing about a user who holds none, and nothing about one who arrived through an
identity provider — not there, and not in the identity-brokering chapter. The behaviour above is
undocumented rather than promised, which is what an upgrade is free to change.

## For the record: registration's own refusal, in the Broker's words

Registering at an address a Person already holds answers **"This email is already associated with an
existing account."** on the registration form (measured). The issue reads that refusal off the
declaration; this is the Broker saying it.
