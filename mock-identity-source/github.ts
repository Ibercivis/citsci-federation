/**
 * The Mock Identity Source imitating GitHub: the four endpoints Keycloak's
 * GitHub provider calls, at the paths it calls them, answering what
 * `mock.json` declares under `github`.
 *
 * GitHub is not an OpenID provider. It says nothing about an address in a
 * token: whether one is verified is a field in the `/user/emails` list, beside
 * `primary`. That field is what the Broker has to read, and no OpenID mock can
 * stage it, so this one serves the list itself.
 *
 * The Broker points its `baseUrl` at `/github` and its `apiUrl` at
 * `/github/api`. Codes and tokens live in memory: a restart forgets them,
 * which costs a sign-in in flight and nothing else.
 */

import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import declaration from "./mock.json" with { type: "json" };

type GitHubIdentity =
  (typeof declaration.github.identities)[keyof typeof declaration.github.identities];

const IDENTITIES: Record<string, GitHubIdentity> =
  declaration.github.identities;

export const GITHUB_PREFIX = "/github";

interface Options {
  /** Where the Broker sends a Person back for this source's alias. */
  brokerCallback: string;
  /** The sign-in page this server shows for every source it stands behind. */
  signInPage: (
    action: string,
    complaint: string,
    carried: Record<string, string>,
  ) => string;
  formBody: (req: IncomingMessage) => Promise<URLSearchParams>;
}

const AUTHORIZE = `${GITHUB_PREFIX}/login/oauth/authorize`;

const send = (
  res: ServerResponse,
  status: number,
  body: unknown,
  type = "application/json",
): void => {
  res.writeHead(status, { "content-type": type });
  res.end(type === "application/json" ? JSON.stringify(body) : String(body));
};

/** The client's credentials, posted or in a Basic header. */
function clientOf(req: IncomingMessage, form: URLSearchParams) {
  const basic = /^Basic (.+)$/i.exec(req.headers.authorization ?? "")?.[1];
  if (basic) {
    const [id = "", secret = ""] = Buffer.from(basic, "base64")
      .toString()
      .split(":");
    return { id: decodeURIComponent(id), secret: decodeURIComponent(secret) };
  }
  return {
    id: form.get("client_id") ?? "",
    secret: form.get("client_secret") ?? "",
  };
}

export function gitHubImitation({
  brokerCallback,
  signInPage,
  formBody,
}: Options) {
  const codes = new Map<string, string>();
  const tokens = new Map<string, string>();

  /** The login an access token was issued to, from either header form
   *  GitHub accepts. */
  const loginOf = (req: IncomingMessage): string | undefined => {
    const header = req.headers.authorization ?? "";
    const token = /^(?:Bearer|token) (.+)$/i.exec(header)?.[1] ?? "";
    return tokens.get(token);
  };

  return async (
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
  ): Promise<void> => {
    const path = url.pathname;

    if (path === AUTHORIZE && req.method === "GET") {
      const redirectUri = url.searchParams.get("redirect_uri") ?? "";
      if (
        url.searchParams.get("client_id") !== declaration.client.id ||
        redirectUri !== brokerCallback
      ) {
        send(res, 400, "Unknown client or redirect_uri.", "text/plain");
        return;
      }
      const carried = {
        redirect_uri: redirectUri,
        state: url.searchParams.get("state") ?? "",
      };
      send(
        res,
        200,
        signInPage(AUTHORIZE, "", carried),
        "text/html; charset=utf-8",
      );
      return;
    }

    if (path === AUTHORIZE && req.method === "POST") {
      const form = await formBody(req);
      const login = form.get("username") ?? "";
      const carried = {
        redirect_uri: form.get("redirect_uri") ?? "",
        state: form.get("state") ?? "",
      };
      if (
        carried.redirect_uri !== brokerCallback ||
        IDENTITIES[login]?.password !== form.get("password")
      ) {
        const complaint =
          "No mock GitHub Identity with that username and password.";
        send(
          res,
          401,
          signInPage(AUTHORIZE, complaint, carried),
          "text/html; charset=utf-8",
        );
        return;
      }
      const code = randomUUID();
      codes.set(code, login);
      const back = new URL(carried.redirect_uri);
      back.searchParams.set("code", code);
      back.searchParams.set("state", carried.state);
      res.writeHead(302, { location: back.toString() });
      res.end();
      return;
    }

    if (
      path === `${GITHUB_PREFIX}/login/oauth/access_token` &&
      req.method === "POST"
    ) {
      const form = await formBody(req);
      const client = clientOf(req, form);
      const login = codes.get(form.get("code") ?? "");
      codes.delete(form.get("code") ?? "");
      if (
        client.id !== declaration.client.id ||
        client.secret !== declaration.client.secret ||
        login === undefined
      ) {
        send(res, 400, { error: "bad_verification_code" });
        return;
      }
      const token = randomUUID();
      tokens.set(token, login);
      send(res, 200, {
        access_token: token,
        token_type: "bearer",
        scope: "user:email",
      });
      return;
    }

    const login = loginOf(req);
    const identity = login === undefined ? undefined : IDENTITIES[login];
    if (path === `${GITHUB_PREFIX}/api/user` && identity) {
      send(res, 200, {
        id: identity.id,
        login,
        name: null,
        email: identity.email,
      });
      return;
    }
    if (path === `${GITHUB_PREFIX}/api/user/emails` && identity) {
      send(res, 200, identity.emails);
      return;
    }
    send(res, 401, { message: "Requires authentication" });
  };
}
