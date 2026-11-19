# What an integration is held to

Scope: adding a Brokered App, and any change to the Broker made because of one. Read it **before**
writing the integration, not while reviewing it.

## Three criteria, and the order they are weighed in

1. **Security.** The Broker's refusals hold: code flow with PKCE S256, no implicit grant, every
   confidential client authenticated, consent on every client. No integration relaxes one of these
   for its own convenience.
2. **Extensibility.** The fourth Identity Source and the fourth Brokered App cost what the third
   did. A change that adds a step per application, or per source, is the thing to argue against.
3. **The cost to the application.** The spec's promise is that adding a Brokered App is *adding
   declared configuration here*. Code we write in somebody else's production repository is the
   expensive currency: it is security-sensitive, it is maintained by people who did not ask for it,
   and it is paid again by every application that follows.

They are weighed in that order, and (1) is not traded away. But (2) and (3) are not tie-breakers
either — when a rule of ours can only be satisfied by hand-written protocol code in every
application, that is evidence against the rule, and ADR-0016 is where that argument was made and
won.

## The questions an integration answers, in its pull request

- **Every line of code we added to their repository, and why configuration could not do it.** A
  provider entry, a settings block and a template are configuration. A subclass that implements
  part of a protocol is not, and needs this answer.
- **What the application stores**: the Person Identifier and nothing about the Identity Source.
- **What it verifies**, and what it does not. A server-rendered application that takes the identity
  from `userinfo` over the back channel verifies no signature; say so rather than citing the
  criterion.
- **What the integration did not change**: the sign-in that already existed, and what anonymous use
  allows. Both measured, not assumed (ADR-0006, ADR-0007).
- **Who checks by hand the part the Broker cannot see** — registration being closed, above all.

## The criteria are asserted, not only written

A hardening suite that asserts only refusals cannot tell that what is refused is unsafe requests
rather than ordinary ones. So `tests/hardening.test.ts` carries, beside each refusal, **the request
a mainstream library actually sends** — and asserts it is accepted. When a new application family
arrives with a different library, its request shape joins those cases.

That is what turns "our hardening does not lock out ordinary clients" into something CI answers,
instead of something the next integration discovers.

## Where the vocabulary rule sits

`external-repos.md` governs what we may call things in their repository, and it binds the pull
request body as much as the code. Nothing here overrides it: an integration that meets all three
criteria in our words still has to be explained in theirs.
