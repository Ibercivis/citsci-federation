package es.ibercivis.broker;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.keycloak.Config;
import org.keycloak.authentication.AuthenticationFlowContext;
import org.keycloak.authentication.Authenticator;
import org.keycloak.authentication.AuthenticatorFactory;
import org.keycloak.authentication.authenticators.broker.IdpEmailVerificationAuthenticator;
import org.keycloak.authentication.authenticators.broker.util.SerializedBrokeredIdentityContext;
import org.keycloak.broker.provider.BrokeredIdentityContext;
import org.keycloak.models.AuthenticationExecutionModel.Requirement;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;
import org.keycloak.provider.ProviderConfigProperty;
import org.keycloak.sessions.AuthenticationSessionModel;

/**
 * Keycloak's {@code idp-email-verification}, mailing an address the arrival
 * typed on the review page as well as one its source sent.
 *
 * <p>Everything the mail is — the action token, the template, the page saying
 * it was sent, the join on the click — is the authenticator this extends. One
 * thing is taken out: it declines to mail at all when the address was changed
 * on the review page, and then reports {@code attempted()}. Stock Keycloak
 * puts it beside a re-authentication alternative that absorbs that; this realm
 * has no sibling behind the condition, so the subflow failed and the sign-in
 * died on a page reading "Invalid username or password" — an arrival blamed
 * for its credentials over somebody else's address (issue #182).
 *
 * <p>Mailing instead is ADR-0004 unchanged rather than an exception to it. The
 * mail goes to the Person who already holds the address, which is where every
 * other held-back arrival's goes, and it joins on the click. Whoever reads
 * that mailbox can become that Person: the decision took that risk knowingly,
 * and nothing here adds to it. What it costs is the Person's, not the
 * arrival's — a mail they did not ask for, per attempt.
 *
 * <p>The notes are put back before the flow goes on, because
 * {@code AbstractIdentityProvider.updateEmail} reads one of them to decide
 * whether a Person's address counts as verified. This class is changing what
 * one authenticator does with them, not what the server knows.
 */
public class ConfirmAddressByMail
    extends IdpEmailVerificationAuthenticator implements AuthenticatorFactory {

  public static final String PROVIDER_ID = "citsci-confirm-address-by-mail";

  /**
   * Keycloak's mail declines to send when either review-page note is set, so
   * both come off the session for the length of its decision and go back
   * afterwards. Removing nothing would leave the flow on the error page with
   * every case still green, which is why a case drives the page itself
   * ({@code ReviewPageNotes}).
   */
  @Override
  protected void authenticateImpl(
      AuthenticationFlowContext context,
      SerializedBrokeredIdentityContext serializedCtx,
      BrokeredIdentityContext brokerContext) {
    AuthenticationSessionModel authSession = context.getAuthenticationSession();
    Map<String, String> held = new LinkedHashMap<>();
    for (String note : ReviewPageNotes.BOTH) {
      String value = authSession.getAuthNote(note);
      if (value != null) {
        held.put(note, value);
      }
      authSession.removeAuthNote(note);
    }
    try {
      super.authenticateImpl(context, serializedCtx, brokerContext);
    } finally {
      held.forEach(authSession::setAuthNote);
    }
  }

  @Override
  public Authenticator create(KeycloakSession session) {
    return this;
  }

  @Override
  public String getId() {
    return PROVIDER_ID;
  }

  @Override
  public String getDisplayType() {
    return "Confirm this address by mail, whoever named it";
  }

  /** Read in the admin console, by somebody who has never heard of our
   *  decision records. */
  @Override
  public String getHelpText() {
    return "Mails the address this Identity is arriving at and joins it to the"
        + " Person holding that address when the link is followed. Keycloak's"
        + " own version of this skips the mail when the address was changed on"
        + " the review page, which leaves an arrival with nowhere to go.";
  }

  @Override
  public String getReferenceCategory() {
    return null;
  }

  @Override
  public boolean isConfigurable() {
    return false;
  }

  @Override
  public List<ProviderConfigProperty> getConfigProperties() {
    return List.of();
  }

  @Override
  public Requirement[] getRequirementChoices() {
    return new Requirement[] {Requirement.REQUIRED, Requirement.DISABLED};
  }

  @Override
  public boolean isUserSetupAllowed() {
    return false;
  }

  /** True: there is nothing about a Person that this needs set up first. The
   *  address it mails is the one in the flow. */
  @Override
  public boolean configuredFor(
      KeycloakSession session, RealmModel realm, UserModel user) {
    return true;
  }

  @Override
  public void init(Config.Scope config) {
    // Nothing to read: this authenticator has no configuration.
  }

  @Override
  public void postInit(KeycloakSessionFactory factory) {
    // Nothing to wire up.
  }

  @Override
  public void close() {
    // Nothing held open.
  }
}
