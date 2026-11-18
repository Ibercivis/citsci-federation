package es.ibercivis.broker;

import java.util.List;
import org.keycloak.Config;
import org.keycloak.authentication.AuthenticationFlowContext;
import org.keycloak.authentication.authenticators.broker.AbstractIdpAuthenticator;
import org.keycloak.authentication.authenticators.broker.util.SerializedBrokeredIdentityContext;
import org.keycloak.authentication.authenticators.conditional.ConditionalAuthenticator;
import org.keycloak.authentication.authenticators.conditional.ConditionalAuthenticatorFactory;
import org.keycloak.broker.provider.BrokeredIdentityContext;
import org.keycloak.models.AuthenticationExecutionModel.Requirement;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;
import org.keycloak.provider.ProviderConfigProperty;

/**
 * True when the Identity arriving from an Identity Source does <em>not</em>
 * carry an address that source affirmed.
 *
 * <p>The Broker joins a new Identity to the Person who already holds its email
 * address, with nothing asked in between. Keycloak's {@code idp-auto-link}
 * performs that join, and it compares the address and nothing else — it never
 * asks whether anybody affirmed it. Left alone it therefore hands an account
 * to whoever registered under somebody else's address at a source that checks
 * nothing, and then waited for them to arrive.
 *
 * <p>This condition is what stands in front of it. The realm puts it in a
 * conditional subflow ahead of the join; what that subflow then does with the
 * refused arrival is the realm's decision, not this class's. No condition
 * Keycloak ships can take its place: none of them can see what the arriving
 * source said about the address (measured in issue #75, recorded in
 * {@code docs/notes/conditional-subflow-and-brokered-email-verified.md}).
 *
 * <p>Affirmed means here what it means to Keycloak when it creates a Person:
 * the Broker trusts this source's word on addresses ({@code trustEmail}), and
 * the source said it had verified this one ({@code email_verified}). Reading
 * those same two facts is what keeps the rule on the join path from drifting
 * away from the one Keycloak applies on the create path.
 *
 * <p>Whatever it cannot establish counts as unverified: no brokered context,
 * no claim, an unparseable claim, a source whose word is not trusted. Refusing
 * is the safe answer, so uncertainty falls on that side (ADR-0004).
 */
public class UnverifiedEmailCondition
    implements ConditionalAuthenticator, ConditionalAuthenticatorFactory {

  public static final String PROVIDER_ID = "citsci-condition-unverified-email";

  /**
   * Where the arriving claim sits. {@code OIDCIdentityProvider} reads
   * {@code email_verified} off the source's response into the brokered
   * context under this key, and reads it back from there when it creates a
   * Person.
   *
   * <p>No public API promises the key. That is why the image is pinned
   * (broker/Dockerfile) and why {@code tests/verified-email-join.test.ts}
   * drives a real sign-in rather than trusting this constant: an upgrade that
   * moved it would leave this condition finding nothing, which is
   * indistinguishable from an address nobody affirmed.
   */
  private static final String EMAIL_VERIFIED = "email_verified";

  @Override
  public boolean matchCondition(AuthenticationFlowContext context) {
    SerializedBrokeredIdentityContext serialized =
        SerializedBrokeredIdentityContext.readFromAuthenticationSession(
            context.getAuthenticationSession(),
            AbstractIdpAuthenticator.BROKERED_CONTEXT_NOTE);
    if (serialized == null) {
      // No Identity Source in this flow at all. Nothing affirmed the address,
      // so the guarded subflow runs.
      return true;
    }
    BrokeredIdentityContext arrival =
        serialized.deserialize(context.getSession(), context.getAuthenticationSession());
    return !affirmedByItsSource(arrival);
  }

  /** Whether this arrival carries an address its source affirmed, and whose
   *  word on an address the Broker trusts. */
  private static boolean affirmedByItsSource(BrokeredIdentityContext arrival) {
    if (!arrival.getIdpConfig().isTrustEmail()) {
      return false;
    }
    Object claim = arrival.getContextData().get(EMAIL_VERIFIED);
    if (claim instanceof Boolean affirmed) {
      return affirmed;
    }
    // Carried through the authentication session as text, or absent. Only the
    // word "true" affirms anything; absent does not.
    return claim != null && Boolean.parseBoolean(claim.toString());
  }

  /**
   * False, which is what makes this condition usable at all. The decision has
   * to be taken before the join runs, and there is no user in the flow at that
   * point: the arrival is not a Person yet, and the Person it might be joined
   * to has not been set. Keycloak's {@code conditional-user-attribute} demands
   * one, so in this position it makes the flow throw instead of deciding.
   */
  @Override
  public boolean requiresUser() {
    return false;
  }

  @Override
  public void action(AuthenticationFlowContext context) {
    // A condition answers a question; it never puts a page in front of anyone.
  }

  @Override
  public void setRequiredActions(
      KeycloakSession session, RealmModel realm, UserModel user) {
    // Nothing for the Person to do: this asks about the Identity arriving.
  }

  @Override
  public ConditionalAuthenticator getSingleton() {
    return this;
  }

  @Override
  public String getId() {
    return PROVIDER_ID;
  }

  @Override
  public String getDisplayType() {
    return "Condition - the Identity arrives without a Verified Email";
  }

  /** Read in the admin console, by somebody who has never heard of our
   *  decision records. */
  @Override
  public String getHelpText() {
    return "True when the email address this Identity arrives with was not"
        + " verified by the Identity Source it came from, or when that source"
        + " is not trusted to verify addresses. Such an address must not reach"
        + " a Person who already holds it.";
  }

  /** Nothing to configure. A setting here would be a way to switch the rule
   *  off from the admin console. */
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

  @Override
  public void init(Config.Scope config) {
    // Nothing to read: this condition has no configuration.
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
