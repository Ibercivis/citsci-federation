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
 * contract through its own origin, not the page a Person would see. Asserting
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

    const signIn = await fetch(`${WEB}/dj-rest-auth/login/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(SEEDED_PERSON),
    });
    expect(signIn.status).toBe(200);

    // Not a bearer token: that application sets `USE_JWT` off and keeps DRF's
    // own token model, so the credential is `key` and the scheme is `Token`.
    // The front end reads it the same way (`src/services/api.ts`).
    const { key } = (await signIn.json()) as { key?: string };
    expect(key).toBeTruthy();

    const tracks = await fetch(`${WEB}${path}`, {
      headers: { accept: "application/json", authorization: `Token ${key}` },
    });

    expect(tracks.status).toBe(200);
    expect((await tracks.json()) as unknown[]).not.toHaveLength(0);
  });
});
