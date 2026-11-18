/**
 * The realm as the tests read it: derived from `broker/realm/` for this
 * stack's BROKER_MODE, by the same step that derives the realm the Broker
 * imports. A case that needs to know what the Broker was told reads it from
 * here, so the two cannot disagree about it.
 *
 * This is the only module that knows the realm's shape. A case asks for a fact
 * by name; where Keycloak keeps it is this file's business, and an upgrade that
 * moves it is one file to change.
 *
 * Every reader below throws rather than returning nothing. A fact the realm
 * does not declare would otherwise arrive as `undefined` and be asserted
 * against — `toContain("")`, which every page satisfies — so the cases would
 * pass in silence precisely when the realm had moved under them.
 */

import { derive, readDeclaration } from "../broker/realm/derive.ts";
import { configured } from "./broker.ts";

/** The parts of the realm the readers below look at. */
interface ImportedRealm {
  identityProviders?: ReadonlyArray<{
    alias: string;
    displayName: string;
    trustEmail: boolean;
  }>;
  authenticatorConfig?: ReadonlyArray<{
    alias: string;
    config?: Record<string, string>;
  }>;
}

const MODE = configured("BROKER_MODE");
const realm = derive(
  MODE,
  readDeclaration(),
  MODE === "testing" ? configured("MOCK_ISSUER") : "",
) as ImportedRealm;

/** An Identity Source as the Broker was told about it. */
export interface DeclaredSource {
  /** The name a Person reads on the Broker's sign-in page. */
  name: string;
  /** Whether the Broker takes this source's word on an address. One decision
   *  about one operator, so the realm sets it per source and never globally. */
  affirmsAddresses: boolean;
}

/**
 * What the realm says about one Identity Source, by its alias.
 *
 * An alias with no provider behind it is a sign-in no Person can start, which
 * is why it is an error here rather than a case failing somewhere further on.
 */
export function declaredSource(alias: string): DeclaredSource {
  const provider = realm.identityProviders?.find(
    (candidate) => candidate.alias === alias,
  );
  if (!provider) {
    throw new Error(
      `The realm declares no Identity Source under ${alias}: either that ` +
        "alias moved, or the source was never added to the realm.",
    );
  }
  return {
    name: provider.displayName,
    affirmsAddresses: provider.trustEmail,
  };
}

/**
 * The refusal the realm words for an authenticator, by that authenticator's
 * config alias.
 *
 * A case holding a phrase of its own would go red once somebody reworded the
 * message, having found nothing wrong — and a phrase is free to turn up on a
 * page that means something else.
 */
export function declaredRefusal(alias: string): string {
  const declared = realm.authenticatorConfig?.find(
    (entry) => entry.alias === alias,
  )?.config;
  const message =
    declared && "denyErrorMessage" in declared
      ? declared.denyErrorMessage
      : undefined;
  if (!message) {
    throw new Error(
      `The realm declares no denyErrorMessage under ${alias}: either that ` +
        "alias moved, or the refusal stopped being worded by us.",
    );
  }
  return message;
}
