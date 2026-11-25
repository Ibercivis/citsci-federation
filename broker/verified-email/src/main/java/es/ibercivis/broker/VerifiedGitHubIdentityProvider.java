package es.ibercivis.broker;

import com.fasterxml.jackson.databind.JsonNode;
import org.keycloak.broker.oidc.OAuth2IdentityProviderConfig;
import org.keycloak.broker.provider.BrokeredIdentityContext;
import org.keycloak.http.simple.SimpleHttp;
import org.keycloak.http.simple.SimpleHttpResponse;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.UserModel;
import org.keycloak.representations.IDToken;
import org.keycloak.social.github.GitHubIdentityProvider;

/**
 * Keycloak's GitHub provider, made to say whether GitHub verified the address
 * it hands over.
 *
 * <p>GitHub is not an OpenID provider and sends no {@code email_verified}.
 * What it says about an address is the {@code verified} field of its
 * {@code /user/emails} list. The provider this extends takes the primary
 * address from that list and never reads the field, and on a source the Broker
 * trusts that makes every address it hands over count as confirmed — including
 * one a GitHub account typed and never confirmed (ADR-0004).
 *
 * <p>So this does what {@code OIDCIdentityProvider} does with the claim: puts
 * GitHub's answer into the brokered context under {@code email_verified},
 * where {@link UnverifiedEmailCondition} reads it on the join, and reads it
 * back in {@link #setEmailVerified} on the create. Both paths then rest on the
 * same fact.
 *
 * <p>Whatever cannot be established counts as unverified: an address not in
 * the list, a list that cannot be read. Refusing is the safe answer.
 */
public class VerifiedGitHubIdentityProvider extends GitHubIdentityProvider {

  public VerifiedGitHubIdentityProvider(
      KeycloakSession session, OAuth2IdentityProviderConfig config) {
    super(session, config);
  }

  @Override
  protected BrokeredIdentityContext doGetFederatedIdentity(String accessToken) {
    BrokeredIdentityContext arrival = super.doGetFederatedIdentity(accessToken);
    arrival
        .getContextData()
        .put(IDToken.EMAIL_VERIFIED, verifiedAtGitHub(accessToken, arrival.getEmail()));
    return arrival;
  }

  /** Whether GitHub's own list marks this address verified. */
  private boolean verifiedAtGitHub(String accessToken, String address) {
    if (address == null) {
      return false;
    }
    String emailUrl = getConfig().getConfig().get(EMAIL_URL_KEY);
    try (SimpleHttpResponse response =
        SimpleHttp.create(session)
            .doGet(emailUrl)
            .header("Authorization", "Bearer " + accessToken)
            .header("Accept", "application/json")
            .asResponse()) {
      if (response.getStatus() != 200) {
        return false;
      }
      for (JsonNode entry : response.asJson()) {
        if (address.equalsIgnoreCase(entry.path("email").asText())) {
          return entry.path("verified").asBoolean(false);
        }
      }
      return false;
    } catch (Exception unreadable) {
      return false;
    }
  }

  /** As {@code OIDCIdentityProvider} does: on a trusted source, the address
   *  is as verified as the source said it was, and no more. */
  @Override
  protected void setEmailVerified(UserModel user, BrokeredIdentityContext context) {
    Object verified = context.getContextData().get(IDToken.EMAIL_VERIFIED);
    if (!Boolean.TRUE.equals(getConfig().isTrustEmail())
        || !(verified instanceof Boolean affirmed)) {
      super.setEmailVerified(user, context);
      return;
    }
    user.setEmailVerified(affirmed);
  }
}
