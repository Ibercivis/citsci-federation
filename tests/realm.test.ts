import { describe, expect, it } from "vitest";
import { declaredCredentials, declaredSource } from "./realm.ts";

/**
 * How the readers in `realm.ts` refuse an alias the realm declares nothing
 * under. The alias below is this file's own: a case about a refusal has
 * nothing to learn from the realm's aliases, and would go stale with them.
 */

const UNDECLARED = "no-identity-source-is-declared-under-this";

describe("an alias the realm declares no Identity Source under", () => {
  it("is refused in the same words by either reader", () => {
    const refusal = new Error(
      `The realm declares no Identity Source under ${UNDECLARED}: either ` +
        "that alias moved, or the source was never added to the realm.",
    );

    expect(() => declaredSource(UNDECLARED)).toThrow(refusal);
    expect(() => declaredCredentials(UNDECLARED)).toThrow(refusal);
  });
});
