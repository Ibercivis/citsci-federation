/**
 * A stand-in Federated App: the smallest thing that can drive a real
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

/** Everything the Broker serves lives under this origin, which is the one the
 *  configured issuer names (ADR-0001). It is how a browser here tells a page
 *  of the Broker's own dialogue from a redirect back to the application. */
const BROKER_ORIGIN = new URL(ISSUER).origin;

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
 */
export class Browser {
  private readonly cookies = new Map<string, string>();

  /** The Cookie header for the next request, or nothing on a fresh browser. */
  private cookieHeader(): Record<string, string> {
    if (this.cookies.size === 0) return {};
    const jar = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    return { cookie: jar };
  }

  private remember(response: Response): void {
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";", 1)[0] ?? "";
      const eq = pair.indexOf("=");
      if (eq > 0) this.cookies.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
  }

  async get(url: string): Promise<Response> {
    const response = await fetch(url, {
      redirect: "manual",
      headers: this.cookieHeader(),
    });
    this.remember(response);
    return response;
  }

  async postForm(url: string, form: Record<string, string>): Promise<Response> {
    const response = await fetch(url, {
      method: "POST",
      redirect: "manual",
      headers: {
        ...this.cookieHeader(),
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(form).toString(),
    });
    this.remember(response);
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
interface Page {
  url: string;
  html: string;
}

interface HtmlForm {
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
function formsOn(page: Page): HtmlForm[] {
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

/**
 * What the Broker is asking for on this page, and the form to answer it with.
 *
 * Read once, here, so that every caller agrees on what a page is: the guard
 * that decides whether a flow ever reached a Person and the loop that answers
 * the questions would otherwise each carry their own idea of it, and could
 * disagree.
 */
function question(page: Page): { asks: Asked["kind"]; form: HtmlForm } | null {
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
  return null;
}

/** Reads the Broker's own complaint off a page, so a failed step says why. */
function pageComplaint({ html }: Page): string {
  const messages = [...html.matchAll(/id="input-error[^"]*"[^>]*>([^<]+)</g)]
    .map((match) => match[1]?.trim())
    .filter(Boolean);
  const heading = /<h1[^>]*id="kc-page-title"[^>]*>([^<]+)</.exec(html);
  const asksFor = /name="(firstName|lastName|email|password-new)"/.exec(html);
  return (
    [
      heading?.[1] ? `Page: ${heading[1].trim()}` : "",
      messages.length ? `Errors: ${messages.join(" | ")}` : "",
      asksFor?.[1] ? `Asks for field: ${asksFor[1]}` : "",
    ]
      .filter(Boolean)
      .join("\n") || html.slice(0, 400)
  );
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

/** Where a browser came to rest: still inside the Broker, on some page of its
 *  dialogue, or back at the application that sent it. */
type Landing =
  | { at: "the application"; location: string }
  | { at: "the Broker"; page: Page };

/** How many redirects a browser will follow before calling it a loop. */
const MAX_HOPS = 10;

/**
 * Follows redirects the way a browser does, and stops at the first one that
 * leaves the Broker: that one is the application's own callback, which is
 * where the authorization code is read off.
 *
 * Following them matters because the Broker conducts its dialogue across
 * several pages — signing in and granting consent are not the same request —
 * and a redirect from one of its own pages to the next is not a flow coming
 * back to the application. A harness that read the first Location as the end
 * of the flow would report a refusal every time the Broker asked a Person a
 * second question.
 */
async function follow(browser: Browser, response: Response): Promise<Landing> {
  let current = response;
  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    const location = current.headers.get("location");
    if (!location) {
      // Carrying the address it was served at, because a form on it may
      // submit to a path relative to that rather than to one spelled out.
      const page = { url: current.url, html: await current.text() };
      return { at: "the Broker", page };
    }
    const target = new URL(location, BROKER_ORIGIN);
    if (target.origin !== BROKER_ORIGIN) {
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
 * A Federated App never sees these — it sees a redirect and then tokens — but
 * a Person does, and whether the Broker asks for consent at all is a property
 * of the Broker that only its dialogue shows.
 */
export interface Asked {
  kind: "sign-in" | "consent";
  /** What the page said, so a case can read what a Person was shown. */
  html: string;
}

/** How far through the Broker's HTML dialogue a flow got. */
type Dialogue =
  | { outcome: "redirected"; location: string; asked: Asked[] }
  | { outcome: "stuck"; complaint: string; asked: Asked[] };

/** The most questions the Broker's dialogue asks here: signing in, and
 *  consenting. A dialogue that asks a third is one this stand-in app cannot
 *  drive, and it says so rather than looping. */
const MOST_QUESTIONS_ASKED = 2;

/**
 * Drives the dialogue the Broker conducts in the browser — signing in, and
 * granting consent when it is asked for — until it redirects back to the
 * application.
 *
 * Consent is one page for a Person who has not granted it to this application
 * before and no page at all afterwards, because the Broker remembers a grant
 * per application. A harness that assumed either would be green only half the
 * time, so this follows whatever it is handed.
 */
async function completeDialogue(
  browser: Browser,
  firstPage: Page,
): Promise<Dialogue> {
  let page = firstPage;
  const asked: Asked[] = [];
  for (let step = 0; step < MOST_QUESTIONS_ASKED; step += 1) {
    const asking = question(page);
    if (!asking) {
      return { outcome: "stuck", complaint: pageComplaint(page), asked };
    }
    asked.push({ kind: asking.asks, html: page.html });

    const response =
      asking.asks === "sign-in"
        ? await submit(
            browser,
            asking.form,
            {
              username: DEMO_IDENTITY.username,
              password: DEMO_IDENTITY.password,
            },
            "login",
          )
        : // Pressing Yes, and only Yes. The same form offers No, and a Person
          // who pressed both granted nothing.
          await submit(browser, asking.form, {}, "accept");

    const landing = await follow(browser, response);
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
 * Verifies an id_token the way a Federated App would: against keys fetched
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
  /** Redeem with this verifier instead of the pair's own. */
  verifier?: string;
  /** Authorization parameters to add or override. */
  params?: Record<string, string>;
}

/** Runs a flow and reports where it died, or that it did not. */
export async function attempt(
  client: Client,
  options: AttemptOptions = {},
): Promise<Attempt> {
  const browser = new Browser();
  const params: Record<string, string> = { ...options.params };
  if (options.pkce) {
    params.code_challenge = options.pkce.challenge;
    params.code_challenge_method = options.pkce.method;
  }

  const authorization = await requestAuthorization(browser, client, params);
  const landing = await follow(browser, authorization);
  if (landing.at === "the application") {
    // Sent straight back without a Person being asked anything: the Broker
    // turned the request away at the authorization endpoint.
    return refusedAtAuthorization(landing.location);
  }

  const { page } = landing;
  if (!question(page)) {
    // A page that asks a Person nothing is not a dialogue: the Broker said no
    // without ever offering a way through.
    return {
      outcome: "refused-at-authorization",
      error: /error=([a-z_]+)/.exec(page.html)?.[1] ?? null,
    };
  }

  const dialogue = await completeDialogue(browser, page);
  if (dialogue.outcome === "stuck") {
    return { outcome: "refused-in-the-browser", complaint: dialogue.complaint };
  }
  const code = new URL(dialogue.location).searchParams.get("code");
  if (!code) return refusedAtAuthorization(dialogue.location);

  const verifier = options.verifier ?? options.pkce?.verifier;
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
  return {
    outcome: "authenticated",
    claims: await verifyIdToken(tokens.body.id_token, client),
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

/** The happy path, as a Federated App runs it. Throws on any refusal, because
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
