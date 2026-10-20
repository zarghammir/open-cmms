import { defineConfig, devices } from "@playwright/test";

import { E2E_PORT } from "./scripts/e2e-port.mjs";

// One definition of the port, shared with `scripts/free-e2e-port.mjs`, which
// clears it before a run so the suite cannot reuse a stale server.
const PORT = E2E_PORT;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * The browser suite runs against a production build, because that is what a
 * reviewer opens. Chromium covers the two required browsers: Chrome and Edge
 * share the engine.
 */
export default defineConfig({
  testDir: "tests",
  // `tests/unit` belongs to Vitest — the Vitest config has always included it.
  // Playwright would otherwise try to load those files as browser specs and
  // fail on `import.meta`. Nothing lived there until now, which is why the
  // clash appeared with the first repository-wide unit test.
  testIgnore: ["unit/**"],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  /*
   * The floor reporter goes last so its two numbers are the final line, which
   * is where somebody reads a total. It fails a run that did not execute what
   * it collected — WA-120, after a run silently dropped 89 tests and exited 0.
   */
  reporter: process.env.CI
    ? [
        ["list"],
        ["html", { open: "never" }],
        ["./tests/fixtures/suite-floor-reporter.ts"],
      ]
    : [["list"], ["./tests/fixtures/suite-floor-reporter.ts"]],
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    /*
     * A trace on the second attempt, which is every attempt the ordinary suite
     * makes and none that the gated steps make.
     *
     * Continuous integration sets `retries: 1` above, so a failure in the main
     * suite is retried and the retry is traced. The two gated steps —
     * `test:screenshots` and `test:write-instruments` — pass `--retries=0` on
     * purpose, because a screenshot that passes on the second try is a
     * screenshot nobody can trust. With no retry there is no first retry, so
     * this setting keeps **nothing** for them: yesterday's red on
     * `screenshots.spec.ts:68` left a PNG and an ARIA snapshot and no trace,
     * and eleven local samples could not reproduce it.
     *
     * Those two scripts therefore override this with
     * `--trace=retain-on-failure`, which keeps a trace when a test fails and
     * discards it when one passes. It costs nothing on a green run, which is
     * every run until the next red — and the next red is the one this exists
     * for.
     */
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "en-CA",
    timezoneId: "America/Toronto",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    // Continuous integration builds in its own step, so it only needs the
    // server here. Locally, build first so a stale `.next` cannot pass.
    command: process.env.CI
      ? `npm run start -- --port ${PORT}`
      : `npm run build && npm run start -- --port ${PORT}`,
    url: `${BASE_URL}/en/dashboard`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
