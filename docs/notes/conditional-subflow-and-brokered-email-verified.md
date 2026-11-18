<!-- Research note, not a decision. Measured against the pinned Keycloak 26.8.1 on the local
composition, 17 November 2026, driving the real OIDC protocol through the Mock Identity Source. The
decision this note feeds is issue #75; the authority over the rule is ADR-0004. -->

# No shipped condition authenticator reaches the brokered `email_verified`

**Verdict.** Issue #75's cheapest route is **refused**. A conditional subflow ahead of
`idp-auto-link` cannot read what the arriving Identity's source said about the address, so it cannot
enforce ADR-0004's negative direction. Of the seven condition authenticators Keycloak 26.8.1 ships,
only `conditional-user-attribute` could name a verified flag at all, and it reads the **existing
Person**, never the arrival — measured three ways below, including with an Attribute Importer
helping it.

One finding points the other way and shapes what replaces the route: **the subflow shape itself
works.** A `CONDITIONAL` subflow carrying `deny-access` inside a first-broker-login flow does refuse
the sign-in, before any link row is written. What is missing is a condition that reads the right
datum — which is issue #75's second route, our own authenticator, narrowed from "replace
`idp-auto-link`" to "supply the condition the subflow is missing".

**Read on only if** you are costing #75's routes, defending the rule the Broker ends up with, or
about to reach for `conditional-user-attribute` for something else.

## How it was measured

The merge configuration of #25 — `trustEmail` on, a first-broker-login flow of our own carrying
`idp-auto-link` — built on the live local stack through the Admin API, with a conditional subflow
inserted around it. `deny-access` carries a configured message, which makes the condition's verdict
a page a Brokered App's Person would read: the message appears when the condition matched, and the
merge proceeds when it did not.

One Identity Source is enough for this, even though a merge cannot complete through one (#24: the
`federated_identity` primary key refuses a second Identity from the same source). The flow runs to
completion first and the link fails afterwards, in `afterFirstBrokerLogin`, so the flow's own
decision is observable: `Your account is already linked…` means the condition let the merge through,
and the configured deny message means it stopped it.

## What each position gives

| Condition, and where | What happened |
|---|---|
| `conditional-client-scope`, matching, ahead of `idp-auto-link` | The deny message. **The shape works**: a conditional subflow refuses the sign-in and nothing is linked |
| `conditional-user-attribute` on `emailVerified`, ahead of `idp-auto-link` | `AuthenticationFlowException` before the condition is evaluated — no user is in the context yet. The Person reads "Invalid username or password" |
| `conditional-user-attribute` on `email`, after `idp-auto-link` | The deny message. The condition is evaluated here, and what it reads is the **existing Person** |
| `conditional-user-attribute` on `emailVerified`, after `idp-auto-link`, expecting `true` and then `false` | Neither matched. `emailVerified` is a column, not an attribute the condition can see |
| the same, on an attribute an Attribute Importer fills from the brokered `email_verified` | Did not match. The attribute held `true` — what the **legitimate** arrival left behind — while the arriving Identity presented `false` |

The last row is the one that closes the route. A mapper's `preprocessFederatedIdentity` runs before
the flow but has no user to write to; what it imports lands after the flow has decided. So the
condition reads a Person's history, never the arrival in front of it. The mapper does work —
`brokeredEmailVerified: ["true"]` on the Person created by the verified arrival — but only once
`unmanagedAttributePolicy` is enabled, which `broker/user-profile.json` does not do, and which is a
second reason not to build on it.

## Route 3 is refused as a route, and kept as a leaf

`idp-email-verification` in the Handle Existing Account subflow is reached by *every* duplicate
address, verified or not, so it would put a mail challenge in front of the merge #25 exists to
demonstrate — which that ticket forbids. Selecting the unverified case needs a condition that reads
the arrival, and no shipped one does. So route 3 cannot be the mechanism; it can only be what the
mechanism hands the refused Identity to, once #26 brings SMTP.

**Route 2 was taken**: `broker/verified-email/`, in the conditional subflow whose shape the first
row above shows works. Narrower than the ticket costed it — the condition is all that was missing,
not a replacement for `idp-auto-link`.

## Two things the declaration itself turned up

**Declaring `authenticationFlows` does not cost the realm its built-in flows.** The client-scope
trap does not repeat here: a realm that declares one client scope must declare them all, and the
same was expected of flows. Measured on 26.8.1 — `browser`, `direct grant`, `registration`, `reset
credentials`, `clients`, `docker auth` and the built-in `first broker login` are all still created
from a realm file that declares three flows of its own, and every binding but
`firstBrokerLoginFlow` still points at them.

**An Identity Source with no `firstBrokerLoginFlowAlias` uses the realm's `firstBrokerLoginFlow`.**
So the rule is bound once, at the realm, and a source added later cannot miss it by omission.

## The mirror of the rule is still open, and it is the bigger hole

Found while measuring this, outside issue #75's criteria and not closed by it. The condition asks
whether the **arriving** Identity carries a Verified Email. Nothing asks whether the **Person** it
would join holds that address verified — and `idp-create-user-if-unique` matches on the address
alone, exactly as `idp-auto-link` does.

Measured on the same stack: a Person created through the source that affirms nothing, at
`shared@mock.test`, and then the same address arriving **verified** through a source that affirms
it. One Person Identifier. The genuine arrival was joined to the seeded Person.

So the takeover ADR-0004 names — "register with a password under somebody else's address and wait
for them to arrive" — still works, by arriving *first* instead of second. In the pilot's own
configuration the vector is ORCID, which affirms no address at all: `idp-review-profile` asks the
Person for one, nothing confirms it, and a Person exists at whatever was typed. Local Credentials
(ADR-0005) are the same shape.

Refusing the verified arrival instead is not the fix: it hands an attacker a lockout of whoever
really holds the address. What closes it is the behaviour ADR-0004 already describes — a source
that affirms nothing causes the Broker to **ask for an address and confirm it by mail** — so no
Person is ever created at an unaffirmed address in the first place. That is SMTP, and #26.

The hole has a ticket of its own, `issue #88`, blocked by that one. Take the measurements from here;
take what is owed from there.

## The one place Keycloak does read the flag

`emailVerified` on a *new* Person is `trustEmail AND email_verified`, taken from the brokered
context. That is the datum the rule needs, and Keycloak consults it only when creating — never on
the path where an existing Person is matched by address. `idp-auto-link` matches on the address and
asks nothing else, which is what issue #75 reports.
