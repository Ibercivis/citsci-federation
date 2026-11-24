<!-- Research note, not a decision. Read and measured 24 November 2026 against `quay.io/keycloak/keycloak:26.8.1` as the pinned image runs it, and the classes read out of that image's own jar. -->

# Why a second confirmation mail never arrives, and what cannot fix it

**Verdict.** Keycloak sends one Person at most one address-confirmation mail every 30 seconds and
withholds the rest. It is Keycloak's code, not our configuration; it counts the Person, not the
address; and it is not logged — it is written on the page the Broker hands back, which
`tests/local-credential.test.ts` dropped. That is the whole of `issue #143`.

Read on only if the suite is withholding mail again, if someone is about to raise `PATIENCE_MS` in
`tests/mailbox.ts`, or if someone wants the limit lowered for testing alone.

## The limit

`org.keycloak.authentication.requiredactions.util.EmailCooldownManager`, in
`org.keycloak.keycloak-services-26.8.1.jar`:

```
public static final java.lang.String EMAIL_RESEND_COOLDOWN_SECONDS = "emailResendCooldownSeconds";
public static final int EMAIL_RESEND_COOLDOWN_DEFAULT_SECONDS = 30;
```

`getCooldownInSeconds` reads `emailResendCooldownSeconds` off the required action's config and falls
back to that default. `broker/realm/base.json` declares `UPDATE_EMAIL` with `"config": {}`, so the
default is what runs.

The cache key is `UpdateEmail.EMAIL_RESEND_COOLDOWN_KEY_PREFIX` — `"update-email-cooldown-"` — and
the user id. `VerifyEmail` keeps its own, `verify-email-cooldown-`, so registering and changing an
address do not share a cooldown. It lives in the single-use object cache and expires by itself,
which is why `pnpm broker:reset` clears it: the Person goes, and the user id with them.

## Three fixes that are not fixes

- **Raising `PATIENCE_MS`.** The mail is never sent. Measured: a run 1 second after the previous one
  still had 0 messages in the catcher 55 seconds later. Patience buys nothing from a Broker that
  decided not to send.
- **A fresh address every run.** The key is the user id. Measured: two `UPDATE_EMAIL` requests, each
  asking for a different freshly minted address, and the second was refused.
- **Lowering it in `broker/realm/testing.json`.** `appendLayer` in `broker/realm/derive.ts` refuses a
  layer entry whose `alias` the base already declares — the "A layer only adds" rule in
  `broker/README.md`. An `UPDATE_EMAIL` carrying `emailResendCooldownSeconds` there fails the realm
  build instead of reaching production. A testing-only cooldown needs that rule changed first, which
  is a different conversation.

## It says so, and nobody was reading

`UpdateEmail.sendEmailUpdateConfirmation` does not fall silent. It re-renders the form with
`emailVerifySendCooldown`, which `theme/base/login/messages/messages_en.properties` in
`org.keycloak.keycloak-themes-26.8.1.jar` defines as:

```
emailVerifySendCooldown=You must wait {0} seconds before resending the verification email.
```

Nothing reaches `docker compose logs keycloak`, which is why the cause looked invisible: there is no
log line, there is a page. The key itself never reaches the HTML, so that rendered sentence is the
only thing a case can match — and `{0}` is the seconds remaining, which is why
`tests/local-credential.test.ts` quotes the Broker's number instead of keeping one of its own.

The realm sets no `internationalizationEnabled` and no `defaultLocale`, so English is what the page
comes back in. A Keycloak that reworded this, or a realm that translated it, would stop the match —
and the case then reports the refusal with the page's own text instead, which is a vaguer failure
and not a silent one.
