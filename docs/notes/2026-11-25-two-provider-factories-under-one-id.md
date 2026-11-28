<!-- Research note, not a decision. Read and measured 25 November 2026 on `quay.io/keycloak/keycloak:26.8.1`. -->

# Two provider factories under one provider id

**Verdict.** Keycloak 26.8.1 settles it by `order()`, and the stock factory's order is 0. A custom
factory returning a higher one wins, which is what the Server Development Guide prescribes for
overriding a built-in provider. At equal order it still wins: the tiebreak prefers the factory whose
package is not `org.keycloak`. Measured both ways. Registering
`VerifiedGitHubIdentityProviderFactory` under the id `github` is therefore deterministic, and
`issue #225`'s worry — that a rebuild could silently put the stock provider back — is not available
as an argument against it.

**Read on only if** a factory of ours is claiming an id Keycloak ships, you are touching `order()`
on the GitHub provider, or you are writing the test that holds such an override in place.

## Where the collision is settled

`services/src/main/java/org/keycloak/provider/ProviderManager.java`, `load(Spi)` and
`compareFactories`.

Factories are keyed on `spi.getName() + "-" + getId()`, so two under one id collide.
`compareFactories` then picks, in this order:

1. the higher `order()`;
2. the one whose package does not start with `org.keycloak` —
   `DefaultKeycloakSessionFactory.isInternal` is that string test, and the comment above the branch
   reads "Internal factory is supposed to be overriden by custom factory";
3. whichever was loaded first.

Only step 3 is classpath order, and nothing here reaches it: our package is `es.ibercivis.broker`.

The collision is reported with `logger.debugf`, so at the default log level a rebuild that resolved
it the other way would say nothing at all. A test is the only guard.

Resolution happens at `kc.sh build`, not at start-up: `KeycloakProcessor.loadFactories` is what
calls `pm.load(spi)`, and it puts the survivor into a build-time map. The winner is fixed into the
image.

## What the documentation says

Server Development Guide, *Override built-in providers*: when a provider id has to be preserved, "it
is highly recommended to implement method `order()` of your custom implementation and make sure that
it has higher order than the built-in implementation", and "in case of multiple implementations with
same provider ID, only the one with highest order will be used by Keycloak runtime".

`ProviderFactory.order()` itself carries no javadoc. The SPI does not say what it is for; that guide
is where it is written down.

Neither `GitHubIdentityProviderFactory` nor `AbstractIdentityProviderFactory` overrides `order()`,
so the stock provider sits at the interface default of 0.

## Measured

`getId()` returning `github`, built into the image:

| `order()` | `providers.social.providers` in `/admin/serverinfo` | factory serving `github` |
| --- | --- | --- |
| `1` | `github` at order 1, no `citsci-github` | GitHub, verified addresses only |
| absent, so 0 | `github` at order 0, no `citsci-github` | GitHub, verified addresses only |

`GET /admin/realms/citsci/identity-provider/providers/github` returns the winning factory's
`getName()`. That is how a test sees which class is in use without a sign-in, and the stock one
answers `GitHub`.

With `order()` at 1, the realm declaring `github` for both the launch source and the testing mock,
and a fresh import, `tests/github-source.test.ts` passes.

## What the stock provider does to that suite

The negative control: our factory back on `citsci-github` while the realm still declared `github`,
so the stock one served it. **One case fails** — "is a Person straight away at an address nobody
holds". The unverified cases pass, and so does the join onto a Person who already holds the
address.

That one case is what a test guarding the override has to carry. It also says which way a regression
would break: a GitHub arrival GitHub did verify is asked for its address by mail, rather than an
unverified one being let through. Fail-safe, with `UnverifiedEmailCondition` installed.
