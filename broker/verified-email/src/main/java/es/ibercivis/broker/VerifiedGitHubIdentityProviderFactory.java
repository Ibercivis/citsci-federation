package es.ibercivis.broker;

import org.keycloak.broker.oidc.OAuth2IdentityProviderConfig;
import org.keycloak.models.IdentityProviderModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.social.github.GitHubIdentityProvider;
import org.keycloak.social.github.GitHubIdentityProviderFactory;

/**
 * Registers {@link VerifiedGitHubIdentityProvider} under Keycloak's own id for
 * GitHub, in place of the stock provider.
 *
 * <p>{@code github} rather than an id of our own, because the login theme
 * draws GitHub's mark only for that id. It reads the provider id and never the
 * alias, so a realm declaring a source of ours gets the generic mark on the
 * button whatever the alias is called ({@code issue #225}).
 *
 * <p>Two factories under one id is settled and not left to chance: Keycloak
 * keeps the higher {@code order()}, documented as the way to replace a
 * provider it ships, and the stock factory sets none. At equal order ours
 * would still win, as the one outside the {@code org.keycloak} packages. Both
 * measured in
 * {@code docs/notes/2026-11-25-two-provider-factories-under-one-id.md}.
 *
 * <p>Keycloak reports the collision at debug level, so a rebuild resolving it
 * the other way would say nothing. {@code tests/github-source.test.ts} is the
 * guard: one of its cases fails on the stock provider.
 */
public class VerifiedGitHubIdentityProviderFactory extends GitHubIdentityProviderFactory {

  public static final String PROVIDER_ID = "github";

  @Override
  public String getName() {
    return "GitHub, verified addresses only";
  }

  @Override
  public GitHubIdentityProvider create(KeycloakSession session, IdentityProviderModel model) {
    return new VerifiedGitHubIdentityProvider(session, new OAuth2IdentityProviderConfig(model));
  }

  /**
   * Above the stock GitHub factory's, which is the interface default of 0.
   * This is what decides the id, so it is not a number to tidy away.
   */
  @Override
  public int order() {
    return 1;
  }

  @Override
  public String getId() {
    return PROVIDER_ID;
  }
}
