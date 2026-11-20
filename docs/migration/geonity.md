# Migration — Geonity

What Geonity's existing accounts would need in order to move onto the Broker. Migration is outside
the pilot's committed scope; this record exists so that it is cheap if time allows. It is not a
commitment. See `docs/agents/migration-requirements.md` for how to read and extend it.

No figure here was measured. The counts that would decide the populations below do not exist yet;
section 7 names them.

## 1. Identity today

- **One account store, three clients.** `Ibercivis/citsci-api` is a Django API with
  **django-allauth 65.15.0** and **dj-rest-auth 7.2.0**. Its web app and admin panel
  (`Ibercivis/Geonity`) and its Flutter mobile app all sign in against it and hold a DRF token.
- The email address **is** the sign-in identifier: `ACCOUNT_AUTHENTICATION_METHOD = 'email'`,
  `ACCOUNT_EMAIL_VERIFICATION = 'mandatory'`. The username is generated from the address and nobody
  types it, except in Django's own admin.
- **Registration** is `POST /api/users/registration/`. Since `issue #31` the web app no longer
  offers it. The mobile app still does, and the endpoint stays open for it.
- **A Google provider of its own**: `POST /api/users/auth/google/`, used by the web app's and the
  admin panel's Google buttons, with the application's own Google client. It does not pass through
  the Broker. A new Google login is connected to an existing account with the same address
  (`users/adapters.py`, `AUTO_CONNECT_BY_EMAIL_PROVIDERS`).
- **The Broker** arrives as the `ibercivis` OpenID Connect provider (`issue #31`). An account it
  creates is a `SocialAccount(provider='ibercivis', uid=<Person Identifier>)` on a new `User` with
  no usable password. An address already held by an account is refused, so today no existing
  account is ever reached through the Broker.
- A Person's work hangs off Django's own user: projects, observations, memberships, likes and the
  profile. Nothing is keyed on an email address, which is what makes a move possible at all.
- Anonymous contribution by QR (`/contribute/<token>`) creates no account. **Nothing about it needs
  migrating.**

## 2. Populations

Described by what each kind of account **has**:

- **A password and a verified address.** The ordinary case. Can move, and can also stay as it is:
  ADR-0007 keeps its sign-in working with no sunset date.
- **A password and an address nobody ever confirmed.** Registered and never activated. Unsafe to
  link automatically.
- **A Google provider account and no usable password.** Created through the app's own Google
  button. **These accounts have no other way in.**
- **A Google provider account and a password.** Either signed up with a password and later used
  Google, which connects by address, or the reverse.
- **Accounts created on the mobile app.** The same kinds as above. They differ in where they keep
  being created: the mobile app registers through the API for as long as it has no Broker sign-in.
- **Staff and superuser accounts.** Keep local sign-in regardless, as for LostAtNight.

## 3. Requirements

- **R1** — An arriving Identity is linked to an existing account only when **both** sides are
  verified: the Broker's Verified Email claim **and** the local `EmailAddress.verified` flag.
  dj-rest-auth refuses the link outright today; enabling it is a change to the `ibercivis` path in
  the API, not configuration.
- **R2** — Every account whose address was never confirmed is confirmed or disabled **before** R1 is
  enabled.
- **R3** — No two `auth_user` rows share an address. allauth enforces uniqueness on its own
  `EmailAddress` table, not on `auth_user.email`, so rows created outside allauth can collide.
- **R4** — A migrated account keeps its projects, observations, memberships and profile. The Person
  Identifier is added beside the existing user; nothing is re-keyed.
- **R5** — Anonymous contribution is untouched and still reaches no Broker route.
- **R6** — Staff and superuser sign-in stays local.
- **R7** — The mobile app signs in through the Broker before the registration endpoint closes, or
  the endpoint stays open. Closing it first leaves the mobile app with no way to create an account.

## 4. Order

1. **R2 and R3 first**: resolve unconfirmed addresses and shared ones.
2. **Then enable linking** (R1).
3. **Only then close the app's own Google route**, in the web app and the admin panel and, if it has
   one, in the mobile app.
4. **The registration endpoint closes last**, after the mobile app's own Broker sign-in ships (R7).

> **Doing 3 before 2** locks everyone who signed in only with the app's own Google button **out of
> their own contributions**: they hold no password to fall back on. **Doing 4 before the mobile app
> ships** stops new mobile users from creating an account at all.

## 5. Irreversible steps

- **Closing the app's own Google route**: reversible in configuration, not in effect. Anyone locked
  out meanwhile has to be recovered by hand.
- **Disabling an unconfirmed account under R2**: reversible, but tell the person first; from their
  side it looks like a ban.
- **Closing the registration endpoint**: a released mobile app version that still calls it fails
  for everyone who has not updated. Mobile releases cannot be withdrawn, so this waits until the
  versions that still call it are no longer in use.

## 6. Who acts

| Step | Owner |
|---|---|
| R1 — both-sides-verified linking on the `ibercivis` path | app maintainer, with the rule stated by the Broker operator |
| R2 — resolve unconfirmed addresses | a human with database access, plus whoever can mail those people |
| R3 — find shared addresses | a human with database access (a read-only check) |
| Close the app's own Google route | app maintainer, in each client that has it |
| Broker sign-in in the mobile app | mobile app maintainer |
| Close the registration endpoint (R7) | app maintainer; **verified by hand**, the Broker cannot check it |

## 7. Open questions

- **How large is each population in section 2?** Settled by read-only counts on the production
  database: accounts with no usable password and a Google `SocialAccount`, addresses without a
  verified `EmailAddress`, and `auth_user.email` values held by more than one row. The counts go to
  `docs/private/`, not here.
- **Does the mobile app have its own Google sign-in, and against which client?** Settled by reading
  `flutter/`, which nobody has done for this purpose.
- **Which mobile app versions still call the registration endpoint?** Settled by the release history
  and the store's version distribution, before step 4.
- **Is the app's own Google client retired or kept dormant?** Settled by deciding how long the
  Broker route is watched first.

## 8. Status

`not started` — nothing has been agreed with the maintainer. Written 2026-11-19 against
`Ibercivis/citsci-api` at `9bc11b3` and `Ibercivis/Geonity` at `8317e37`, both on `federation`.
