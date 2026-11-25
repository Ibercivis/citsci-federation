package es.ibercivis.broker;

import com.fasterxml.jackson.databind.JsonNode;
import org.jboss.logging.Logger;
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
 * <p>Whatever cannot be established counts as unverified, on both paths: an
 * address not in the list, a list that cannot be read, a verdict the create
 * path cannot read back. Both read it through
 * {@link UnverifiedEmailCondition#saysVerified}. Refusing is the safe answer.
 */
public class VerifiedGitHubIdentityProvider extends GitHubIdentityProvider {

  /**
   * Says why a list could not be read. Unverified is the right answer then,
   * but its only symptom is every GitHub arrival being mailed, which a wrong
   * {@code apiUrl} or a token without {@code user:email} would cause too. The
   * address is never logged: it is personal data, and the URL and the status
   * are what the diagnosis needs.
   */
  private static final Logger LOG = Logger.getLogger(VerifiedGitHubIdentityProvider.class);

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
        LOG.warnf(
            "GitHub's email list at %s answered %d, so the address counts as unverified.",
            emailUrl, response.getStatus());
        return false;
      }
      for (JsonNode entry : response.asJson()) {
        if (address.equalsIgnoreCase(entry.path("email").asText())) {
          return entry.path("verified").asBoolean(false);
        }
      }
      return false;
    } catch (Exception unreadable) {
      LOG.warnf(
          unreadable,
          "GitHub's email list at %s could not be read, so the address counts as unverified.",
          emailUrl);
      return false;
    }
  }

  /**
   * On a trusted source, the address is as verified as GitHub said it was, and
   * no more. Unlike {@code OIDCIdentityProvider}, a verdict that cannot be read
   * back does not fall to Keycloak's default, which on a trusted source would
   * store it verified: the create path runs on a context carried through the
   * authentication session, where it may come back as text.
   */
  @Override
  protected void setEmailVerified(UserModel user, BrokeredIdentityContext context) {
    if (!getConfig().isTrustEmail()) {
      super.setEmailVerified(user, context);
      return;
    }
    user.setEmailVerified(
        UnverifiedEmailCondition.saysVerified(
            context.getContextData().get(IDToken.EMAIL_VERIFIED)));
  }
}
