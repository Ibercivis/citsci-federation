import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseEnv } from "node:util";

/**
 * Real secrets are referenced, never declared. The realm names each one as
 * `${NAME}`; `.env.local`, which git ignores, values it on a machine that has
 * it; `.env.example` says which names those are, with no values. Receiving
 * the Google and GitHub keys must not make this repository unpublishable.
 *
 * Every other `${NAME}` the realm references is a development constant valued
 * in `.env`, on purpose, and is not a secret this file guards.
 */

const ROOT = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf8");
const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });

/** Every name the realm's layers reference as `${NAME}` or `${NAME:default}`. */
const referenced = new Set(
  ["broker/realm/base.json", "broker/realm/testing.json"].flatMap((path) =>
    [...read(path).matchAll(/\$\{([A-Z_][A-Z0-9_]*)(?::[^}]*)?\}/g)].map(
      (match) => match[1] ?? "",
    ),
  ),
);

/** Valued in the tracked `.env`: the development constants. */
const constants = new Set(Object.keys(parseEnv(read(".env"))));

/** Named in `.env.example`, commented out, each with what it carries there.
 *  Commented because an empty `NAME=` is set, and the realm's default applies
 *  only to a name that is not. */
const exampleText = read(".env.example");
const example = Object.fromEntries(
  [...exampleText.matchAll(/^#[ \t]*([A-Z_][A-Z0-9_]*)=(.*)$/gm)].map(
    ([, name = "", value = ""]) => [name, value.trim()],
  ),
);

/** The names the realm references and the tracked `.env` does not value. The
 *  testing layer's `${MOCK_ISSUER}` is written in by `derive.ts`, from `.env`. */
const secrets = [...referenced].filter((name) => !constants.has(name));

describe("the secrets the realm references", () => {
  it("are each named in .env.example", () => {
    expect(Object.keys(example).toSorted()).toEqual(secrets.toSorted());
  });

  it("carry no value in .env.example", () => {
    const valued = Object.entries(example).filter(([, value]) => value !== "");

    expect(valued).toEqual([]);
  });

  it("are set by nothing in .env.example that a copy would keep", () => {
    // Uncommented, even empty, a name copied into `.env.local` is set, and
    // the source's button fails at the Broker instead of at the source.
    expect(Object.keys(parseEnv(exampleText))).toEqual([]);
  });

  it("are valued in a file git ignores", () => {
    // `--no-index`, so a file that does not exist on this machine is still
    // asked about: the rule is what matters, not whether anybody has the keys.
    expect(() =>
      git("check-ignore", "--quiet", "--no-index", ".env.local"),
    ).not.toThrow();
  });

  it("are valued in no tracked file", () => {
    const tracked = git("ls-files", "-z").split("\0").filter(Boolean);
    const valuedIn = tracked.filter((path) => {
      let text: string;
      try {
        text = read(path);
      } catch {
        return false;
      }
      // `NAME=value` in a shell or env file, `NAME: value` or `- NAME=value`
      // in YAML, the name quoted or not. A value that is itself a `${…}`
      // only passes the name on, and is not one.
      return secrets.some((name) =>
        new RegExp(
          `^[ \\t]*(?:export[ \\t]+|-[ \\t]+)?(["']?)${name}\\1[ \\t]*[:=][ \\t]*(?!["']?\\$\\{)\\S`,
          "m",
        ).test(text),
      );
    });

    expect(valuedIn).toEqual([]);
  });
});
