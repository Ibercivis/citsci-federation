<!-- Research note, not a decision. Measured on the local Broker against the pinned Keycloak 26.8.1,
20 November 2026, over the real OIDC protocol and read back from the Broker's own database. It feeds
issue #88; the rule itself belongs to ADR-0004. -->

# Keycloak will not create a Person without an address, so the address is taken off afterwards

**Verdict.** "No Person is ever created at an address nobody affirmed" — the sentence issue #88
proposed — is **not available on this provider**. The realm signs in with the address as the
username, and `IdpCreateUserIfUniqueAuthenticator.getUsername` therefore reads the username off the
address: an arrival carrying none makes it set `ENFORCE_UPDATE_PROFILE` and reset the flow, which
asks the Person for an address and then writes whatever they typed, unaffirmed. What is available is
one step later and holds the same property: the address is taken off the Person **in the request
that created them**, so nothing committed ever holds an address nobody affirmed.

**Read on only if** you are changing `broker/verified-email/`, costing a change to the create path
of the first broker login flow, or about to trust that a Person's address was affirmed by somebody.

## Why the address has to be removed from two places

Taking it off the Person is not enough. `IdentityBrokerService.afterFirstBrokerLogin` runs in the
**next** request and writes the Person again from the brokered context, so an address removed from
the Person alone comes back. Measured: the username stayed as the Person's id and the address
returned.

So `WithholdUnverifiedEmail` removes it from the brokered context as well. Removing it from the
context alone is not enough either, and for the reason in the verdict: that is the value the
username is read from.

## The username goes with the address

A Person whose username is still `someone@example.com` is matched on that username by the next
arrival, and joined to. `checkExistingUser` reads both columns, so leaving the username behind is
the same takeover through the other one. It is replaced by the Person's own id.

Keycloak puts it right itself when the Broker's own confirmation arrives: `UPDATE_EMAIL` writes the
address **and** the username, because the realm signs in with the address as the username. Measured
— a Person who confirmed `<uuid>@newcomer.test` holds it in both columns.

## What Keycloak does with `VERIFY_EMAIL`, which is why `UPDATE_EMAIL` is the action asked for

`VerifyEmail.evaluateTriggers` skips itself twice over: for a Person with no address, and for one
already carrying `UPDATE_EMAIL`. So the two actions do not fight, and the Person is asked the only
question that can be answered — give me an address — rather than asked to confirm one they are
already holding.

`UPDATE_EMAIL` writes nothing until the link is followed. That is what makes it the whole mechanism
rather than a form: between the question and the answer, nobody holds the address.

`emailVerified` is left alone, and does not need clearing. Keycloak sets it in the request after
this one, from the arriving Identity: false for a source the Broker does not trust, and the claim's
own value for one it does. So no `email_verified: true` survives on a Person with no address.

## The flow shape that does not work

Wrapping `idp-create-user-if-unique` in a subflow of its own and making it `REQUIRED` breaks the
fallthrough to the join path. Required, it answers a duplicate with a `CONFLICT` page — "User with
email … already exists. Please login to account management to link the account" — instead of
`attempted()`. It has to stay `ALTERNATIVE`, beside the join subflow, which is why the rule sits at
the end of the top-level flow and reads `BROKER_REGISTERED_NEW_USER` to know which path it is on.

## What is left behind by an arrival that never answers the mail

Measured 23 November 2026, same Broker: two arrivals of one Identity through the source that affirms
nothing, the mail left unanswered between them.

After the first, one Person — username set to their own id, no address, `email_verified` false,
`UPDATE_EMAIL` pending — and `federated_identity` **written**, pointing at the source's username.
`IdentityBrokerService.afterFirstBrokerLogin` writes that link in the request after the flow whether
or not the flow finished, which is the fact the whole question turns on.

The second arrival therefore reaches that same Person: same id, same `created_timestamp`, no second
row, and Keycloak puts them back on the `UPDATE_EMAIL` page. So an abandoned arrival accumulates
nothing, and the Person is reachable by the only thing that identifies them — their Identity Source.
No token either way.

Keycloak also rate-limits its own resend — "You must wait 29 seconds before resending" — so the
second arrival mailed nothing. Worth knowing before costing anything that counts the Broker's mails.

## The half this does not close: the Broker's own registration

A Local Credential registration creates the Person at the typed address before the mail is answered,
and that Person **does** absorb a later verified arrival at it. Measured on a clean Broker: register
at `squat@mock.test`, do not confirm, then arrive verified through a trusted source — one Person,
`federated_identity` pointing at the registered one, and the genuine holder stopped on "verify your
email" until they follow the link in their own mailbox.

What the squatter gets out of it is not access: that Person holds `VERIFY_EMAIL` and
`UPDATE_PASSWORD` both pending, so there is no credential and no way to set one without the mailbox.
What they do get is the victim's Person made for them, and an extra confirmation in the victim's way.
`issue #148` owns it.

## The cost of the rule, for a source that affirms no address at all

ORCID sends none, so `idp-review-profile` asks for one, the create path writes it, and this rule
takes it off again — leaving the Person asked for an address **twice** in one sign-in. It cannot be
avoided from the realm: Keycloak needs a username before it will create anybody, and the username is
the address. Worth settling before ORCID is added (`issue #19`).
