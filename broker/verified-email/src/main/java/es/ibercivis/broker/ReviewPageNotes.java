package es.ibercivis.broker;

import java.util.List;
import org.keycloak.broker.provider.AbstractIdentityProvider;

/**
 * The notes {@code idp-review-profile} leaves on the authentication session
 * when what is in the flow is not what the Identity Source sent.
 *
 * <p>Named here once because two classes in this package read them and an
 * upstream rename has to be one edit, not two in two vocabularies.
 * {@code UnverifiedEmailCondition} reads the address note to decide whether
 * anybody affirmed the address now in the flow; {@code ConfirmAddressByMail}
 * takes both off the session, because Keycloak's own mail declines to send
 * when either is set. Each says at its own use site what finding nothing
 * there would cost it.
 *
 * <p>No public API promises either name. That is why the image is pinned
 * (broker/Dockerfile) and why the cases in
 * {@code tests/verified-email-join.test.ts} drive the review page itself
 * rather than trusting these constants: a version that renamed them would
 * leave every reader here finding nothing, and finding nothing is never
 * distinguishable from nothing having happened (`issue #182`).
 */
final class ReviewPageNotes {

  /** Set when the address in the flow is not the one the source sent. */
  static final String ADDRESS_CHANGED =
      AbstractIdentityProvider.UPDATE_PROFILE_EMAIL_CHANGED;

  /**
   * The same for the username. This realm never shows that field — it signs
   * in with the address, so the username is derived from it (ADR-0005) — but
   * Keycloak's mail reads both, so an authenticator standing in for it has to
   * know about both.
   */
  static final String USERNAME_CHANGED =
      AbstractIdentityProvider.UPDATE_PROFILE_USERNAME_CHANGED;

  /** Both of them, for the reader that has to take them off the session and
   *  put them back. */
  static final List<String> BOTH = List.of(ADDRESS_CHANGED, USERNAME_CHANGED);

  private ReviewPageNotes() {
    // Constants only.
  }
}
