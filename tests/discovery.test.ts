import { request } from "node:http";
import { beforeAll, describe, expect, it } from "vitest";
import { type Discovery, ISSUER, fetchDiscovery } from "./broker.ts";
import { inContainer, runningStack } from "./stack.ts";

/** Asks the proxy for the discovery path while claiming to be a given host,
 *  and reports what came back without interpreting it: a hostname the
 *  composition does not serve is answered by the proxy itself, so there is no
 *  document to parse. */
function throughTheProxyAsHost(
  host: string,
): Promise<{ status: number; body: string }> {
  const issuer = new URL(ISSUER);
  return new Promise((resolve, reject) => {
    const call = request(
      {
        host: "127.0.0.1",
        port: issuer.port,
        path: `${issuer.pathname}/.well-known/openid-configuration`,
        headers: { host },
      },
      (response) => {
        let body = "";
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () =>
          resolve({ status: response.statusCode ?? 0, body }),
        );
      },
    );
    call.on("error", reject);
    call.end();
  });
}

const STACK = runningStack();

/**
 * Reads the discovery document from inside the compose network, speaking to
 * the authority given — which is how a containerised Brokered App reaches the
 * Broker, and the only place some of these properties are observable at all.
 *
 * It asks compose for a shell in a container the stack already has up, so no
 * image tag and no network name is spelled out twice, and speaks HTTP over
 * the shell's own TCP redirection, because that image ships no curl. A
 * throwaway container of the same service would read the same and used to:
 * `tests/stack.ts` says what it left behind.
 *
 * It runs in the Keycloak container rather than the proxy's on purpose: that
 * image is glibc, like the Brokered Apps' images, and musl resolves anything
 * under .localhost to the loopback itself without ever asking Docker's DNS.
 * Run from the Alpine-based proxy, a case using this would pass by accident
 * and say nothing.
 *
 * This is the one thing here that names a service of the stack rather than
 * speaking only the protocol. What the cases below assert is still what a
 * Brokered App observes from where it will actually run: replacing the
 * provider would change the service named on this line and nothing else.
 */
function fromInsideTheNetwork(hostname: string, port: string): string {
  const probeScript = [
    `exec 3<>/dev/tcp/${hostname}/${port}`,
    `printf 'GET ${new URL(ISSUER).pathname}/.well-known/openid-configuration ` +
      `HTTP/1.1\r\nHost: ${hostname}:${port}\r\nConnection: close\r\n\r\n' >&3`,
    "cat <&3",
  ].join(" && ");
  return inContainer(STACK, "keycloak", probeScript);
}

describe("the Broker announces itself as one issuer", () => {
  let discovery: Discovery;

  beforeAll(async () => {
    discovery = await fetchDiscovery();
  });

  it("serves a discovery document whose issuer is the configured value", () => {
    // Not a value assembled here from a hostname and a realm name, and not
    // one read out of a database: the string this repository configures, as
    // ADR-0001 requires.
    expect(discovery.issuer).toBe(ISSUER);
  });

  it("keeps /realms/<name> in the path", () => {
    // Stripping it fights Keycloak's multi-realm design and, with ADR-0001
    // and ADR-0002 in place, protects nothing still at risk. The reverse
    // proxy in front rewrites nothing.
    expect(new URL(discovery.issuer).pathname).toMatch(/^\/realms\/[^/]+$/);
  });

  it("gives a Brokered App the endpoints it needs to run a code flow", () => {
    expect(discovery.authorization_endpoint).toContain(ISSUER);
    expect(discovery.token_endpoint).toContain(ISSUER);
    expect(discovery.jwks_uri).toContain(ISSUER);
  });

  it("lets a Brokered App validate tokens knowing only the issuer", async () => {
    // What a Brokered App holds is one configured string, and everything it
    // needs to check a token has to be reachable from it: it persists no
    // issuer, keeps no copy of a key (ADR-0001). So this starts from the
    // string and walks, rather than from the helper the rest of the suite
    // uses — the walk is the evidence.
    const announced = await fetch(`${ISSUER}/.well-known/openid-configuration`);
    expect(announced.ok).toBe(true);
    const { jwks_uri } = (await announced.json()) as Discovery;

    const published = (await (await fetch(jwks_uri)).json()) as {
      keys?: unknown[];
    };

    expect(published.keys).toEqual(expect.any(Array));
    expect(published.keys?.length).toBeGreaterThan(0);
  });

  it("names the same issuer whoever asks, and from wherever", () => {
    // Unpinned, Keycloak derives the issuer from the host it was asked
    // through: a browser would be told one issuer and a container on the
    // compose network another. Two issuers for one Broker is what a Brokered
    // App must never see, and a Brokered App validates `iss` — so it would
    // break inside the network, with an error that names nothing.
    //
    // Asked at its service name, which is the one address that reaches the
    // provider without passing the proxy at all. The proxy used to forward
    // any hostname and this case faked a Host header through it; it now
    // serves only the names it is configured with (proxy/Caddyfile), so the
    // question has to be put to the provider directly or not at all.
    const asAContainerWouldAppear = fromInsideTheNetwork("keycloak", "8080");

    expect(asAContainerWouldAppear).toContain("HTTP/1.1 200");
    expect(asAContainerWouldAppear).toContain(`"issuer":"${ISSUER}"`);
  });

  it("is not reachable through the proxy by a hostname it does not serve", async () => {
    // The composition's whole shape rests on a hostname being the only way
    // in (ADR-0001, ADR-0012): a request that reached the Broker as
    // `localhost:8080` would succeed, and would succeed with cookies and a
    // `redirect_uri` production never sees. So the proxy answers for itself
    // rather than forwarding, and what it answers is a refusal.
    //
    // `localhost` rather than an invented name on purpose: it is the address
    // somebody actually types, and the one a published port would have made
    // work.
    const refused = await throughTheProxyAsHost("localhost:8080");

    expect(refused.status).toBe(404);
    expect(refused.body).not.toContain('"issuer"');
  });

  it("answers to that issuer's own hostname from inside the network", () => {
    // The other half of one issuer: the name has to resolve on both sides of
    // the port mapping, or a Brokered App cannot reach the issuer it is told
    // to trust — a Person would sign in and the application would fail to
    // fetch a key. Nothing on the host can prove that, so this case runs
    // inside the compose network, where the applications will run.
    const { hostname, port } = new URL(ISSUER);
    const probe = fromInsideTheNetwork(hostname, port);

    expect(probe).toContain("HTTP/1.1 200");
    expect(probe).toContain(`"issuer":"${ISSUER}"`);
    // Through the proxy, and provably so. The probe runs in the Keycloak
    // container, whose own 8080 announces the same issuer, so a resolver that
    // sent `.localhost` to the loopback rather than to Docker's DNS would
    // satisfy both assertions above without the alias existing at all. `Via`
    // is what only the proxy adds (RFC 9110); glibc 2.34 asks Docker today,
    // and this is what notices if a later one stops.
    expect(probe).toContain("Via: 1.1 Caddy");
  });
});
