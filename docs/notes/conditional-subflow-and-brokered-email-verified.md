<!-- Research note, not a decision. Measured on the local composition against the pinned Keycloak
26.8.1, 17 November 2026, over the real OIDC protocol. It feeds issue #75; the rule itself belongs
to ADR-0004. -->

# No condition Keycloak ships can see what the arriving source said about an address

**Verdict.** Issue #75's cheapest route is **refused**. Of the seven condition authenticators
Keycloak 26.8.1 ships, only `conditional-user-attribute` could name a verified flag at all — and it
reads the Person already in the database, never the Identity arriving.

**The subflow shape itself works, though.** A `CONDITIONAL` subflow with `deny-access` in a
first-broker-login flow does refuse a sign-in, before anything is linked. Only the condition was
missing. So the ticket's second route shrank to writing one: `broker/verified-email/`.

**Read on only if** you are about to reach for `conditional-user-attribute`, or you need something
else inside a first-broker-login flow to see what the arriving source claimed.

## What was measured

`trustEmail` on, `idp-auto-link` in a flow of ours, a conditional subflow around it. `deny-access`
carries a message, which turns the condition's verdict into a page: the message means it stopped the
join; `Your account is already linked…` means it let the join through.

| Condition, and where | Result |
|---|---|
| `conditional-client-scope`, matching, before the join | Stopped it. **The shape works** |
| `conditional-user-attribute` on `emailVerified`, before the join | Threw before evaluating: no user in the flow yet. The Person reads "Invalid username or password" |
| the same, on `email`, after the join | Stopped it — so what it reads is the existing Person |
| the same, on `emailVerified`, after the join, expecting `true` then `false` | Neither matched. A column, not an attribute it can see |
| the same, on an attribute an Attribute Importer fills from the arriving claim | Did not match. The attribute held `true`, left by the legitimate arrival, while the arrival presented `false` |

The last row closes the route. A mapper runs before the flow but has no user to write to, so what it
imports lands after the flow has already decided. It needs `unmanagedAttributePolicy` enabled too,
which `broker/user-profile.json` does not do.

Keycloak reads the claim in exactly one place: `emailVerified` on a **new** Person is `trustEmail AND
email_verified`. Our condition reads those same two facts, so the two paths cannot drift apart.

## Three things found along the way

**`idp-email-verification` cannot be the mechanism either.** In the Handle Existing Account subflow
it is reached by every duplicate address, verified or not, so it would put a mail challenge in front
of the join that #25 requires to be silent. It is what the refusal hands the Person to once #26
brings SMTP — a leaf, not a route.

**Declaring `authenticationFlows` does not cost the realm its built-in flows.** The client-scope trap
does not repeat: `browser`, `direct grant`, `registration`, `reset credentials`, `clients`, `docker
auth` and the built-in `first broker login` are all still created, and every binding but
`firstBrokerLoginFlow` still points at them.

**A source with no `firstBrokerLoginFlowAlias` uses the realm's `firstBrokerLoginFlow`.** So the rule
is bound once and a source added later cannot miss it.

## The mirror of the rule, which this does not close — issue #88

The condition asks whether the **arriving** Identity's address was affirmed. Nothing asks whether the
**Person** it would join holds that address verified, and `idp-create-user-if-unique` matches on the
address alone.

Measured: a Person created through the source that affirms nothing, then the same address arriving
verified through a source that affirms it. One Person Identifier — the genuine arrival was joined to
the seeded Person. Arriving *first* is the takeover that still works.

Issue #88 owns it, blocked by #26. Take the measurement from here, the commitment from there.
