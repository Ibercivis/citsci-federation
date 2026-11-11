# Migration — LostAtNight

What LostAtNight's existing accounts would need in order to move onto the Broker. Migration is
outside the pilot's committed scope; this record exists so that it is cheap if time allows. It is
not a commitment. See `docs/agents/migration-requirements.md` for how to read and extend it.

Measured figures are deliberately absent: they are in `docs/private/security-findings.md` (INT-001,
INT-002). What follows are the conclusions drawn from them.

## 1. Identity today

- **django-allauth 65.0.2**, with `allauth.account` and `allauth.socialaccount`.
- The email address **is** the sign-in identifier: `ACCOUNT_AUTHENTICATION_METHOD = 'email'`,
  `ACCOUNT_USERNAME_REQUIRED = False`, `ACCOUNT_EMAIL_VERIFICATION = 'mandatory'`.
- Self-service registration and password recovery at `/accounts/`.
- **A Google provider of its own**: `allauth.socialaccount.providers.google`, configured in
  `SOCIALACCOUNT_PROVIDERS` with the application's own client id and secret, with a hardcoded
  "Sign in with Google" button in `templates/socialaccount/snippets/login.html`. This route does not
  pass through the Broker.
- A Person's work hangs off Django's own user: `GeoAttempt.assignedUser`, `Batch.user`,
  `UserProfile` (one-to-one). Nothing is keyed on an email address, which is what makes a move
  possible at all.
- Anonymous participation already exists and already behaves as ADR-0006 requires: the attempt's
  user is left null when nobody is authenticated. **Nothing about it needs migrating.**

## 2. Populations

Described by what each kind of account **has**, because that is what decides its steps:

- **A password and a verified address.** The ordinary case, and the largest. Can move, and can also
  stay exactly as it is — ADR-0007 keeps its sign-in working with no sunset date.
- **A password and an address nobody ever confirmed.** Small. The only population that is *unsafe*
  to link automatically, and the reason requirement R2 exists.
- **A Google provider account and no usable password.** Created through the app's own Google button;
  Django records an unusable password for a social-only signup. **These accounts have no other way
  in**, which makes the order in section 4 load-bearing.
- **A Google provider account and a password.** Already holds two ways in; gains a third. No special
  handling.
- **Staff and superuser accounts.** Keep local sign-in regardless: administrative access should not
  depend on an external route while the pilot is being evaluated.

## 3. Requirements

- **R1** — The Broker emits a Verified Email claim the app can trust, and the app links an arriving
  Identity to an existing account only when **both** sides are verified: the Broker's claim **and**
  the local `EmailAddress.verified` flag. allauth checks only the first; the second is ours to write.
- **R2** — Every local account whose address was never confirmed is confirmed or disabled **before**
  automatic linking is enabled. Unconfirmed means nobody ever demonstrated control of that mailbox,
  so linking to it would hand an arriving person an account somebody else holds the password to.
- **R3** — No two accounts share an address. If that ever stops being true, linking has to choose,
  and it must not choose on its own.
- **R4** — Each migrated account keeps its `UserProfile`, its attempts and its statistics. The
  Person Identifier is added beside the existing user; nothing is re-keyed.
- **R5** — Anonymous participation is untouched and still reaches no Broker route.
- **R6** — Staff and superuser sign-in stays local.

## 4. Order

1. **R2 first**: resolve the unconfirmed addresses.
2. **Then enable linking** (R1), with both-sides verification.
3. **Only then close the app's own Google button.**

> **The consequence of getting 3 before 2 wrong**: everyone who signed in with the app's own Google
> button and never set a password is **locked out of their own contributions**. They have no password
> to fall back on. Done in the right order, the same people arrive through the Broker, match on their
> verified Google address, and land in the same account without noticing anything happened.

Closing registration (ADR-0007) is independent of this sequence and can happen at any point after
step 2.

## 5. Irreversible steps

- **Closing the app's own Google provider**: reversible in configuration, but not in effect — anyone
  locked out in the meantime has to be recovered by hand.
- **Disabling an unconfirmed account under R2**: reversible, but tell the person first; from their
  side it is indistinguishable from being banned.
- **The security fixes this app needs first** (tracked privately; not migration work): one of them
  signs every user out when it is applied, and invalidates outstanding password-reset links. Sequence
  it before anything that depends on a live session, and announce it rather than let people discover
  it.

## 6. Who acts

| Step | Owner |
|---|---|
| R1 — both-sides-verified linking | app maintainer, with the rule stated by the Broker operator |
| R2 — resolve unconfirmed addresses | a human with database access, plus whoever can mail those people |
| R3 — confirm no shared addresses | a human with database access (a read-only check) |
| Close the app's own Google button | app maintainer |
| Close registration (ADR-0007) | app maintainer; **verified by hand**, the Broker cannot check it |

## 7. Open questions

- **Does the app's own Google client registration get retired, or kept dormant?** Retiring it is the
  point of the exercise — one fewer secret to hold — but it cannot be undone quickly if the Broker
  route fails. Settled by deciding how long to keep the Broker route under observation first.
- **Do the people with both a password and a Google account want the password kept?** Settled by
  asking them, not by inspecting the database.
- **Does anything outside the web front end authenticate against this app?** No mobile client is
  known, which is what makes LostAtNight simpler than Geonity (#31). Settled by searching for API
  consumers before closing any route.

## 8. Status

`not started` — nothing has been agreed with the maintainer. Written 2026-11-11 against
`Ibercivis/gdalface` at commit `99c560a09` on `main`.

Blocked on the security findings recorded privately for this app: two of them should be fixed before
its accounts are worth moving anywhere.
