/**
 * A stand-in Brokered App: the smallest thing that can drive a real
 * authorization code flow against the Broker.
 *
 * Everything it knows about the Broker it reads from the discovery document
 * and from the configured issuer. No Keycloak path is spelled out here, so
 * this file would still be meaningful if Keycloak were replaced by another
 * provider — which is the test this repository applies to its own tests.
 *
 * It is ported from the earlier `federation-proxy` harness, which already
 * drove this flow against a real Keycloak, and it gains one step: the Broker
 * now asks for consent, so a real app's Person has to grant it.
 */

import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { type Client, DEMO_IDENTITY } from "./clients.ts";
import { ISSUER, fetchDiscovery } from "./broker.ts";

export type ChallengeMethod = "S256" | "plain";

export interface Pkce {
  verifier: string;
  challenge: string;
  method: ChallengeMethod;
}

const base64url = (input: Buffer): string => input.toString("base64url");

/** Builds a PKCE pair. `plain` sends the secret itself as the challenge. */
export function createPkce(method: ChallengeMethod = "S256"): Pkce {
  const verifier = base64url(randomBytes(32));
  const challenge =
    method === "S256"
      ? base64url(createHash("sha256").update(verifier).digest())
      : verifier;
  return { verifier, challenge, method };
}

/**
 * A browser, to the extent the flow needs one: something that carries cookies
 * between requests and does not follow redirects, so the authorization code
 * can be read off the Location header.
 *
 * Cookies are kept per host, as a browser keeps them. A sign-in through
 * another Identity Source visits two servers, and sending one's cookies to the
 * other is something no browser does and no server should be tested against.
 */
export class Browser {
  private readonly jars = new Map<string, Map<string, string>>();

  /** The Cookie header for a request to this address, or nothing at all. */
  private cookieHeader(url: string): Record<string, string> {
    const jar = this.jars.get(new URL(url).host);
    if (!jar || jar.size === 0) return {};
    return { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") };
  }

  private remember(url: string, response: Response): void {
    const host = new URL(url).host;
    const jar = this.jars.get(host) ?? new Map<string, string>();
    this.jars.set(host, jar);
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";", 1)[0] ?? "";
      const eq = pair.indexOf("=");
      if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
  }

  async get(url: string): Promise<Response> {
    const response = await fetch(url, {
      redirect: "manual",
      headers: this.cookieHeader(url),
    });
    this.remember(url, response);
    return response;
  }

  async postForm(url: string, form: Record<string, string>): Promise<Response> {
    const response = await fetch(url, {
      method: "POST",
      redirect: "manual",
      headers: {
        ...this.cookieHeader(url),
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(form).toString(),
    });
    this.remember(url, response);
    return response;
  }
}

/** The authorization request, with every parameter left overridable so a case
 *  can send a deliberately wrong one. */
export async function requestAuthorization(
  browser: Browser,
  client: Client,
  params: Record<string, string>,
): Promise<Response> {
  const { authorization_endpoint } = await fetchDiscovery();
  const query = new URLSearchParams({
    client_id: client.id,
    redirect_uri: client.redirectUri,
    response_type: "code",
    scope: "openid",
    state: base64url(randomBytes(8)),
    ...params,
  });
  return browser.get(`${authorization_endpoint}?${query.toString()}`);
}

const unescapeHtml = (value: string): string =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/**
 * A page as a browser holds it: its address and its HTML. The two travel
 * together because neither is much use alone — a form on a page may submit to
 * a path relative to the page it was served at, so reading the HTML without
 * the address it came from cannot say where a submission goes.
 */
export interface Page {
  url: string;
  html: string;
}

export interface HtmlForm {
  /** Where the form submits to, resolved against the page it was read from. */
  action: string;
  /** The values the form carries, which a browser sends back unchanged. */
  fields: Record<string, string>;
  /** The controls a Person can press, by name, with the value pressing one
   *  sends. A browser sends exactly one of these — the one pressed — so they
   *  are kept apart from the fields rather than lumped in with them. The
   *  difference decides flows: the consent form offers `accept` and `cancel`,
   *  and sending both is a Person pressing No. */
  controls: Record<string, string>;
}

const attributesOf = (tag: string): Record<string, string> =>
  Object.fromEntries(
    [...tag.matchAll(/([a-zA-Z][a-zA-Z0-9-]*)="([^"]*)"/g)].map(
      ([, name, value]) => [name!.toLowerCase(), unescapeHtml(value!)],
    ),
  );

const PRESSABLE = new Set(["submit", "button", "image"]);

/**
 * The forms on a page, read as a browser would rather than as this provider's
 * templates happen to be written. A dialogue the Broker conducts in HTML is
 * driven by submitting its forms; which element ids or CSS classes it uses is
 * not this harness's business, and a theme changing them is not a change in
 * the Broker's behaviour.
 */
export function formsOn(page: Page): HtmlForm[] {
  return [...page.html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/g)].map(
    ([, attributes, body]) => {
      const fields: Record<string, string> = {};
      const controls: Record<string, string> = {};
      const html = body ?? "";
      for (const [, tag] of html.matchAll(/<input\b([^>]*)>/g)) {
        const input = attributesOf(tag ?? "");
        if (!input.name) continue;
        const into = PRESSABLE.has(input.type ?? "text") ? controls : fields;
        into[input.name] = input.value ?? "";
      }
      // A button is a control whether or not it says so, and an unlabelled
      // one sends an empty value — which is what pressing it looks like on
      // the wire.
      for (const [, tag] of html.matchAll(/<button\b([^>]*)>/g)) {
        const button = attributesOf(tag ?? "");
        if (button.name && button.type !== "button") {
          controls[button.name] = button.value ?? "";
        }
      }
      const action = attributesOf(attributes ?? "").action ?? "";
      return { action: new URL(action, page.url).href, fields, controls };
    },
  );
}

/** The text a link shows a Person, with its markup taken out. */
const visibleText = (html: string): string =>
  unescapeHtml(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

/** The links in some HTML, by what they say and where they point as written. */
function anchorsIn(html: string): Array<{ text: string; href: string }> {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].flatMap(
    ([, attributes, body]) => {
      const href = attributesOf(attributes ?? "").href;
      return href ? [{ text: visibleText(body ?? ""), href }] : [];
    },
  );
}

/**
 * The links on a page, by what they say, pointing where a browser would go.
 * How an Identity Source is offered on a sign-in page is a link a Person reads
 * and follows, so that is how it is found: by the name it shows, never by an
 * element id this provider's templates happen to give it.
 */
export function linksOn(page: Page): Array<{ text: string; href: string }> {
  return anchorsIn(page.html).map((link) => ({
    text: link.text,
    href: new URL(link.href, page.url).href,
  }));
}

/** What each link on a page says, for a case that reads what a Person was
 *  offered. */
export const linkTextsOn = (html: string): string[] =>
  anchorsIn(html).map((link) => link.text);

/**
 * Who signs in, and through which Identity Source. `through` is the source's
 * name as the Broker's sign-in page shows it; absent, the Person signs in with
 * a Local Credential on the Broker's own form.
 */
export interface Arrival {
  through?: string;
  username: string;
  password: string;
  /** The address this Person gives the Broker when it asks them for one,
   *  which it then confirms by mail (ADR-0004). A Person who brought none
   *  cannot answer that question, and the dialogue stops on it. */
  address?: string;
  /** The address this Person types over what their source sent, on the page
   *  the Broker shows when something their profile needs is missing. A
   *  different question from the one above, and the one issue #182 is about:
   *  nobody affirmed what is typed over what arrived. */
  typesOnReview?: string;
}

type Question =
  | {
      asks: "sign-in" | "consent" | "give-an-address" | "review-the-profile";
      form: HtmlForm;
    }
  | { asks: "choose-source"; href: string };

/**
 * What the Broker is asking for on this page, and the form to answer it with.
 *
 * Read once, here, so that every caller agrees on what a page is: the guard
 * that decides whether a flow ever reached a Person and the loop that answers
 * the questions would otherwise each carry their own idea of it, and could
 * disagree.
 *
 * A Person arriving through another Identity Source is offered it beside the
 * Broker's own form, and follows it rather than filling the form in. The
 * sign-in form they meet next is that source's, and it is answered the same
 * way: a username and a password, whoever is asking.
 */
function question(page: Page, arrival: Arrival): Question | null {
  if (arrival.through) {
    // By the name it carries, wherever in the link's wording that is: a
    // provider says "Sign in with" around it, and that is not the name.
    const name = arrival.through;
    const source = linksOn(page).find((link) => link.text.includes(name));
    if (source) return { asks: "choose-source", href: source.href };
  }
  const forms = formsOn(page);
  // A form asking for a username and a password is a sign-in, whatever page
  // it is on and whatever the theme calls it.
  const signIn = forms.find(
    (form) => "username" in form.fields && "password" in form.fields,
  );
  if (signIn) return { asks: "sign-in", form: signIn };
  // A form offering to accept is the Broker asking a Person to consent.
  const consent = forms.find((form) => "accept" in form.controls);
  if (consent) return { asks: "consent", form: consent };
  // A form asking for an address and for nothing else about the Person is the
  // Broker asking for one of its own, which it then confirms by mail: it holds
  // none for this Person, because the source they arrived from affirmed none.
  // A form that asks for a name as well is the Broker showing them what their
  // source sent, which is a different question and not this one's answer.
  //
  // Only a Person who brought an address to give can answer, so a case that
  // offered none stops here.
  const address = forms.find(
    (form) => "email" in form.fields && !("firstName" in form.fields),
  );
  if (address && arrival.address) {
    return { asks: "give-an-address", form: address };
  }
  // The other form with an address on it: the Broker showing a Person what
  // their source sent, because something the profile requires is missing or
  // will not validate. What is typed here was affirmed by nobody, which is
  // the whole of issue #182, so only a case that says what it types reaches
  // it.
  const review = forms.find(
    (form) => "email" in form.fields && "firstName" in form.fields,
  );
  if (review && arrival.typesOnReview) {
    return { asks: "review-the-profile", form: review };
  }
  return null;
}

/** What a Person would read on a page: the markup stripped, and the scripts
 *  and stylesheets a browser never shows stripped first. Exported because a
 *  refusal the Broker words itself reaches a case through no other channel. */
export const readableTextOf = (html: string): string =>
  visibleText(
    html
      .replace(/<script\b[\s\S]*?<\/script>/g, " ")
      .replace(/<style\b[\s\S]*?<\/style>/g, " "),
  );

/** Reads the Broker's own complaint off a page, so a failed step says why. */
function pageComplaint({ html }: Page): string {
  const messages = [...html.matchAll(/id="input-error[^"]*"[^>]*>([^<]+)</g)]
    .map((match) => match[1]?.trim())
    .filter(Boolean);
  const heading = /<h1[^>]*id="kc-page-title"[^>]*>([^<]+)</.exec(html);
  const asksFor = /name="(firstName|lastName|email|password-new)"/.exec(html);
  return [
    heading?.[1] ? `Page: ${heading[1].trim()}` : "",
    messages.length ? `Errors: ${messages.join(" | ")}` : "",
    asksFor?.[1] ? `Asks for field: ${asksFor[1]}` : "",
    // Everything a Person was shown. A refusal the realm words itself appears
    // in none of the lines above, so this is the only place a case can read it
    // from — and the reason this last line needs no guard.
    `Says: ${readableTextOf(html)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Submits a form the way a browser would: the values it carries, whatever was
 * typed into it, and the one control that was pressed.
 */
function submit(
  browser: Browser,
  form: HtmlForm,
  typed: Record<string, string> = {},
  pressed?: string,
): Promise<Response> {
  const control =
    pressed === undefined ? {} : { [pressed]: form.controls[pressed] ?? "" };
  return browser.postForm(form.action, {
    ...form.fields,
    ...typed,
    ...control,
  });
}

/** Where a browser came to rest: on some page of the dialogue — the Broker's,
 *  or an Identity Source's it was sent to — or back at the application that
 *  sent it. */
export type Landing =
  | { at: "the application"; location: string }
  | { at: "a page"; page: Page };

/** How many redirects a browser will follow before calling it a loop. */
const MAX_HOPS = 10;

/** Whether an address is this client's own callback: the one place a flow
 *  ends, whether it ends in a code or in an error. */
function isCallbackOf(client: Client, address: URL): boolean {
  const callback = new URL(client.redirectUri);
  return (
    address.origin === callback.origin && address.pathname === callback.pathname
  );
}

/**
 * Follows redirects the way a browser does, and stops at the client's own
 * callback, which is where the authorization code is read off.
 *
 * Following them matters because the Broker conducts its dialogue across
 * several pages — signing in and granting consent are not the same request —
 * and a redirect from one of its own pages to the next is not a flow coming
 * back to the application. A harness that read the first Location as the end
 * of the flow would report a refusal every time the Broker asked a Person a
 * second question.
 *
 * It ends at the callback rather than at the first redirect leaving the
 * Broker, because a Person arriving through another Identity Source leaves
 * the Broker in the middle of the flow and comes back to it.
 */
export async function follow(
  browser: Browser,
  response: Response,
  client: Client,
): Promise<Landing> {
  let current = response;
  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    const location = current.headers.get("location");
    if (!location) {
      // Carrying the address it was served at, because a form on it may
      // submit to a path relative to that rather than to one spelled out.
      const page = { url: current.url, html: await current.text() };
      return { at: "a page", page };
    }
    const target = new URL(location, current.url);
    if (isCallbackOf(client, target)) {
      return { at: "the application", location: target.href };
    }
    current = await browser.get(target.href);
  }
  throw new Error(
    `The Broker redirected more than ${MAX_HOPS} times without reaching a ` +
      "page or the application. A redirect loop is not a refusal, so this " +
      "says so rather than reporting one.",
  );
}

/**
 * A page of its own the Broker put in front of the Person, and what it said.
 *
 * A Brokered App never sees these — it sees a redirect and then tokens — but
 * a Person does, and whether the Broker asks for consent at all is a property
 * of the Broker that only its dialogue shows.
 */
export interface Asked {
  kind: Question["asks"];
  /** What the page said, so a case can read what a Person was shown. */
  html: string;
}

/** How far through the Broker's HTML dialogue a flow got. */
type Dialogue =
  | { outcome: "redirected"; location: string; asked: Asked[] }
  | { outcome: "stuck"; complaint: string; asked: Asked[] };

/** The most questions a dialogue asks here: choosing an Identity Source,
 *  signing in at it, reviewing the profile the source sent, giving the Broker
 *  an address when it holds none, and consenting. A dialogue that asks one
 *  more is one this stand-in app cannot drive, and it says so rather than
 *  looping. */
const MOST_QUESTIONS_ASKED = 5;

/** Who signs in when a case does not say: the realm's one Local Credential. */
const DEMO_ARRIVAL: Arrival = {
  username: DEMO_IDENTITY.username,
  password: DEMO_IDENTITY.password,
};

/** Answers one question the way the arriving Person would. */
function answer(
  browser: Browser,
  asking: Question,
  arrival: Arrival,
): Promise<Response> {
  if (asking.asks === "choose-source") return browser.get(asking.href);
  if (asking.asks === "sign-in") {
    return submit(
      browser,
      asking.form,
      { username: arrival.username, password: arrival.password },
      "login",
    );
  }
  if (asking.asks === "give-an-address") {
    // Typed in, with nothing pressed: the form's one button carries no name,
    // so a browser sends the fields alone.
    return submit(browser, asking.form, { email: arrival.address ?? "" });
  }
  if (asking.asks === "review-the-profile") {
    // The address replaced and everything else left as the source sent it,
    // which is what a Person correcting one field does. The names come back
    // empty when the source sent none, and the profile asks for neither.
    return submit(browser, asking.form, {
      email: arrival.typesOnReview ?? "",
    });
  }
  // Pressing Yes, and only Yes. The same form offers No, and a Person who
  // pressed both granted nothing.
  return submit(browser, asking.form, {}, "accept");
}

/**
 * Drives the dialogue conducted in the browser — choosing an Identity Source
 * when the Person arrives through one, signing in, and granting consent when
 * it is asked for — until it redirects back to the application.
 *
 * Consent is one page for a Person who has not granted it to this application
 * before and no page at all afterwards, because the Broker remembers a grant
 * per application. A harness that assumed either would be green only half the
 * time, so this follows whatever it is handed.
 */
async function completeDialogue(
  browser: Browser,
  firstPage: Page,
  client: Client,
  arrival: Arrival,
): Promise<Dialogue> {
  let page = firstPage;
  const asked: Asked[] = [];
  for (let step = 0; step < MOST_QUESTIONS_ASKED; step += 1) {
    const asking = question(page, arrival);
    if (!asking) {
      return { outcome: "stuck", complaint: pageComplaint(page), asked };
    }
    asked.push({ kind: asking.asks, html: page.html });

    const response = await answer(browser, asking, arrival);
    const landing = await follow(browser, response, client);
    if (landing.at === "the application") {
      return { outcome: "redirected", location: landing.location, asked };
    }
    page = landing.page;
  }
  return { outcome: "stuck", complaint: pageComplaint(page), asked };
}

export interface TokenResponse {
  status: number;
  body: Record<string, string>;
}

/** Posts a form to the token endpoint. The one way tokens are asked for. */
export async function postToken(
  form: Record<string, string>,
): Promise<TokenResponse> {
  const { token_endpoint } = await fetchDiscovery();
  const response = await fetch(token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
  });
  return {
    status: response.status,
    body: (await response.json()) as Record<string, string>,
  };
}

/** Redeems an authorization code, authenticating the client if it has a secret. */
export async function redeemCode(
  client: Client,
  form: Record<string, string>,
): Promise<TokenResponse> {
  return postToken({
    grant_type: "authorization_code",
    client_id: client.id,
    redirect_uri: client.redirectUri,
    ...(client.secret ? { client_secret: client.secret } : {}),
    ...form,
  });
}

let keys: ReturnType<typeof createRemoteJWKSet> | undefined;

/** The issuer's published keys, found through discovery rather than through a
 *  path only this provider happens to serve. */
async function issuerKeys(): Promise<ReturnType<typeof createRemoteJWKSet>> {
  if (!keys) {
    const { jwks_uri } = await fetchDiscovery();
    keys = createRemoteJWKSet(new URL(jwks_uri));
  }
  return keys;
}

/**
 * Verifies an id_token the way a Brokered App would: against keys fetched
 * from the issuer's own discovery document, and against the issuer string it
 * was configured with. Nothing is persisted to do it (ADR-0001), and an
 * unverifiable token is not evidence of anything.
 */
export async function verifyIdToken(
  idToken: string,
  client: Client,
): Promise<Record<string, unknown>> {
  const { payload } = await jwtVerify(idToken, await issuerKeys(), {
    issuer: ISSUER,
    audience: client.id,
  });
  return payload;
}

/**
 * Verifies an access token the way a Brokered App's own API would before
 * trusting it: the issuer's keys, the configured issuer, and this client in
 * its audience. The last is what lets the client introspect it as well.
 */
export async function verifyAccessToken(
  accessToken: string,
  client: Client,
): Promise<Record<string, unknown>> {
  const { payload } = await jwtVerify(accessToken, await issuerKeys(), {
    issuer: ISSUER,
    audience: client.id,
  });
  return payload;
}

export interface JsonResponse {
  status: number;
  body: Record<string, unknown>;
}

/** Asks the userinfo endpoint who the bearer of this access token is. */
export async function userinfo(accessToken: string): Promise<JsonResponse> {
  const { userinfo_endpoint } = await fetchDiscovery();
  const response = await fetch(userinfo_endpoint, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

/**
 * Introspects a token (RFC 7662) as a confidential client, authenticating
 * with its secret. A client with no secret has no way to ask, which is why
 * introspection is a confidential client's capability and not a public one's.
 */
export async function introspect(
  client: Client,
  token: string,
): Promise<JsonResponse> {
  if (!client.secret) {
    throw new Error(
      `${client.id} holds no secret, so it cannot authenticate to introspect.`,
    );
  }
  const { introspection_endpoint } = await fetchDiscovery();
  const response = await fetch(introspection_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      token,
      client_id: client.id,
      client_secret: client.secret,
    }).toString(),
  });
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

/**
 * Where the Broker refused, and why. A request turned away at the
 * authorization endpoint never reached a login screen, while one turned away
 * at the token endpoint got a code that proved worthless.
 *
 * `token-in-fragment` is the variant that earns the whole type. An implicit
 * response puts its tokens in the fragment, which carries neither an error nor
 * an authorization code — so without a name of its own, a successful implicit
 * flow reads as a refusal, and a case guarding against it passes while the
 * Broker hands out tokens.
 */
export type Attempt =
  | {
      outcome: "authenticated";
      claims: Record<string, unknown>;
      accessToken: string;
      /** The pages the Broker put in front of the Person on the way here. */
      asked: Asked[];
    }
  | { outcome: "refused-at-authorization"; error: string | null }
  | { outcome: "refused-in-the-browser"; complaint: string }
  | { outcome: "refused-at-token"; status: number; error: string | null }
  | { outcome: "token-in-fragment"; location: string }
  | { outcome: "redirected-without-error"; location: string };

export interface AttemptOptions {
  /** The PKCE pair to offer, or null to offer none at all. */
  pkce?: Pkce | null;
  /** The nonce to send, or null to send none. A fresh one by default, as a
   *  Brokered App sends on every request. */
  nonce?: string | null;
  /** Redeem with this verifier instead of the pair's own, or null to redeem
   *  with none. */
  verifier?: string | null;
  /** Authorization parameters to add or override. */
  params?: Record<string, string>;
  /** Who signs in, and through which Identity Source; the realm's demo
   *  Identity, on the Broker's own form, when absent. */
  as?: Arrival;
  /** The browser to run it in, for a case that goes on using the session the
   *  sign-in leaves behind. A fresh one when absent. */
  browser?: Browser;
}

/** Runs a flow and reports where it died, or that it did not. */
export async function attempt(
  client: Client,
  options: AttemptOptions = {},
): Promise<Attempt> {
  const browser = options.browser ?? new Browser();
  const nonce =
    options.nonce === undefined ? base64url(randomBytes(16)) : options.nonce;
  const params: Record<string, string> = {
    ...(nonce === null ? {} : { nonce }),
    ...options.params,
  };
  if (options.pkce) {
    params.code_challenge = options.pkce.challenge;
    params.code_challenge_method = options.pkce.method;
  }

  const authorization = await requestAuthorization(browser, client, params);
  const arrival = options.as ?? DEMO_ARRIVAL;
  const landing = await follow(browser, authorization, client);
  if (landing.at === "the application") {
    // Sent straight back without a Person being asked anything: the Broker
    // turned the request away at the authorization endpoint.
    return refusedAtAuthorization(landing.location);
  }

  const { page } = landing;
  if (!question(page, arrival)) {
    // A page that asks a Person nothing is not a dialogue: the Broker said no
    // without ever offering a way through.
    return {
      outcome: "refused-at-authorization",
      error: /error=([a-z_]+)/.exec(page.html)?.[1] ?? null,
    };
  }

  const dialogue = await completeDialogue(browser, page, client, arrival);
  if (dialogue.outcome === "stuck") {
    return { outcome: "refused-in-the-browser", complaint: dialogue.complaint };
  }
  const code = new URL(dialogue.location).searchParams.get("code");
  if (!code) return refusedAtAuthorization(dialogue.location);

  const verifier =
    options.verifier === undefined ? options.pkce?.verifier : options.verifier;
  const tokens = await redeemCode(client, {
    code,
    ...(verifier ? { code_verifier: verifier } : {}),
  });
  if (!tokens.body.id_token) {
    return {
      outcome: "refused-at-token",
      status: tokens.status,
      error: tokens.body.error ?? null,
    };
  }
  const claims = await verifyIdToken(tokens.body.id_token, client);
  if (nonce !== null && claims.nonce !== nonce) {
    // Not a refusal: the Broker issued tokens, but not for this request. A
    // Brokered App throws such an id_token away, because a nonce it did not
    // send is what a replayed token looks like.
    throw new Error(
      `The id_token carries nonce ${JSON.stringify(claims.nonce)}, not the ` +
        `${JSON.stringify(nonce)} this request sent.`,
    );
  }
  return {
    outcome: "authenticated",
    claims,
    accessToken: tokens.body.access_token ?? "",
    asked: dialogue.asked,
  };
}

/** Reads a redirect that carries no authorization code. An implicit response
 *  — tokens or errors alike — comes back in the fragment rather than the
 *  query, so both halves have to be read. */
function refusedAtAuthorization(location: string): Attempt {
  const url = new URL(location);
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
  const error = url.searchParams.get("error") ?? fragment.get("error");
  if (error) return { outcome: "refused-at-authorization", error };
  if (fragment.has("access_token") || fragment.has("id_token")) {
    return { outcome: "token-in-fragment", location };
  }
  return { outcome: "redirected-without-error", location };
}

/** The happy path, as a Brokered App runs it. Throws on any refusal, because
 *  a case that wanted one should be using `attempt`. */
export async function authenticate(
  client: Client,
  options: AttemptOptions = {},
): Promise<{
  claims: Record<string, unknown>;
  accessToken: string;
  asked: Asked[];
}> {
  const result = await attempt(client, {
    pkce: createPkce("S256"),
    ...options,
  });
  if (result.outcome !== "authenticated") {
    throw new Error(
      `The Broker refused a flow that should have worked: ${JSON.stringify(result)}`,
    );
  }
  return {
    claims: result.claims,
    accessToken: result.accessToken,
    asked: result.asked,
  };
}

/**
 * Every place a Brokered App can read the Person from, for one sign-in: the ID
 * token, the access token, userinfo, and introspection where the client holds
 * a secret to ask with.
 */
export async function everyPlace(
  client: Client,
  options: AttemptOptions = {},
): Promise<{
  idToken: Record<string, unknown>;
  places: Array<[string, Record<string, unknown>]>;
}> {
  const { claims, accessToken } = await authenticate(client, options);
  const places: Array<[string, Record<string, unknown>]> = [
    ["the ID token", claims],
    ["the access token", await verifyAccessToken(accessToken, client)],
    ["the userinfo response", (await userinfo(accessToken)).body],
  ];
  if (client.secret) {
    places.push([
      "the introspection response",
      (await introspect(client, accessToken)).body,
    ]);
  }
  return { idToken: claims, places };
}
