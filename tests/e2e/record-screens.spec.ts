import { expect, test } from "@playwright/test";
import { buildSeed } from "@/data/seed";
import {
  VIEWPORTS,
  hasHorizontalOverflow,
  watchConsole,
  withoutServiceWorker,
} from "../fixtures/shell";

// WA-15 registers a service worker that caches HTML. Every spec but its
// own asserts against a fresh response, so the worker is removed first:
// a cached page would let a test quietly pass against a build that is no
// longer on disk.
test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

/**
 * The two screens WA-27 adds, at every width and in both languages.
 *
 * This is the click-through written down. Opening each page by hand and
 * watching the console is the right way to verify; doing it once is not the
 * same as it staying true, and the sideways-overflow bug this suite now
 * guards against was found by looking at a screenshot, not by a green test.
 */
const PATHS = [
  "/en/assets",
  "/fr/assets",
  "/en/work-orders",
  "/fr/work-orders",
];

for (const path of PATHS) {
  for (const [name, size] of Object.entries(VIEWPORTS)) {
    test(`${path} is clean at ${name} (${size.width})`, async ({ page }) => {
      const watcher = watchConsole(page);
      await page.setViewportSize(size);
      await page.goto(path);

      await expect(page.getByRole("main")).toBeVisible();
      // Wait for the records rather than measuring a skeleton.
      await expect(
        page
          .locator('[data-slot="data-table"], [data-slot="data-table-cards"]')
          .first(),
      ).toBeVisible();

      expect(
        await hasHorizontalOverflow(page),
        `${path} scrolls sideways`,
      ).toBe(false);
      expect(watcher.errors, `${path} logged to the console`).toEqual([]);
    });
  }
}

/**
 * The work-order detail page, same click-through.
 *
 * Its own block because the wait above is for a table and this page has none —
 * the heading is what says the records arrived. Everything else is the point of
 * the suite unchanged: three widths, both languages, nothing sideways, nothing
 * in the console.
 */
const DETAIL_NUMBER = buildSeed(new Date()).workOrders[0]!.number;

for (const locale of ["en", "fr"]) {
  for (const [name, size] of Object.entries(VIEWPORTS)) {
    const path = `/${locale}/work-orders/${DETAIL_NUMBER}`;
    test(`${path} is clean at ${name} (${size.width})`, async ({ page }) => {
      const watcher = watchConsole(page);
      await page.setViewportSize(size);
      await page.goto(path);

      await expect(
        page.getByRole("heading", { name: DETAIL_NUMBER, exact: true }),
      ).toBeVisible();

      expect(
        await hasHorizontalOverflow(page),
        `${path} scrolls sideways`,
      ).toBe(false);
      expect(watcher.errors, `${path} logged to the console`).toEqual([]);
    });
  }
}
