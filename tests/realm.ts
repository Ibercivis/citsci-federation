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
  /** The scope the Broker asks this source for. What a source puts in its ID
   *  token depends on it, so a case about that reads it from here. */
  asksFor: string;
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
  const asksFor = provider.config?.defaultScope;
  if (!asksFor) {
    throw new Error(
      `The realm has the Broker ask ${alias} for no particular scope, so ` +
        "what that source sends is Keycloak's default rather than this " +
        "stack's decision.",
    );
  }
  return {
    name: provider.displayName,
    affirmsAddresses: provider.trustEmail,
    asksFor,
  };
}

/**
 * What the realm says a source's credentials are, by its alias, word for word
 * and before Keycloak substitutes anything.
 *
 * Unsubstituted on purpose: a case about a real secret is asking what the
 * tracked file says, not what this machine happens to hold.
 */
export function declaredCredentials(alias: string): {
  clientId: string;
  clientSecret: string;
} {
  const config = realm.identityProviders?.find(
    (candidate) => candidate.alias === alias,
  )?.config;
  const { clientId, clientSecret } = config ?? {};
  if (!clientId || !clientSecret) {
    throw new Error(
      `The realm gives ${alias} no clientId and clientSecret: either the ` +
        "source lost its credentials, or Keycloak moved where they live.",
    );
  }
  return { clientId, clientSecret };
}

/**
 * One of the declaration's strings as Keycloak imported it: every `${NAME}`
 * replaced by the value this stack declares for that name.
 *
 * A layer file references a Brokered App's client id, address and secret
 * rather than spelling them, because `.env` declares each one once and the
 * application's own container is handed the same line (ADR-0001). Keycloak
 * substitutes them while importing the realm, so a case that looks for one of
 * those entries has to substitute them too — otherwise it looks for a client
 * literally called `${LOSTATNIGHT_CLIENT_ID}`, which the Broker has never
 * heard of, and reads its absence as the entry missing.
 *
 * An unset name throws here, as everywhere else this stack reads its
 * configuration: the Broker would have imported the literal instead.
 */
export function asImported(text: string): string {
  return text.replaceAll(
    /\$\{(?<name>[A-Z_][A-Z0-9_]*)\}/g,
    (_match, name: string) => configured(name),
  );
}
