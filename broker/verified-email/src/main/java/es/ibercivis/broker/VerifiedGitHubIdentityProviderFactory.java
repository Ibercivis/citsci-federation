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
 * <p>{@code github} rather than an id of our own: the login theme picks the
 * button's mark by the provider id, knows no id of ours, and offers no way in
 * short of a theme of our own. {@code broker/README.md} weighs the two, under
 * "The launch sources: Google and GitHub" ({@code issue #225}).
 *
 * <p>Which of the two factories answers to the id is settled rather than
 * raced: {@code docs/notes/2026-11-25-two-provider-factories-under-one-id.md}.
 *
 * <p>{@code tests/github-source.test.ts} is the guard, and the only one: one
 * of its cases fails on the stock provider.
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
   * Above the stock GitHub factory's 0. This is what decides which of the two
   * answers to the id, so it is not a number to tidy away.
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
