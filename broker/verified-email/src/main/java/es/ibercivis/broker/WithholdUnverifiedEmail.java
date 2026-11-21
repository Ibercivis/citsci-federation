package es.ibercivis.broker;

import java.util.List;
import org.keycloak.Config;
import org.keycloak.authentication.AuthenticationFlowContext;
import org.keycloak.authentication.AuthenticationFlowError;
import org.keycloak.authentication.Authenticator;
import org.keycloak.authentication.AuthenticatorFactory;
import org.keycloak.authentication.authenticators.broker.AbstractIdpAuthenticator;
import org.keycloak.authentication.authenticators.broker.util.SerializedBrokeredIdentityContext;
import org.keycloak.broker.provider.BrokeredIdentityContext;
import org.keycloak.models.AuthenticationExecutionModel.Requirement;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;
import org.keycloak.provider.ProviderConfigProperty;

/**
 * Takes the email address off a Person the Broker has just created for an
 * Identity whose source did not affirm it, and has the Broker ask for an
 * address and confirm it by mail instead.
 *
 * <p>A Person holds a Verified Email or none at all. That is what makes the
 * address safe to join on: {@code idp-create-user-if-unique} matches an
 * arriving Identity against it and asks nothing else, exactly as
 * {@code idp-auto-link} does. Leave an unaffirmed address on a Person and the
 * takeover ADR-0004 refuses works by arriving <em>first</em>: take an address
 * at a source that checks nothing, and its genuine holder's verified arrival
 * lands on the Person you made (issue #88).
 *
 * <p>Nothing here is ever done to a Person who already existed. This runs on
 * the create path of the first broker login flow, on the Person that path has
 * just made, in the same request and therefore the same transaction: no
 * committed Person ever holds an address nobody affirmed, and no other flow
 * can see one in between.
 *
 * <p>Two things here are not obvious and are measured in
 * {@code docs/notes/2026-11-20-withholding-an-unaffirmed-address.md}, which is
 * the first thing to read before changing any of it. The username goes with
 * the address, because this realm signs in with the address as the username
 * and the next arrival is matched on that column too. And the address is
 * removed from the brokered context as well as from the Person, because the
 * request after this one writes the Person again from that context.
 *
 * <p>ADR-0004 has the rule, what it rules out, and what it still leaves open.
 */
public class WithholdUnverifiedEmail
    extends AbstractIdpAuthenticator implements AuthenticatorFactory {

  public static final String PROVIDER_ID = "citsci-withhold-unverified-email";

  /**
   * The note {@code idp-create-user-if-unique} leaves behind when the Person
   * in this flow is one it has just made. It is what keeps this rule off a
   * Person who already existed: the realm only reaches here with an
   * unaffirmed address on the create path today, because the join path
   * refuses one before {@code idp-auto-link}, but that refusal is meant to be
   * replaced by a confirmation one day (ADR-0004) and this execution must not
   * start taking addresses off strangers when it is.
   *
   * <p>No public API promises the note, which is the reason the image is
   * pinned (broker/Dockerfile) and the reason the cases in
   * {@code tests/verified-email-join.test.ts} drive a real sign-in: a version
   * that renamed it would leave this finding nothing, and finding nothing here
   * means an address is kept.
   */
  private static final String REGISTERED_BY_THIS_FLOW = "BROKER_REGISTERED_NEW_USER";

  /**
   * What the Broker asks a Person with no address for. It writes nothing
   * until the link it mails is followed, which is the whole reason it is this
   * action and not {@code VERIFY_EMAIL}: that one confirms an address the
   * Person is already holding, and holding it is what must not happen.
   *
   * <p>Adding it also keeps {@code VERIFY_EMAIL} away. Keycloak evaluates that
   * trigger after the flow, and skips it both for a Person with no address and
   * for one already asked to update it.
   */
  private static final UserModel.RequiredAction ASK_FOR_AN_ADDRESS =
      UserModel.RequiredAction.UPDATE_EMAIL;

  @Override
  protected void authenticateImpl(
      AuthenticationFlowContext context,
      SerializedBrokeredIdentityContext serializedCtx,
      BrokeredIdentityContext brokerContext) {
    if (!Boolean.parseBoolean(
        context.getAuthenticationSession().getAuthNote(REGISTERED_BY_THIS_FLOW))) {
      // This Identity joined a Person who was already there. Their address is
      // not this arrival's to take away, whatever its own source affirmed.
      context.success();
      return;
    }

    UserModel person = context.getUser();
    if (person == null) {
      // A Person was registered and is not in the flow: the two facts
      // contradict each other, and carrying on would leave the address on
      // whoever does hold it. Nothing here guesses which.
      context.failure(AuthenticationFlowError.INTERNAL_ERROR);
      return;
    }

    person.setUsername(person.getId());
    person.setEmail(null);
    person.addRequiredAction(ASK_FOR_AN_ADDRESS);

    serializedCtx.setEmail(null);
    serializedCtx.saveToAuthenticationSession(
        context.getAuthenticationSession(), BROKERED_CONTEXT_NOTE);

    context.success();
  }

  /**
   * False, as it is for every authenticator on this path. The Person exists by
   * now — the execution before this one made them — but Keycloak reads this to
   * decide whether to go looking for one itself, and on the first broker login
   * flow there is nobody to look up.
   */
  @Override
  public boolean requiresUser() {
    return false;
  }

  /** True: there is nothing about a Person that this rule needs set up first.
   *  It asks about the Identity that arrived. */
  @Override
  public boolean configuredFor(
      KeycloakSession session, RealmModel realm, UserModel user) {
    return true;
  }

  @Override
  protected void actionImpl(
      AuthenticationFlowContext context,
      SerializedBrokeredIdentityContext serializedCtx,
      BrokeredIdentityContext brokerContext) {
    // This puts no page in front of anyone, so nothing is ever submitted back
    // to it. The page that asks for an address is Keycloak's own required
    // action, after the flow.
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
    return "Withhold an address the Identity's source did not verify";
  }

  /** Read in the admin console, by somebody who has never heard of our
   *  decision records. */
  @Override
  public String getHelpText() {
    return "Takes the email address off the Person just created for this"
        + " Identity, and asks them for one the Broker confirms by mail. A"
        + " Person holding an address nobody verified would be joined to by"
        + " the next Identity arriving at it.";
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
