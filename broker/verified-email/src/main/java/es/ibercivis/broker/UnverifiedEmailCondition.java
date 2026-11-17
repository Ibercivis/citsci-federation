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
 * True when the Identity in front of the Broker does <em>not</em> arrive with
 * a Verified Email.
 *
 * <p>This is the mechanism behind ADR-0004's negative direction. The positive
 * direction is Keycloak's: {@code idp-auto-link} matches an arriving Identity
 * against a Person by email address and joins them. It matches on the address
 * alone and never asks whether the source affirmed it, so the configuration
 * that delivers the merge also delivers the account takeover ADR-0004 exists
 * to refuse — register under somebody else's address at a source that affirms
 * nothing, and wait for them to arrive. Issue #75 measured that, and measured
 * that no condition Keycloak ships can see the arriving claim
 * ({@code docs/notes/conditional-subflow-and-brokered-email-verified.md}).
 *
 * <p>So the rule is stated here instead, in a condition of our own, and the
 * realm puts it in front of {@code idp-auto-link} in a conditional subflow.
 * What the guarded subflow then does to the unverified arrival is the realm's
 * decision and not this class's.
 *
 * <p><strong>Verified means the same thing it means to Keycloak.</strong> On
 * the pinned version, the {@code emailVerified} of a Person created by a first
 * arrival is {@code trustEmail AND email_verified}: the source is one the
 * Broker trusts to affirm addresses, <em>and</em> that source affirmed this
 * one. This condition reads those same two facts, so the rule enforced on the
 * join path is the rule Keycloak applies on the create path, rather than a
 * second opinion that could drift from it.
 *
 * <p>Anything it cannot establish counts as unverified: no brokered context,
 * no claim, an unparseable claim, a source whose word is not trusted. ADR-0004
 * says an unverified email joins nothing, ever, so the failure of this class to
 * find an affirmation has to fall on the side of refusing to join.
 */
public class UnverifiedEmailCondition
    implements ConditionalAuthenticator, ConditionalAuthenticatorFactory {

  public static final String PROVIDER_ID = "citsci-condition-unverified-email";

  /**
   * Where the arriving claim is, on the pinned Keycloak. {@code
   * OIDCIdentityProvider} reads {@code email_verified} from the source's
   * response and puts it in the brokered context under this key; its own
   * {@code setEmailVerified} reads it back from there when it creates a
   * Person. Nothing in Keycloak's advertised API promises this key, which is
   * why the version is pinned (broker/Dockerfile) and why the cases in
   * {@code tests/verified-email-join.test.ts} drive a real sign-in: an upgrade
   * that renamed it would leave this condition finding nothing, and finding
   * nothing is indistinguishable from an unverified address.
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
   * False, and that is what makes this condition usable at all. The decision
   * has to be taken <em>before</em> {@code idp-auto-link} runs, and at that
   * point the flow has no user: the arriving Identity is not a Person yet and
   * the Person it would be joined to is not in the context. Keycloak's
   * {@code conditional-user-attribute} requires one, which is why putting it
   * there makes the flow throw rather than decide (issue #75).
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

  @Override
  public String getHelpText() {
    return "True when the arriving Identity's address was not affirmed by a"
        + " source the Broker trusts to affirm addresses. ADR-0004: an"
        + " unverified email joins no existing Person, ever.";
  }

  /** Nothing to configure. The rule is one rule, and a knob here would be a
   *  way to turn ADR-0004 off from a console. */
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
