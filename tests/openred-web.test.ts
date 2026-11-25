import { describe, expect, it } from "vitest";
import { configured } from "./broker.ts";

/**
 * OpenRed's React front end, read the way a browser reads it: at its own
 * hostname, through the proxy, with every API call going to that same origin.
 *
 * It asserts the sign-in this application has always had, and **not** the one
 * through the Broker, which `issue #30` added: that one is a browser's, since
 * the code is obtained and the callback page is rendered by JavaScript, and a
 * browser is seam 3 (`issue #34`). This front end joined the composition
 * before the integration (`issue #96`), which is why this file predates it.
 *
 * **No screen is rendered here.** This suite fetches documents and calls APIs;
 * it runs no JavaScript, so what it holds is the application's own sign-in
 * contract through its own origin, not the page a Person would see. The one
 * thing it holds about the Broker is the field seam 3 reads the Person
 * Identifier from, which is served whether or not a Broker account is behind
 * it. Asserting
 * the page is seam 3's job (`issue #34`). The two failures that need a browser
 * — the Google provider throwing on mount, the map with no basemap — are
 * recorded in `docs/trying-it-by-hand.md` and checked by hand.
 */

/** The front end's address, and the API's. Two hostnames, one application: the
 *  front end calls the API through its own origin, so the second name is here
 *  only to tell "the composition is down" apart from "the front end is". */
const WEB = configured("OPENRED_WEB_BASE_URL");
const API = configured("OPENRED_API_BASE_URL");

/** A Person who existed before the Broker: the address and the password are
 *  constants of OpenRed's own `seed_local`, which `pnpm apps:up` runs against
 *  an empty database. `ada` rather than `rosa` or `admin` because the seed
 *  gives her tracks of her own — an account with nothing behind it would
 *  satisfy the sign-in and prove nothing about what follows it. */
const SEEDED_PERSON = {
  email: "ada@openred.invalid",
  password: "devpass12345",
};

/** Answering at all, as opposed to answering correctly: a 5xx is the
 *  composition being up and something inside it being wrong, which is this
 *  file's business rather than a reason to skip. */
async function answering(url: string): Promise<boolean> {
  return fetch(url, { redirect: "manual", signal: AbortSignal.timeout(5_000) })
    .then((response) => response.status < 500)
    .catch(() => false);
}

/** Signs the seeded Person in through the front end's own origin and hands
 *  back the credential that follows.
 *
 *  Not a bearer token: that application sets `USE_JWT` off and keeps DRF's own
 *  token model, so the credential is `key` and the scheme is `Token`. The front
 *  end reads it the same way (`src/services/api.ts`). */
async function signIn(): Promise<string> {
  const response = await fetch(`${WEB}/dj-rest-auth/login/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(SEEDED_PERSON),
  });
  expect(response.status).toBe(200);

  const { key } = (await response.json()) as { key?: string };
  if (!key) throw new Error("the sign-in answered 200 and carried no token");
  return key;
}

const composition = await answering(`${API}/admin/login/`);

describe.skipIf(!composition)("OpenRed's React front end", () => {
  it("is served at its own hostname, through the proxy", async () => {
    const response = await fetch(`${WEB}/`);

    // A refusal here answers from the dev server rather than from the proxy:
    // webpack's host check, which `react-scripts` applies only when
    // `package.json` carries a `proxy` key. That key is gone on this
    // application's `federation` branch (`docs/local-development.md`), so
    // nothing configures the hostname — and this is what holds that true.
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<div id="root">');
  });

  it("reaches the API through its own origin", async () => {
    const response = await fetch(`${WEB}/api/projects/`, {
      headers: { accept: "application/json" },
    });

    // A public read, so this one proves the forwarding and nothing else. An
    // empty list would mean the API answered from an unseeded database.
    expect(response.status).toBe(200);
    expect((await response.json()) as unknown[]).not.toHaveLength(0);
  });

  it("signs a Person in and gives them what is theirs", async () => {
    const path = "/api/tracks/my_tracks/";

    // Behind the sign-in, asserted rather than assumed: an endpoint that
    // answered anonymously would make the rest of this case prove nothing.
    const anonymous = await fetch(`${WEB}${path}`, {
      headers: { accept: "application/json" },
    });
    expect(anonymous.status).toBe(401);

    const key = await signIn();

    const tracks = await fetch(`${WEB}${path}`, {
      headers: { accept: "application/json", authorization: `Token ${key}` },
    });

    expect(tracks.status).toBe(200);
    expect((await tracks.json()) as unknown[]).not.toHaveLength(0);
  });

  it("serves the field seam 3 reads the Person Identifier from", async () => {
    const key = await signIn();

    const me = await fetch(`${WEB}/dj-rest-auth/user/`, {
      headers: { accept: "application/json", authorization: `Token ${key}` },
    });
    expect(me.status).toBe(200);

    // The endpoint that application's own profile screen calls, which is where
    // seam 3 will read the identifier (`issue #34`). This Person existed before
    // the pilot, so hers is null — the value belongs to an arrival through the
    // Broker, and that one is a browser's to drive. What a Person arriving here
    // cannot show, the field being served at all can: drop it from the
    // serializer and seam 3 has nothing to read.
    //
    // It needs the application half of `issue #30` on `federation`, which is
    // the branch `scripts/checkout-apps.sh` builds. Until that merges this is
    // the one case here that an un-integrated OpenRed fails — which is the
    // merge order this repository already owes the applications, asserted
    // rather than written down.
    const person = (await me.json()) as Record<string, unknown>;
    expect(person).toHaveProperty("ibercivis_account_id");
    expect(person.ibercivis_account_id).toBeNull();
  });
});
