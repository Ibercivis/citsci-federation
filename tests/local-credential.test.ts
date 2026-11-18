import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CLIENT_TYPES, CONFIDENTIAL_CLIENT } from "./clients.ts";
import {
  Browser,
  type HtmlForm,
  type Landing,
  type Page,
  type Pkce,
  attempt,
  authenticate,
  createPkce,
  everyPlace,
  follow,
  formsOn,
  linksOn,
  redeemCode,
  requestAuthorization,
  verifyIdToken,
} from "./brokered-app.ts";
import { linkMailedTo, mailCountTo } from "./mailbox.ts";
import { AFFIRMING_SOURCE_A, MOCK_IDENTITIES } from "./mock-source.ts";

/**
 * The Local Credential (ADR-0005): an email address and a password the Broker
 * holds itself, for whoever has no other Identity Source to arrive through.
 *
 * Each case registers at an address of its own: the suite shares one Broker,
 * and a Person outlives the case that created them.
 */

const PERSON_IDENTIFIER =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@ibercivis\.es$/;

/** An address nobody has registered yet. */
const freshAddress = (): string => `${randomUUID()}@local.test`;

/** Long enough for the declared policy, and nothing else about it. */
const A_PASSWORD = "correct horse battery";

/** The page a Person is on, or a failure saying where they ended instead. */
async function pageAfter(browser: Browser, response: Response): Promise<Page> {
  const landing = await follow(browser, response, CONFIDENTIAL_CLIENT);
  if (landing.at !== "a page") {
    throw new Error(`Sent back to the application at ${landing.location}.`);
  }
  return landing.page;
}

/** A registration under way: the browser it happens in, and the PKCE pair the
 *  application that sent the Person there would redeem its code with. */
interface Registering {
  browser: Browser;
  pkce: Pkce;
  form: HtmlForm;
}

/**
 * The Broker's registration form, reached the way a Person reaches it: from
 * the sign-in page an application sent them to, by the link that offers it.
 */
async function registrationForm(): Promise<Registering> {
  const browser = new Browser();
  const pkce = createPkce("S256");
  const signIn = await pageAfter(
    browser,
    await requestAuthorization(browser, CONFIDENTIAL_CLIENT, {
      nonce: randomUUID(),
      code_challenge: pkce.challenge,
      code_challenge_method: pkce.method,
    }),
  );
  const offer = linksOn(signIn).find((link) => /register/i.test(link.text));
  if (!offer) throw new Error("The sign-in page offers no registration.");

  const page = await pageAfter(browser, await browser.get(offer.href));
  const form = formsOn(page).find((candidate) => "email" in candidate.fields);
  if (!form) throw new Error("The registration page carries no form.");
  return { browser, pkce, form };
}

/**
 * Fills the registration form in and sends it, and says where that left the
 * Person.
 *
 * The form asks for the address alone. The password is set only once the
 * address is confirmed, so until then there is no credential to sign in with
 * at all — which is Keycloak's own behaviour once the realm confirms
 * addresses, and the stricter of the two it offers.
 */
async function register(
  address: string,
): Promise<Registering & { landing: Landing }> {
  const registering = await registrationForm();
  const { browser, form } = registering;
  const response = await browser.postForm(form.action, {
    ...form.fields,
    email: address,
  });
  const landing = await follow(browser, response, CONFIDENTIAL_CLIENT);
  return { ...registering, landing };
}

/**
 * Presses Yes on the consent page if that is where the Person is, and says
 * where they came to rest. A Person who reaches the application this way was
 * granted a sign-in; one left on any other page was not.
 */
async function pastConsent(
  browser: Browser,
  landing: Landing,
): Promise<Landing> {
  if (landing.at !== "a page") return landing;
  const consent = formsOn(landing.page).find(
    (form) => "accept" in form.controls,
  );
  if (!consent) return landing;
  return follow(
    browser,
    await browser.postForm(consent.action, { ...consent.fields, accept: "" }),
    CONFIDENTIAL_CLIENT,
  );
}

/** The authorization code a landing carries, or null when the Person was
 *  sent back with none — or never sent back at all. */
const codeIn = (landing: Landing): string | null =>
  landing.at === "the application"
    ? new URL(landing.location).searchParams.get("code")
    : null;

/**
 * Follows the link the Broker mailed to the address, in the browser that
 * registered, and returns the form that then asks for a password.
 */
async function openConfirmation(
  registering: Registering,
  address: string,
): Promise<HtmlForm> {
  const { browser } = registering;
  const confirmed = await pageAfter(
    browser,
    await browser.get(await linkMailedTo(address)),
  );
  const form = formsOn(confirmed).find((each) => "password-new" in each.fields);
  if (!form) throw new Error("Confirming asked for no password.");
  return form;
}

/** Chooses a password on that form, and says where it left the Person. */
async function choosePassword(
  registering: Registering,
  form: HtmlForm,
  password: string,
): Promise<Landing> {
  const { browser } = registering;
  return pastConsent(
    browser,
    await follow(
      browser,
      await browser.postForm(form.action, {
        ...form.fields,
        "password-new": password,
        "password-confirm": password,
      }),
      CONFIDENTIAL_CLIENT,
    ),
  );
}

/**
 * Everything a Person does between registering and being signed in:
 * confirming the address, choosing a password, and coming back to the
 * application with a code, which is redeemed here as the application would.
 */
async function confirm(
  registering: Registering,
  address: string,
  password = A_PASSWORD,
): Promise<Record<string, unknown>> {
  const form = await openConfirmation(registering, address);
  const code = codeIn(await choosePassword(registering, form, password));
  if (!code) {
    throw new Error("Confirming did not send the Person back signed in.");
  }
  const tokens = await redeemCode(CONFIDENTIAL_CLIENT, {
    code,
    code_verifier: registering.pkce.verifier,
  });
  return verifyIdToken(tokens.body.id_token ?? "", CONFIDENTIAL_CLIENT);
}

/** Signing in on the Broker's own form, with the address as the username. */
const signingIn = (address: string, password = A_PASSWORD) => ({
  as: { username: address, password },
  pkce: createPkce("S256"),
});

describe("registering a Local Credential", () => {
  it("asks for an email address, and for no username", async () => {
    const { form } = await registrationForm();

    expect(Object.keys(form.fields)).toContain("email");
    expect(Object.keys(form.fields)).not.toContain("username");
  });

  it("grants nothing until the address is confirmed", async () => {
    const address = freshAddress();

    const { browser, landing } = await register(address);
    // The Person goes back to the application that sent them, as if to try
    // again, without having opened the mail.
    const again = await pastConsent(
      browser,
      await follow(
        browser,
        await requestAuthorization(browser, CONFIDENTIAL_CLIENT, {
          nonce: randomUUID(),
          code_challenge: createPkce("S256").challenge,
          code_challenge_method: "S256",
        }),
        CONFIDENTIAL_CLIENT,
      ),
    );

    expect(codeIn(await pastConsent(browser, landing))).toBeNull();
    expect(codeIn(again)).toBeNull();
  });

  it("signs the Person in once they confirm, as a Person Identifier", async () => {
    const address = freshAddress();

    const claims = await confirm(await register(address), address);

    expect(claims.sub).toMatch(PERSON_IDENTIFIER);
  });
});

/** What a Brokered App reads in each place: the claims it finds there, by name. */
const claimNames = (places: Array<[string, Record<string, unknown>]>) =>
  places.map(([place, body]) => [place, Object.keys(body).toSorted()]);

describe.each(CLIENT_TYPES)(
  "a %s Brokered App cannot tell a Local Credential from another source",
  (_shape, client) => {
    it("finds the Person Identifier in the same places, among the same claims", async () => {
      const address = freshAddress();
      await confirm(await register(address), address);

      const local = await everyPlace(client, signingIn(address));
      const delegated = await everyPlace(client, {
        as: {
          through: AFFIRMING_SOURCE_A,
          username: "merge-verified",
          password: MOCK_IDENTITIES["merge-verified"].password,
        },
        pkce: createPkce("S256"),
      });

      expect(local.idToken.sub).toMatch(PERSON_IDENTIFIER);
      for (const [place, body] of local.places) {
        expect(body.sub, `sub in ${place}`).toBe(local.idToken.sub);
        expect(body.voperson_id, `voperson_id in ${place}`).toBe(
          local.idToken.sub,
        );
      }
      expect(claimNames(local.places)).toEqual(claimNames(delegated.places));
    });
  },
);

describe("the declared password policy", () => {
  it("refuses a password shorter than twelve characters", async () => {
    const address = freshAddress();
    const registering = await register(address);
    const form = await openConfirmation(registering, address);

    const landing = await choosePassword(registering, form, "elevenchars");

    expect(codeIn(landing)).toBeNull();
    // Still asked for one, rather than turned away.
    expect(
      landing.at === "a page" &&
        formsOn(landing.page).some((each) => "password-new" in each.fields),
    ).toBe(true);
  });

  it("accepts twelve characters of a single kind: there are no composition rules", async () => {
    const address = freshAddress();

    const claims = await confirm(
      await register(address),
      address,
      "aaaaaaaaaaaa",
    );

    expect(claims.sub).toMatch(PERSON_IDENTIFIER);
  });
});

/** A Person who has registered, confirmed their address and chosen a
 *  password: somebody with a Local Credential to sign in with. */
async function personWithALocalCredential(password = A_PASSWORD) {
  const address = freshAddress();
  const claims = await confirm(await register(address), address, password);
  return { address, sub: claims.sub };
}

/**
 * Asks the Broker to recover the password for an address, from the link its
 * sign-in page offers, follows the link that is mailed, and chooses a new
 * password where that link leads.
 */
async function recover(address: string, password: string): Promise<void> {
  const browser = new Browser();
  const pkce = createPkce("S256");
  const signIn = await pageAfter(
    browser,
    await requestAuthorization(browser, CONFIDENTIAL_CLIENT, {
      nonce: randomUUID(),
      code_challenge: pkce.challenge,
      code_challenge_method: pkce.method,
    }),
  );
  const offer = linksOn(signIn).find((link) => /forgot/i.test(link.text));
  if (!offer) throw new Error("The sign-in page offers no recovery.");
  const page = await pageAfter(browser, await browser.get(offer.href));
  const ask = formsOn(page).find((form) => "username" in form.fields);
  if (!ask) throw new Error("The recovery page carries no form.");

  const seen = await mailCountTo(address);
  await browser.postForm(ask.action, { ...ask.fields, username: address });
  const chosen = await pageAfter(
    browser,
    await browser.get(await linkMailedTo(address, seen)),
  );
  const form = formsOn(chosen).find((each) => "password-new" in each.fields);
  if (!form) throw new Error("The recovery link asked for no password.");
  await choosePassword({ browser, pkce, form }, form, password);
}

describe("recovering a forgotten password", () => {
  it("is done by mail, and the new password replaces the old one", async () => {
    const { address, sub } = await personWithALocalCredential();

    await recover(address, "a new password, chosen by mail");

    const withNew = await authenticate(
      CONFIDENTIAL_CLIENT,
      signingIn(address, "a new password, chosen by mail"),
    );
    const withOld = await attempt(CONFIDENTIAL_CLIENT, signingIn(address));
    expect(withNew.claims.sub).toBe(sub);
    expect(withOld.outcome).toBe("refused-in-the-browser");
  });
});
