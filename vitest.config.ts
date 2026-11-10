import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Every case here drives a real authorization code flow against a real
    // Broker: slower than a unit test, and not safe to interleave, because
    // several of them sign the same Identity in and out.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
