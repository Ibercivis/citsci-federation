import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  ACCOUNT_CONSOLE,
  CLIENT_TYPES,
  CONFIDENTIAL_CLIENT,
} from "./clients.ts";
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
import { ISSUER, PERSON_IDENTIFIER } from "./broker.ts";
import { linkMailedTo, mailCountTo } from "./mailbox.ts";
import {
  AFFIRMING_SOURCE_A,
  AFFIRMING_SOURCE_B,
  arriving,
} from "./mock-source.ts";

/**
 * The Local Credential (ADR-0005): an email address and a password the Broker
 * holds itself, for whoever has no other Identity Source to arrive through.
 *
 * Each case registers at an address of its own: the suite shares one Broker,
 * and a Person outlives the case that created them.
 */

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
 * A page the Broker's sign-in page links to, reached the way a Person reaches
 * it: from the sign-in page an application sent them to, by the link whose
 * text matches. Returns the form on it that carries `field`; `what` names the
 * page in the failure.
 */
async function offeredOnSignIn(
  link: RegExp,
  field: string,
  what: string,
): Promise<Registering> {
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
  const offer = linksOn(signIn).find((each) => link.test(each.text));
  if (!offer) throw new Error(`The sign-in page offers no ${what}.`);

  const page = await pageAfter(browser, await browser.get(offer.href));
  const form = formsOn(page).find((candidate) => field in candidate.fields);
  if (!form) throw new Error(`The ${what} page carries no form.`);
  return { browser, pkce, form };
}

/** The Broker's registration form. */
const registrationForm = () =>
  offeredOnSignIn(/register/i, "email", "registration");

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
  browser: Browser,
  address: string,
): Promise<HtmlForm> {
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
  browser: Browser,
  form: HtmlForm,
  password: string,
): Promise<Landing> {
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
  const { browser } = registering;
  const form = await openConfirmation(browser, address);
  const code = codeIn(await choosePassword(browser, form, password));
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
      const delegated = await everyPlace(
        client,
        arriving(AFFIRMING_SOURCE_A, "merge-verified"),
      );

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
    const { browser } = await register(address);
    const form = await openConfirmation(browser, address);

    const landing = await choosePassword(browser, form, "elevenchars");

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
  const { browser, form: ask } = await offeredOnSignIn(
    /forgot/i,
    "username",
    "recovery",
  );

  const seen = await mailCountTo(address);
  await browser.postForm(ask.action, { ...ask.fields, username: address });
  const chosen = await pageAfter(
    browser,
    await browser.get(await linkMailedTo(address, seen)),
  );
  const form = formsOn(chosen).find((each) => "password-new" in each.fields);
  if (!form) throw new Error("The recovery link asked for no password.");
  await choosePassword(browser, form, password);
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

/** Authorization at the Account Console, in a browser of the Person's. */
async function toTheConsole(
  browser: Browser,
  pkce: Pkce,
  params: Record<string, string> = {},
): Promise<Landing> {
  return follow(
    browser,
    await requestAuthorization(browser, ACCOUNT_CONSOLE, {
      nonce: randomUUID(),
      code_challenge: pkce.challenge,
      code_challenge_method: pkce.method,
      ...params,
    }),
    ACCOUNT_CONSOLE,
  );
}

/** A Person signed in to the Account Console: the browser holding that
 *  session, and the access token the console holds. */
interface InTheConsole {
  browser: Browser;
  accessToken: string;
}

/** Signs a Person in to the Account Console with their Local Credential. */
async function signedInToTheConsole(address: string): Promise<InTheConsole> {
  const browser = new Browser();
  const pkce = createPkce("S256");
  const shown = await toTheConsole(browser, pkce);
  const signIn =
    shown.at === "a page"
      ? formsOn(shown.page).find((form) => "password" in form.fields)
      : undefined;
  if (!signIn) throw new Error("The Account Console asked nobody to sign in.");
  const code = codeIn(
    await follow(
      browser,
      await browser.postForm(signIn.action, {
        ...signIn.fields,
        username: address,
        password: A_PASSWORD,
        login: "",
      }),
      ACCOUNT_CONSOLE,
    ),
  );
  if (!code) throw new Error("Signing in to the console sent back no code.");
  const tokens = await redeemCode(ACCOUNT_CONSOLE, {
    code,
    code_verifier: pkce.verifier,
  });
  return { browser, accessToken: tokens.body.access_token ?? "" };
}

/**
 * Starts one of the console's actions the way its own buttons do: by sending
 * the Person to the Broker's page for it, with `kc_action`. Fills in the form
 * that page shows, found by the field it carries, and sends it. The console
 * has no other way to change a password or an address: the account API takes
 * neither (`docs/notes/2026-11-18-account-rest-api-credential-operations.md`).
 */
async function consoleAction(
  { browser }: InTheConsole,
  action: string,
  answer: Record<string, string>,
): Promise<void> {
  const asked = await toTheConsole(browser, createPkce("S256"), {
    kc_action: action,
  });
  const field = Object.keys(answer)[0] ?? "";
  const form =
    asked.at === "a page"
      ? formsOn(asked.page).find((each) => field in each.fields)
      : undefined;
  if (!form) throw new Error(`The console's ${action} asked for no ${field}.`);
  await browser.postForm(form.action, { ...form.fields, ...answer });
}

/** Asks for a new address. The Broker takes it and mails it, which is not yet
 *  a change. */
const askToChangeAddress = (console: InTheConsole, newAddress: string) =>
  consoleAction(console, "UPDATE_EMAIL", { email: newAddress });

/** Chooses a new password, which takes effect at once. */
const changePassword = (console: InTheConsole, password: string) =>
  consoleAction(console, "UPDATE_PASSWORD", {
    "password-new": password,
    "password-confirm": password,
  });

/**
 * Writes a new address straight into the Person's account, through the same
 * API the console reads it from, with no page and no mail in between — the
 * route that would exist if changing an address did not require confirming it.
 */
async function writeAddress(accessToken: string, newAddress: string) {
  const headers = {
    authorization: `Bearer ${accessToken}`,
    accept: "application/json",
    "content-type": "application/json",
  };
  const account = (await (
    await fetch(`${ISSUER}/account`, { headers })
  ).json()) as Record<string, unknown>;
  await fetch(`${ISSUER}/account`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...account, email: newAddress }),
  });
}

/** The address the Account Console shows the Person, read the way the console
 *  reads it. */
async function addressShownInTheConsole(accessToken: string): Promise<string> {
  const response = await fetch(`${ISSUER}/account`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
    },
  });
  const body = (await response.json()) as { email?: string };
  return body.email ?? `HTTP ${response.status}, no address`;
}

describe("changing the address in the Account Console", () => {
  // Otherwise whoever holds an account could claim any address by typing it,
  // and be joined by whoever later arrives verified at it (ADR-0004).

  it("takes no address written straight into the account", async () => {
    const { address } = await personWithALocalCredential();
    const console = await signedInToTheConsole(address);

    await writeAddress(console.accessToken, freshAddress());

    expect(await addressShownInTheConsole(console.accessToken)).toBe(address);
  });

  it("keeps the old address until the new one is confirmed", async () => {
    const { address } = await personWithALocalCredential();
    const console = await signedInToTheConsole(address);

    await askToChangeAddress(console, freshAddress());

    expect(await addressShownInTheConsole(console.accessToken)).toBe(address);
  });

  it("keeps the Person Identifier once the new address is confirmed", async () => {
    const { address, sub } = await personWithALocalCredential();
    const newAddress = freshAddress();

    await askToChangeAddress(await signedInToTheConsole(address), newAddress);
    await new Browser().get(await linkMailedTo(newAddress));

    const withNew = await authenticate(
      CONFIDENTIAL_CLIENT,
      signingIn(newAddress),
    );
    const withOld = await attempt(CONFIDENTIAL_CLIENT, signingIn(address));
    expect(withNew.claims.sub).toBe(sub);
    expect(withOld.outcome).toBe("refused-in-the-browser");
  });

  it("keeps every Identity joined to the Person once the new address is confirmed", async () => {
    // One Person holding two Identities, joined by their verified address. On
    // a Broker that has run this before, both come back by their link instead,
    // to the same Person, whatever address they hold by now.
    //
    // Being the same Person every run has a cost. Keycloak mails one Person a
    // confirmation at most every 30 seconds, and the suite runs in less, so a
    // second run straight after the first fails here with "No mail reached".
    // The merge is not what broke. Wait half a minute, or `pnpm broker:reset`.
    // The limit is base configuration, so lowering it here would lower it in
    // production too.
    const first = await authenticate(
      CONFIDENTIAL_CLIENT,
      arriving(AFFIRMING_SOURCE_A, "renamed-verified"),
    );
    const second = await authenticate(
      CONFIDENTIAL_CLIENT,
      arriving(AFFIRMING_SOURCE_B, "renamed-verified"),
    );
    expect(second.claims.sub, "the two Identities were never joined").toBe(
      first.claims.sub,
    );

    const browser = new Browser();
    const { accessToken } = await authenticate(ACCOUNT_CONSOLE, {
      ...arriving(AFFIRMING_SOURCE_A, "renamed-verified"),
      browser,
    });
    const newAddress = freshAddress();
    await askToChangeAddress({ browser, accessToken }, newAddress);
    await new Browser().get(await linkMailedTo(newAddress));

    const throughA = await authenticate(
      CONFIDENTIAL_CLIENT,
      arriving(AFFIRMING_SOURCE_A, "renamed-verified"),
    );
    const throughB = await authenticate(
      CONFIDENTIAL_CLIENT,
      arriving(AFFIRMING_SOURCE_B, "renamed-verified"),
    );
    expect(throughA.claims.sub).toBe(first.claims.sub);
    expect(throughB.claims.sub).toBe(first.claims.sub);
    // Both arrivals said renamed@mock.test. A source that writes its address
    // back on every sign-in, `syncMode: FORCE`, would have undone the change.
    expect(await addressShownInTheConsole(accessToken)).toBe(newAddress);
  });
});

describe("changing the password in the Account Console", () => {
  it("replaces the old password with the new one", async () => {
    const { address, sub } = await personWithALocalCredential();

    await changePassword(
      await signedInToTheConsole(address),
      "a new password, chosen in the console",
    );

    const withNew = await authenticate(
      CONFIDENTIAL_CLIENT,
      signingIn(address, "a new password, chosen in the console"),
    );
    const withOld = await attempt(CONFIDENTIAL_CLIENT, signingIn(address));
    expect(withNew.claims.sub).toBe(sub);
    expect(withOld.outcome).toBe("refused-in-the-browser");
  });
});

describe("the Account Console", () => {
  it("shows the Person the Identities they arrived with", async () => {
    const { accessToken } = await authenticate(
      ACCOUNT_CONSOLE,
      arriving(AFFIRMING_SOURCE_A, "merge-verified"),
    );

    const response = await fetch(`${ISSUER}/account/linked-accounts`, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
      },
    });
    const identities = (await response.json()) as Array<{
      displayName: string;
      connected: boolean;
    }>;

    expect(
      identities
        .filter((identity) => identity.connected)
        .map((identity) => identity.displayName),
    ).toContain(AFFIRMING_SOURCE_A);
  });
});
