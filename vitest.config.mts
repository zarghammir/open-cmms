import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Most units here are pure logic. Component tests opt into jsdom with a
    // `@vitest-environment jsdom` docblock.
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "tests/unit/**/*.test.ts",
      // `.tsx` here too, for a cross-cutting check that has to render one of
      // the consumers it is comparing. A test of a single component belongs
      // beside it under `src`; this pattern is for the ones that belong to no
      // single file and still need a screen — without it such a test is picked
      // up by nothing and passes by never running.
      "tests/unit/**/*.test.tsx",
    ],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
