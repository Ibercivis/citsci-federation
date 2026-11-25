# Migration — OpenRed

What OpenRed's existing accounts would need in order to move onto the Broker. Migration is outside
the pilot's committed scope; this record exists so that it is cheap if time allows. It is not a
commitment. See `docs/agents/migration-requirements.md` for how to read and extend it.

No figure here was measured. The counts that would decide the populations below do not exist yet;
section 7 names them.

## 1. Identity today

- **One account store, three clients.** `Ibercivis/OpenRed` is a Django API with
  **django-allauth 65.0.2** and, on `main`, **dj-rest-auth 6.0.0**. Its React app
  (`Ibercivis/openred-react`) and its Flutter client (`Ibercivis/openred-flutter`) both sign in
  against it and hold a DRF token.
- The email address **is** the sign-in identifier: `ACCOUNT_AUTHENTICATION_METHOD = 'email'`,
  `ACCOUNT_EMAIL_VERIFICATION = 'mandatory'`. The username is generated from the address and
  nobody types it, except in Django's own admin.
- **Registration** is `POST /dj-rest-auth/registration/`. Since `issue #30` the React app no longer
  offers it. The Flutter client still does — `lib/api_service.dart` posts to it — and the endpoint
  stays open for that.
- **A Google provider of its own**: `POST /dj-rest-auth/google/`, with the application's own Google
  client. It does not pass through the Broker. A new Google login is connected to an existing
  account holding the same address (`users/adapters.py`,
  `AUTO_CONNECT_BY_EMAIL_PROVIDERS`), which is behaviour that predates the pilot and was narrowed to
  that one provider rather than removed.
- **The Broker** arrives as the `ibercivis` OpenID Connect provider (`issue #30`). An account it
  creates is a `SocialAccount(provider='ibercivis', uid=<Person Identifier>)` on a new `User` with
  no usable password. An address already held by an account is refused, so today no existing account
  is ever reached through the Broker.
- **One library version differs between the branches.** `dj-rest-auth` is 7.2.0 on `federation`,
  in both of its dependency lists. On 6.0.0 two call sites raise a `TypeError` against the pinned
  allauth before any request leaves the process — the mechanism sits beside the pin in that
  application's `local_dev/requirements.txt` — so the code flow needs either this version or
  application code that absorbs both. The version was chosen over that code, which is the
  weighing ADR-0017's exception asks for rather than a case of the pin being immovable. `main`
  keeps 6.0.0, which is what production installs until the integration lands there; both lists on
  `federation` agree, so nothing deploying that branch is caught out (ADR-0017).
- A Person's work hangs off Django's own user: devices, tracks, measurements, missions, campaigns
  and stations. Nothing is keyed on an email address, which is what makes a move possible at all.
- Anonymous reading already exists and produces no account: `IsAuthenticatedOrReadOnly` serves the
  map, the aggregations and the reports to anybody. **Nothing about it needs migrating** (ADR-0006).

## 2. Populations

Described by what each kind of account **has**, because that is what decides its steps:

- **A password and a confirmed address.** The ordinary case. Can move, and can also stay where it
  is: ADR-0007 keeps this sign-in with no sunset date.
- **A password and an address nobody confirmed.** Registered and never activated. It holds the
  address, so the Broker route is refused for it, and since `issue #30` the web offers no second
  registration — so this population has no self-service way forward at all. The confirmation mail
  it was already sent still works.
- **A Google account of the application's own**, with no password. Moving it means the Person
  signing in through the Broker *with Google*, which is a different Identity and so a different
  Person Identifier: nothing matches the two but the address, and an address is not an identity
  (ADR-0002). Closing the application's Google route before such an account is linked locks it out.
- **An account that is also a device owner.** Every `Device` has an ingest token that authenticates
  a measurement upload without a session. Moving the account does not touch the token, which is what
  makes the move safe for data collection in the field — but see section 5.
- **Staff and superusers.** They sign in at `/admin/` with a **username**, not an address, and the
  Broker sends no username. Whatever happens to the rest, these keep a local password or lose
  `/admin/`.

## 3. Requirements

One line each, each one testable.

- **R1** — Every account that is to move has an address the Broker holds as a Verified Email.
- **R2** — No account moves while it has neither a usable password nor a `SocialAccount` of this
  application's own: it would have no way in at all.
- **R3** — No two `auth_user` rows share an address. allauth enforces uniqueness on its own
  `EmailAddress` table, not on `auth_user.email`, so rows created outside allauth can collide — and
  this application's `CustomRegisterSerializer` checks `User.objects.filter(email=...)` rather than
  `EmailAddress`, so the two tables can disagree.
- **R4** — Linking is an act of whoever owns both accounts, never a match on address alone. The
  integration already refuses the address match; migration must not quietly reintroduce it.
- **R5** — `/admin/` keeps a way in for at least one account before any of this application's own
  passwords is removed.
- **R6** — The Flutter client signs in through the Broker before `POST /dj-rest-auth/registration/`
  closes. Until then the closure is the web's only.
- **R7** — A device's ingest token survives the move, or every device in the field is reflashed.

## 4. Order

With the consequence of the wrong order, which is the part that is forgettable.

1. **Link before closing anything.** An account with no password and only the application's own
   Google route is locked out the moment that route closes, and nothing but the address would
   suggest which Person it is.
2. **Close the Flutter client's registration after the Flutter client can sign in through the
   Broker**, not before. The other way round leaves mobile with no way to create an account.
3. **Decide `/admin/` before removing local passwords.** Django's admin takes a username; a Person
   arriving from the Broker has none, and the staff who administer the platform would lose the
   screen they administer it from.
4. **The `dj-rest-auth` move travels with the integration**, which is why both of `federation`'s
   lists carry it. Separated, the first sign-in through the Broker raises rather than answers.

## 5. Irreversible steps

- **Removing a local password.** Done before R1 holds, it strands the account.
- **Rotating a device's ingest token.** The token is shown once, and a device in the field carries
  the old one; a Person who has lost theirs reflashes the device. Nothing in migration needs to
  touch these, and that is the point of saying so.
- **Connecting two accounts.** Undoing it means knowing which rows belonged to which account before,
  and nothing records that.

## 6. Who acts

| Step | Owner |
|---|---|
| Confirming an address the Broker will hold | the Person, from their own mailbox |
| Linking an existing account to a Person | the Person, signed in to both — no tooling for it yet |
| The `requirements.txt` pin | the application maintainer, in a pull request against `main` |
| Closing the registration endpoint | the application maintainer, once R6 holds |
| Deciding `/admin/`'s way in | the application maintainer |
| Anything read from the production database | a human with access to it, never an agent (CLAUDE.md) |

## 7. Open questions

What is not known, and the measurement that would settle each.

- **How many accounts hold a password, and how many only the application's own Google route?** A
  count of `auth_user` rows with an unusable password, joined against `socialaccount_socialaccount`
  by provider.
- **How many accounts were registered and never confirmed?** A count of `account_emailaddress` rows
  with `verified = false`, and how old they are.
- **Do `auth_user.email` and `account_emailaddress.email` agree?** A row count where they do not.
  R3 rests on the answer.
- **How many staff and superusers are there, and does any of them sign in only at `/admin/`?** A
  count of `is_staff` rows and their last login.
- **Does the Flutter client's sign-in survive a Broker-only account?** It posts an address and a
  password to `/dj-rest-auth/login/`; what it does with an account that has neither is untested.

Each of those is a measurement of a production database. Taken, the figures go to
`docs/private/`, never here.

## 8. Status

`not started` — nothing has been agreed with the maintainer. Written 2026-11-24 against
`Ibercivis/OpenRed` at `561e7bf` and `Ibercivis/openred-react` at `74bae1c`, both on
`ibercivis-account`, which is `issue #30`'s branch off `federation`, and `Ibercivis/openred-flutter`
at `c57c117` on `main`.

**What migration would not remove.** ADR-0007 keeps this application's own sign-in with no sunset
date, so its password store stays whatever migration does. The exposure the pilot removes here is
the *new* registrations the web no longer takes — and not the mobile ones, which continue. The
decision that would actually remove the password store is the one to close local sign-in, and
nobody has made it.
