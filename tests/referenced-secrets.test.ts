import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseEnv } from "node:util";
import { declaredCredentials } from "./realm.ts";

/**
 * Seam 2: no credential worth protecting is committed.
 *
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
      // in YAML, the name quoted or not. A value that is itself a `${…}` is
      // skipped here: it passes a name on rather than holding a secret, and
      // what it may default to is the case below.
      return secrets.some((name) =>
        new RegExp(
          `^[ \\t]*(?:export[ \\t]+|-[ \\t]+)?(["']?)${name}\\1[ \\t]*[:=][ \\t]*(?!["']?\\$\\{)\\S`,
          "m",
        ).test(text),
      );
    });

    expect(valuedIn).toEqual([]);
  });

  it("are defaulted to nothing but not-configured, in every tracked file", () => {
    // A default inside the interpolation is a value in the file as much as
    // one after the `=`: `${NAME:key}` in the realm, `${NAME:-key}` in
    // compose. The case above skips both, because it cannot tell a name
    // being passed on from a name carrying a key. `not-configured` is the
    // only default declared here, and the realm's reason for having one.
    const tracked = git("ls-files", "-z").split("\0").filter(Boolean);
    const defaulted = tracked.flatMap((path) => {
      let text: string;
      try {
        text = read(path);
      } catch {
        return [];
      }
      return (
        [...text.matchAll(/\$\{([A-Z_][A-Z0-9_]*):([^}]*)\}/g)]
          .filter(([, name = ""]) => secrets.includes(name))
          // `${NAME:key}` is the realm's default and `${NAME:-key}` compose's.
          // `${NAME:?message}` is compose refusing to start without a value,
          // and holds none itself.
          .filter(([, , after = ""]) => {
            const fallback = after.replace(/^-/, "");

            return !fallback.startsWith("?") && fallback !== "not-configured";
          })
          .map(([match = "", name = ""]) => `${path}: ${name} in ${match}`)
      );
    });

    expect(defaulted).toEqual([]);
  });

  it("are what the realm names where a launch source's credentials go", () => {
    // The one field in the one tracked file that has to carry the real key
    // for a sign-in to work, which is where somebody pastes it to see the
    // button work. Written over, the name is gone and every case above is
    // looking for something no file mentions any more.
    const reference = /^\$\{([A-Z_][A-Z0-9_]*):not-configured\}$/;
    const declared = ["google", "github"].flatMap((alias) =>
      Object.entries(declaredCredentials(alias)).map(
        ([field, value]) => [`${alias}.${field}`, value] as const,
      ),
    );

    expect(
      declared.filter(
        ([, value]) => !secrets.includes(reference.exec(value)?.[1] ?? ""),
      ),
    ).toEqual([]);
  });
});
