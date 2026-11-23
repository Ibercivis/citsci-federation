<!-- Research note, not a decision. Read and measured 23 November 2026 on `quay.io/keycloak/keycloak:26.8.1`, and on 26.7.1 where it says so. -->

# Where Keycloak reads a brokered address and its verdict

**Verdict.** The reported advisory was real, up to and including 26.7.1: the address came from
userinfo and `email_verified` from the ID token. Keycloak fixed it in 26.8.0 (upstream issue
`keycloak/keycloak#53471`, commit `1027d787fe`). It does not reproduce on the pinned 26.8.1, and
nothing in the configuration was changed.

The fix opened a smaller gap. When userinfo gives an address and says nothing about verifying it,
the verdict is lost, even if the ID token said `false`, and Keycloak would store the Person
**verified**. Neither path lets that through: `UnverifiedEmailCondition` reads the lost verdict as
unaffirmed, so the join refuses the arrival and, since PR #155, the create path withholds the
address.

**Read on only if** you are moving the Keycloak pin, adding an Identity Source whose userinfo might
omit `email_verified`, or about to rely on a Person's stored `emailVerified`.

## What the source says

`services/.../broker/oidc/OIDCIdentityProvider.java`, `extractIdentity` and `setEmailVerified`.

**26.8.1:**

- The address and the verdict are first read from the ID token.
- Userinfo is then called whenever `disableUserInfo` is off, a userinfo URL is set and an access
  token came back. Names in the ID token do not prevent it, and no version back to 18.0.0 had such a
  condition. `mock-source/README.md` used to say otherwise.
- If userinfo carries `email`, both `email` and `email_verified` are replaced by userinfo's. An absent
  `email_verified` there becomes `null`, not the ID token's value. Names are replaced the same way.
- The verdict goes into the brokered context as `email_verified`, which is what our condition reads.
  `setEmailVerified` stores it; when it is `null`, it falls back to
  `AbstractIdentityProvider.setEmailVerified`, which stores `trustEmail` itself for a new Person.

**26.7.1 and earlier:** the address is replaced by userinfo's, but `setEmailVerified` reads the
verdict from the validated ID token. Nothing puts `email_verified` in the brokered context, so our
condition finds no verdict and treats every arrival as unaffirmed. Built on 26.7.1, every case in
`tests/verified-email-join.test.ts` but one goes red: a verified arrival through a trusted source
is withheld its address and asked for another. Moving the pin below 26.8.0 is not available.

## What was measured

Through the Mock Identity Source, each Identity at an address nobody held, read back from the
Broker's database:

| Identity | Source | ID token | userinfo | Stored |
| --- | --- | --- | --- | --- |
| `mock-split` (17 Nov) | `mock` | `split@`, verified | `shared@`, unverified | `shared@`, unverified |
| probe, named | `mock-affirming-named` | `probe-decoy@`, verified, with `name` and `preferred_username` | `probe-named@`, unverified | `probe-named@`, unverified, no name |
| probe, silent, before PR #155 | `mock-affirming-b` | `probe-silent@`, **unverified** | `probe-silent@`, nothing said | `probe-silent@`, **verified** |
| probe, silent, after PR #155 | `mock-affirming-b` | the same | the same | no address, unverified, `UPDATE_EMAIL` pending |

The named row is the experiment issue #24 asked for: a name in the ID token, and userinfo still read.
The silent rows are the gap, and what `WithholdUnverifiedEmail` makes of it.

On 26.7.1, with PR #155's withholding rule switched off so that what Keycloak stores is visible:

| Identity | Source | ID token | userinfo | Stored |
| --- | --- | --- | --- | --- |
| probe, split | `mock-affirming-b` | `probe-decoy-old@`, verified | `probe-split-old@`, **unverified** | `probe-split-old@`, **verified**; signed in |
| probe, silent | `mock-affirming-b` | `probe-silent-old@`, unverified | `probe-silent-old@`, nothing said | `probe-silent-old@`, unverified, `VERIFY_EMAIL` pending |

The first row is the advisory. The second is why the gap is the fix's: before it, the ID token's
verdict survived a silent userinfo.

`tests/verified-email-join.test.ts` holds the join against all three shapes at an address a Person
already holds (`advisory-split`, `advisory-split-named`, `advisory-silent`). On 26.7.1 they go red
before reaching that question, at the verified Person each one starts from.

## What this leaves open

- **Keycloak's own `emailVerified` is wrong for this shape.** Only our condition stands between it
  and a Person stored verified from an unverified ID token. Anything that reads the stored flag
  instead of the brokered verdict inherits the gap.
- **No case pins the create path for this shape.** The silent row after PR #155 was measured by
  hand; the cases in `tests/verified-email-join.test.ts` cover it only at an address somebody holds.
- **Google does not promise `email_verified` in userinfo.** Its OpenID Connect page promises it in
  the ID token whenever the `email` scope is asked for, which issue #28 does. For userinfo it promises
  only the standard claims and `claims_supported`, and warns that "users or their organizations may
  choose to supply or withhold certain fields". Were it withheld, a Person Google verified would lose
  the verdict and meet the closed door or the mailed confirmation, never another Person. A source's
  userinfo is worth checking before its `trustEmail` is turned on.
