import { execFileSync } from "node:child_process";
import { request } from "node:http";
import { beforeAll, describe, expect, it } from "vitest";
import { type Discovery, ISSUER, fetchDiscovery } from "./broker.ts";

/** Reads the discovery document while claiming to be a different host, the way
 *  a containerised Federated App on the compose network would appear. */
function discoveryAsHost(host: string): Promise<Discovery> {
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
        response.on("end", () => {
          try {
            resolve(JSON.parse(body) as Discovery);
          } catch (cause) {
            reject(new Error(`Not JSON: ${body.slice(0, 200)}`, { cause }));
          }
        });
      },
    );
    call.on("error", reject);
    call.end();
  });
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

  it("gives a Federated App the endpoints it needs to run a code flow", () => {
    expect(discovery.authorization_endpoint).toContain(ISSUER);
    expect(discovery.token_endpoint).toContain(ISSUER);
    expect(discovery.jwks_uri).toContain(ISSUER);
  });

  it("lets a Federated App validate tokens knowing only the issuer", async () => {
    // What a Federated App holds is one configured string, and everything it
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

  it("names the same issuer whoever asks, and from wherever", async () => {
    // Unpinned, Keycloak derives the issuer from the host it was asked
    // through: a browser would be told one issuer and a container on the
    // compose network another. Two issuers for one Broker is what a Federated
    // App must never see, and a Federated App validates `iss` — so it would
    // break inside the network, with an error that names nothing.
    const asAContainerWouldAppear = await discoveryAsHost("keycloak:8080");

    expect(asAContainerWouldAppear.issuer).toBe(ISSUER);
  });

  it("answers to that issuer's own hostname from inside the network", () => {
    // The other half of one issuer: the name has to resolve on both sides of
    // the port mapping, or a Federated App cannot reach the issuer it is told
    // to trust — a Person would sign in and the application would fail to
    // fetch a key. Nothing on the host can prove that, so this case runs
    // inside the compose network, where the applications will run. It asks
    // compose for a throwaway container of a service this file declares, so
    // no image tag and no network name is spelled out twice, and speaks HTTP
    // over the shell's own TCP redirection, because that image ships no curl.
    //
    // It runs in the Keycloak container rather than the proxy's on purpose:
    // that image is glibc, like the Federated Apps' images, and musl resolves
    // anything under .localhost to the loopback itself without ever asking
    // Docker's DNS. Run from the Alpine-based proxy, this case would pass by
    // accident and say nothing.
    //
    // This is the one case here that names a service of the stack rather than
    // speaking only the protocol. What it asserts is still a property a
    // Federated App observes from where it will actually run, not a fact about
    // Keycloak: replacing the provider would change the service named on this
    // line and nothing else about the case.
    const { hostname, port, pathname } = new URL(ISSUER);
    const probeScript = [
      `exec 3<>/dev/tcp/${hostname}/${port}`,
      `printf 'GET ${pathname}/.well-known/openid-configuration ` +
        `HTTP/1.1\\r\\nHost: ${hostname}:${port}\\r\\nConnection: close\\r\\n\\r\\n' >&3`,
      "cat <&3",
    ].join(" && ");
    const probe = execFileSync(
      "docker",
      [
        "compose",
        "run",
        "--rm",
        "-T",
        "--entrypoint",
        "sh",
        "keycloak",
        "-c",
        probeScript,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );

    expect(probe).toContain("HTTP/1.1 200");
    expect(probe).toContain(`"issuer":"${ISSUER}"`);
  }, 120_000);
});
