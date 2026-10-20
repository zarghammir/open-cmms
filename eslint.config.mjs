import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      // No hardcoded user-facing strings: every label goes through the message
      // catalogs. This rule is the cheap half of that guarantee; the other half
      // is review.
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },
  {
    // The data boundary, in the editor rather than only in the test.
    // `tests/unit/data-boundary.test.ts` is what proves it; this is what tells
    // you before you commit.
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/stores", "@/stores/*", "**/stores/*"],
              message:
                "Screens do not reach the store. Go through a hook in @/hooks.",
            },
            {
              group: [
                "@/data/seed",
                "@/data/seed/*",
                "@/data/mock",
                "@/data/mock/*",
                "@/data/repositories",
                "@/data/repositories/*",
                "**/data/seed/*",
                "**/data/repositories/*",
              ],
              message:
                "Screens do not reach the records. Go through a hook in @/hooks, which asks a repository.",
            },
          ],
        },
      ],
      // `no-restricted-imports` only sees static imports: a dynamic
      // `import("@/stores/…")` walks straight past it, which is how a
      // lazy-loaded table would breach the boundary. This covers that form, so
      // the editor sees what `tests/unit/data-boundary.test.ts` sees.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportExpression > Literal[value=/(^|\\/)stores(\\/|$)|data\\/(seed|mock|repositories)(\\/|$)/]",
          message:
            "Screens do not reach the store or the records, dynamically either. Go through a hook in @/hooks.",
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    "blob-report/**",
    "coverage/**",
    "docs/screenshots/**",
  ]),
]);

export default eslintConfig;
