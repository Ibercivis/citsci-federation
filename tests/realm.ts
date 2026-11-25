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
  identityProviders?: ReadonlyArray<RealmProvider>;
}

/** One `identityProviders` entry, as the realm holds it. */
interface RealmProvider {
  alias: string;
  providerId: string;
  displayName: string;
  trustEmail: boolean;
  config?: Record<string, string>;
}

const MODE = configured("BROKER_MODE");
const realm = derive(
  MODE,
  readDeclaration(),
  MODE === "testing" ? configured("MOCK_IDENTITY_SOURCE_ISSUER") : "",
) as ImportedRealm;

/** An Identity Source as the Broker was told about it. */
export interface DeclaredSource {
  /** The name a Person reads on the Broker's sign-in page. */
  name: string;
  /** Whether the Broker takes this source's word on an address. One decision
   *  about one operator, so the realm sets it per source and never globally. */
  affirmsAddresses: boolean;
  /** The scope the Broker asks this source for. It decides which claims the
   *  source puts in its ID token, so a case about those reads it here. */
  asksFor: string;
  /** The Keycloak provider the Broker runs this source through. The sign-in
   *  page draws the button's mark by this id and never by the alias, and two
   *  sources naming the same id are served by the same code. */
  provider: string;
}

/**
 * The provider the realm declares under an alias. Every reader below starts
 * here, so each of them refuses an undeclared alias in the same words.
 *
 * An alias with no provider behind it is a sign-in no Person can start, which
 * is why it is an error here rather than a case failing somewhere further on.
 * It is also not a fact about whatever the caller went on to read: a reader
 * that reached through this for a `config` entry would report a source that
 * lost it, which is a different source and a different repair.
 */
function declaredProvider(alias: string): RealmProvider {
  const provider = realm.identityProviders?.find(
    (candidate) => candidate.alias === alias,
  );
  if (!provider) {
    throw new Error(
      `The realm declares no Identity Source under ${alias}: either that ` +
        "alias moved, or the source was never added to the realm.",
    );
  }
  return provider;
}

/** What the realm says about one Identity Source, by its alias. */
export function declaredSource(alias: string): DeclaredSource {
  const provider = declaredProvider(alias);
  const asksFor = provider.config?.defaultScope;
  if (!asksFor) {
    throw new Error(
      `The realm asks ${alias} for no scope at all. What that source then ` +
        "sends is Keycloak's default, not a decision anybody here made.",
    );
  }
  if (!provider.providerId) {
    throw new Error(
      `The realm runs ${alias} through no provider at all: an alias with no ` +
        "provider behind it is a sign-in no Person can start.",
    );
  }
  return {
    name: provider.displayName,
    affirmsAddresses: provider.trustEmail,
    asksFor,
    provider: provider.providerId,
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
  const { clientId, clientSecret } = declaredProvider(alias).config ?? {};
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
