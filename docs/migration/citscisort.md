# Migration — CitSciSort

What CitSciSort's existing accounts would need in order to move onto the Broker. Migration is
outside the committed scope; this record exists so that it is cheap if time allows. It is not a
commitment. See `docs/agents/migration-requirements.md` for how to read and extend it.

No figure here was measured. The counts that would decide the populations below do not exist yet;
section 7 names them.

One requirement below rests on a finding reported privately rather than on anything in this file.
It is stated as the requirement it is, and the finding is not described here
(`docs/agents/security-findings.md`).

## 1. Identity today

- **One account store, one client.** `Ibercivis/citscisort` is a Django REST API (`api/`) with
  **Django 4.2.7**, **django-allauth 0.57.0** and **dj-rest-auth 5.0.2**, serving a React + Vite
  front end from the same repository (`react-code/`). There is no mobile client.
- **Django's own `auth.User`.** No custom user model, so nothing about an account is keyed on
  anything but its primary key.
- The email address **is** the sign-in identifier: `ACCOUNT_AUTHENTICATION_METHOD = 'email'`,
  `ACCOUNT_EMAIL_REQUIRED = True`, `ACCOUNT_USERNAME_REQUIRED = False`. The username is
  **generated and never shown**: `CustomAccountAdapter.generate_unique_username` makes
  `<local-part>_<8 hex>`, so no Person knows theirs. That matters in section 2, because Django's
  admin asks for it.
- A second path to the same thing: `apps.authentication.backends.EmailBackend` is first in
  `AUTHENTICATION_BACKENDS` and looks an account up by `User.objects.filter(email=…).first()`,
  falling back to `username`. The lookup is **case-sensitive and takes the first row**, which is
  what R3 is about.
- **Registration** is `POST /api/auth/registration/`, dj-rest-auth's, with
  `CustomRegisterSerializer`: an address, a password, and two email preferences. There is no second
  registration path and no invitation flow.
- **Sign-in** is `POST /api/auth/login/`, with `CustomLoginSerializer`, answering with a DRF
  token.
- **A Google provider of its own**: `POST /api/auth/google/`, a `dj_rest_auth` `SocialLoginView`
  over allauth's Google adapter, with the application's own Google client. It does not pass through
  the Broker, and the front end posts the ID token it gets in the browser. The application sets
  `SOCIALACCOUNT_EMAIL_AUTHENTICATION` and `SOCIALACCOUNT_EMAIL_AUTHENTICATION_AUTO_CONNECT`
  **globally**, so a Google arrival is connected to an existing account holding the same address.
  That behaviour predates the Broker. The integration (`issue #242`) narrows it to Google by
  declaring it per provider instead, rather than removing it.
- **The Broker** arrives as an allauth `openid_connect` app with `provider_id = 'ibercivis'`
  (`issue #242`). An account it creates is a `SocialAccount(provider='ibercivis', uid=<Person
  Identifier>)` on a new `auth_user` row with no usable password. An address already held by an
  account is refused, so today no existing account is ever reached through the Broker.
- **No version pin moves for the integration.** dj-rest-auth 5.0.2 redeems a code against allauth
  0.57.0 without raising — it calls `provider.get_scope(request)`, which that allauth accepts — so
  the pair this application already runs is the pair the integration runs. ADR-0017's exception is
  not needed here, unlike OpenRed's.
- **One API token per account, never expiring** (`rest_framework.authtoken`, wrapped by
  `ActivityTokenAuthentication`, which also records one `DailyActivity` row per account per day).
  The token is not derived from the password, so it survives a move untouched — and it survives a
  password change too.
- **Legal acceptance is a gate on everything.** `HasAcceptedLegal` is a project-wide default
  permission class beside `IsAuthenticated`: an account whose `UserProfile` does not hold the
  current `CURRENT_TERMS_VERSION` and `CURRENT_PRIVACY_VERSION` gets 403 from every endpoint except
  `legal-status` and `accept-legal`. It is stored on the profile row, so it moves with the account.
- A Person's work hangs off that user row: classifications, sessions, saved abstracts, the profile,
  daily activity, debates, comments, followed debates, shares, notifications and the engagement-mail
  log. Nothing is keyed on an email address, which is what makes a move possible at all.
- **Anonymous use produces no account and no contribution.** The only unauthenticated surfaces are
  read-only: `GET /api/stats/overview/`, `GET /api/stats/abstracts/` and
  `/.well-known/stats.json`. Classifying requires an account. `Classification.user` is nullable,
  but for account deletion rather than for anonymous work — so there is **no Anonymous Contribution
  here to migrate** (ADR-0006), and the glossary's term describes nothing in this application.

## 2. Populations

Described by what each kind of account **has**, because that is what decides its steps:

- **A password and a confirmed address.** The ordinary case. Can move, and can also stay where it
  is: ADR-0007 keeps this sign-in with no sunset date.
- **A password and an address nobody confirmed.** Registered and never activated. It holds the
  address, so the Broker route is refused for it, and after `issue #242` the web offers no second
  registration — so this population has no self-service way forward. Its confirmation mail still
  works. **This is the population R4 excludes**, and the one a human has to decide about.
- **A Google account of the application's own**, with no password. Moving it means the Person
  signing in through the Broker *with Google*, which is a different Identity and so a different
  Person Identifier: nothing matches the two but the address, which ADR-0018 makes enough once both
  sides have confirmed it and the Person says so. Closing the application's Google route before such
  an account is linked locks it out.
- **An account that has not accepted the current legal versions.** It exists and can reach two
  endpoints. It moves like any other, and whoever moves it must not read "403 everywhere" as a
  broken migration.
- **An account holding a newsletter or activity-mail consent.** `newsletter_opt_in_at` and
  `activity_emails_opt_out_at` on the profile are **proof of consent with a date**. They are not
  identity, and they are the thing most easily dropped by a move that rebuilds profiles.
- **Staff and superusers.** They sign in at `/admin/` with a **username**, and the username is
  machine-generated and shown nowhere. The Broker sends no username. Whatever happens to the rest,
  these keep a local password or lose `/admin/` — and unlike the other applications, a staff member
  here may not know what their username is.

## 3. Requirements

One line each, each one testable.

- **R1** — Every account that is to move has an address the Broker holds as a Verified Email.
- **R2** — No account moves while it has neither a usable password nor a `SocialAccount` of this
  application's own: it would have no way in at all.
- **R3** — No two `auth_user` rows share an address, and none differs from another only by case.
  allauth enforces uniqueness on its own `account_emailaddress` table, not on `auth_user.email`,
  and `EmailBackend` resolves a sign-in with `.first()` on a case-sensitive match — so two rows
  that collide do not fail, they pick one.
- **R4** — An account links only on ADR-0018's two conditions, and the local condition is a
  `verified = true` row in `account_emailaddress` for that account, **read from that table**. That
  the account signs in is not evidence of it, and must not be used as evidence of it. This is the
  requirement that rests on the private finding.
- **R5** — `/admin/` keeps a way in for at least one account before any of this application's own
  passwords is removed, and whoever holds it knows its generated username.
- **R6** — A moved account keeps its `UserProfile` row rather than getting a fresh one, so the
  legal acceptance and the two dated mail consents survive.
- **R7** — A moved account keeps its `authtoken` row, or every client holding one re-authenticates.
  Only the web front end holds one today, in `localStorage`, so this is cheap here — and it is
  cheap **because** there is no mobile client, which is the thing that makes CitSciSort the
  easiest of the four to move.

## 4. Order

With the consequence of the wrong order, which is the part that is forgettable.

1. **Link before closing anything.** An account with no password and only the application's own
   Google route is locked out the moment that route closes, and nothing but the address would
   suggest which Person it is.
2. **Resolve R3 before linking anybody.** Linking under a duplicate address attaches the Person to
   whichever row `.first()` returned, silently, and section 5 says why that is not undoable.
3. **Decide the unconfirmed-address population before closing registration**, not after. After the
   closure those accounts have no route of their own left to re-register with, and the decision
   turns into a support request per account.
4. **Decide `/admin/` before removing local passwords.** Django's admin takes a username; a Person
   arriving from the Broker has none, and the staff who administer the platform would lose the
   screen they administer it from.

## 5. Irreversible steps

- **Removing a local password.** Done before R1 holds, it strands the account.
- **Connecting two accounts.** Undoing it means knowing which rows belonged to which account before,
  and nothing records that — the work hangs off one user row either way.
- **Deleting an account through `DELETE /api/auth/delete-account/`.** It takes a
  `delete_classifications` flag: false preserves the classifications with `user = NULL`, true
  deletes them. Either way the profile and the account go, and **the preserved rows can never be
  reattached**, because the only thing that pointed at the Person was the column just nulled. Not a
  migration step, and named here because it is the one destructive endpoint a Person can reach
  themselves while a migration is half done.
- **Rebuilding a `UserProfile`.** The two consent timestamps are the record that consent was given;
  recreated, the row says consent with no date, which is worse than no row.

## 6. Who acts

| Step | Owner |
|---|---|
| Confirming an address the Broker will hold | the Person, from their own mailbox |
| Linking an existing account to a Person | the Person, answering on arrival (ADR-0018) |
| Resolving a duplicate or case-colliding address (R3) | a human with database access |
| Deciding the unconfirmed-address population | the application maintainer |
| Closing the registration path | the application maintainer |
| Deciding `/admin/`'s way in | the application maintainer |
| Anything read from the production database | a human with access to it, never an agent (CLAUDE.md) |

## 7. Open questions

What is not known, and the measurement that would settle each.

- **How many accounts hold a password, and how many only the application's own Google route?** A
  count of `auth_user` rows with an unusable password, joined against `socialaccount_socialaccount`
  by provider.
- **How many accounts were registered and never confirmed, and how old are they?** A count of
  `account_emailaddress` rows with `verified = false`, by age. R4 excludes all of them, so this is
  the size of the population needing a human.
- **Do `auth_user.email` and `account_emailaddress.email` agree, and does any pair of rows collide
  on case?** A row count for each. R3 rests on both answers.
- **How many accounts have not accepted the current legal versions?** A count of `UserProfile` rows
  whose two version fields differ from the current settings. It says how many accounts would appear
  broken to whoever tests a migration.
- **How many staff and superusers are there, and does any of them sign in only at `/admin/`?** A
  count of `is_staff` rows and their last login.

Each of those is a measurement of a production database. Taken, the figures go to
`docs/private/`, never here.

## 8. Status

`not started` — nothing has been agreed with the maintainer. Written 2026-11-28 against
`Ibercivis/citscisort` at `6adcbce` on `main`, read for `issue #242`.

**What migration would not remove.** ADR-0007 keeps this application's own sign-in with no sunset
date, so its password store stays whatever migration does. What the Broker removes here is the
*new* registrations the web no longer takes — all of them, because this application has no mobile
client and no second registration path, which is more than the closure buys at OpenRed or Geonity.
The decision that would actually remove the password store is the one to close local sign-in, and
nobody has made it.
