package es.ibercivis.broker;

import org.keycloak.broker.oidc.OAuth2IdentityProviderConfig;
import org.keycloak.models.IdentityProviderModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.social.github.GitHubIdentityProvider;
import org.keycloak.social.github.GitHubIdentityProviderFactory;

/**
 * Registers {@link VerifiedGitHubIdentityProvider} under an id of its own.
 *
 * <p>Its own id rather than {@code github}: two factories under one id leave
 * Keycloak to pick one, and a realm declaring {@code github} would then get
 * whichever won. A realm that wants GitHub's {@code verified} read names this
 * id, and nothing else changes: the configuration is the stock provider's.
 */
public class VerifiedGitHubIdentityProviderFactory extends GitHubIdentityProviderFactory {

  public static final String PROVIDER_ID = "citsci-github";

  @Override
  public String getName() {
    return "GitHub, verified addresses only";
  }

  @Override
  public GitHubIdentityProvider create(KeycloakSession session, IdentityProviderModel model) {
    return new VerifiedGitHubIdentityProvider(session, new OAuth2IdentityProviderConfig(model));
  }

  @Override
  public String getId() {
    return PROVIDER_ID;
  }
}
