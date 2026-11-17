package es.ibercivis.broker;

import java.util.ArrayList;
import java.util.List;
import org.keycloak.models.ProtocolMapperModel;
import org.keycloak.models.UserSessionModel;
import org.keycloak.protocol.oidc.mappers.AbstractOIDCProtocolMapper;
import org.keycloak.protocol.oidc.mappers.OIDCAccessTokenMapper;
import org.keycloak.protocol.oidc.mappers.OIDCAttributeMapperHelper;
import org.keycloak.protocol.oidc.mappers.OIDCIDTokenMapper;
import org.keycloak.protocol.oidc.mappers.TokenIntrospectionTokenMapper;
import org.keycloak.protocol.oidc.mappers.UserInfoTokenMapper;
import org.keycloak.provider.ProviderConfigProperty;
import org.keycloak.representations.IDToken;

/**
 * Emits the Person Identifier: the Person's Keycloak user id, scoped with the
 * organisation's domain, as {@code <uuid>@<scope>} (ADR-0002).
 *
 * <p>The user id is already what the identifier has to be. Keycloak mints it
 * as a random UUID when the Person is created, by whichever path they arrive
 * through, keeps it in its own database, and never gives it to anyone else.
 * So this mapper mints nothing and stores nothing: it only adds the scope. A
 * Person created by any route, now or later, gets an identifier without that
 * route having to remember to make one.
 *
 * <p>The scope is configuration, declared in the realm file beside the mapper,
 * not a constant here. A mapper declared without one refuses to issue the
 * token rather than emit a bare UUID, because a bare UUID is the one shape
 * ADR-0002 rejects and nothing downstream could tell it was wrong.
 */
public class PersonIdentifierMapper extends AbstractOIDCProtocolMapper
    implements OIDCAccessTokenMapper,
        OIDCIDTokenMapper,
        UserInfoTokenMapper,
        TokenIntrospectionTokenMapper {

  public static final String PROVIDER_ID = "oidc-person-identifier-mapper";

  /** The organisation's domain, the part after the {@code @}. */
  public static final String SCOPE = "person.identifier.scope";

  private static final List<ProviderConfigProperty> CONFIG = new ArrayList<>();

  static {
    ProviderConfigProperty scope = new ProviderConfigProperty();
    scope.setName(SCOPE);
    scope.setLabel("Scope");
    scope.setType(ProviderConfigProperty.STRING_TYPE);
    scope.setHelpText("The organisation's domain, emitted after the @.");
    CONFIG.add(scope);
    OIDCAttributeMapperHelper.addTokenClaimNameConfig(CONFIG);
    OIDCAttributeMapperHelper.addIncludeInTokensConfig(
        CONFIG, PersonIdentifierMapper.class);
  }

  @Override
  public String getId() {
    return PROVIDER_ID;
  }

  @Override
  public String getDisplayType() {
    return "Person Identifier";
  }

  @Override
  public String getDisplayCategory() {
    return TOKEN_MAPPER_CATEGORY;
  }

  @Override
  public String getHelpText() {
    return "The Person's user id scoped with the organisation's domain.";
  }

  @Override
  public List<ProviderConfigProperty> getConfigProperties() {
    return CONFIG;
  }

  /**
   * Run after Keycloak's own subject mapper, so that a claim named {@code sub}
   * replaces the bare user id rather than being replaced by it. Mappers run in
   * ascending priority; in 26.8.1 the subject mapper's is -10 and most others
   * keep the default of zero, so anything above both is late enough.
   */
  @Override
  public int getPriority() {
    return 100;
  }

  @Override
  protected void setClaim(
      IDToken token,
      ProtocolMapperModel mappingModel,
      UserSessionModel userSession) {
    String scope = mappingModel.getConfig().get(SCOPE);
    if (scope == null || scope.isBlank()) {
      throw new IllegalStateException(
          "Mapper '" + mappingModel.getName() + "' declares no " + SCOPE
              + ". A Person Identifier without the organisation's domain is"
              + " the bare UUID ADR-0002 rejects, so no token is issued.");
    }
    String identifier = userSession.getUser().getId() + "@" + scope;
    OIDCAttributeMapperHelper.mapClaim(token, mappingModel, identifier);
  }
}
