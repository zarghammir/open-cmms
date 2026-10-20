import { expect, test } from "@playwright/test";
import {
  VIEWPORTS,
  watchConsole,
  withoutServiceWorker,
} from "../fixtures/shell";

// WA-15 registers a service worker that caches HTML. Every spec but its own
// asserts against a fresh response, so the worker is removed first: a cached
// page would let a test quietly pass against a build no longer on disk.
test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

/**
 * Reports, at the two widths where it had never been opened.
 *
 * **The screen was 164 px too wide in English and 318 in French, on main,
 * while 378 browser tests passed.** Not one of them visited `/reports` at 390:
 * the overflow assertions live in the shell, record-screens and
 * work-order-detail specs, and Reports is in none of those lists. The suite was
 * not wrong about anything — it was silent, which reads identically from the
 * outside and is the failure this file exists to close.
 *
 * So this measures the excess as a **number** rather than asking a yes-or-no
 * question. `hasHorizontalOverflow` answers the question the other sweeps ask
 * and it is the right helper there; here the number is worth having, because
 * the deletion control's red should be comparable to the figure the ticket was
 * raised with. Reverting the fix should print something near 164 at 390 in
 * English. If it prints 12, the fix is not the thing that mattered and this
 * file has told somebody so.
 *
 * 1440 is deliberately not in the list. The defect needs a viewport narrower
 * than the control, the shell specs already cover the desktop width, and a
 * third case here would be a test that cannot fail bought at the price of ten
 * more seconds.
 */

/** Room to spare, in pixels. Negative means the page scrolls sideways. */
async function horizontalMargin(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.clientWidth - doc.scrollWidth;
  });
}

const WIDTHS = [
  ["phone", VIEWPORTS.phone],
  ["tablet", VIEWPORTS.tablet],
] as const;

for (const locale of ["en", "fr"] as const) {
  for (const [label, size] of WIDTHS) {
    const path = `/${locale}/reports`;

    test(`${path} does not scroll sideways at ${label} (${size.width})`, async ({
      page,
    }) => {
      const watcher = watchConsole(page);
      await page.setViewportSize(size);
      await page.goto(path);

      /*
       * The floor, beside the edge rather than instead of it. "Nothing
       * overflows" is satisfied perfectly by a screen that drew nothing at
       * all — a skeleton, a permission panel, an error boundary — and the
       * control being measured is exactly the thing that would be missing.
       * So the four report names have to be on the page before the width
       * means anything.
       *
       * Located by `data-slot` rather than by role. The group is a Radix
       * `ToggleGroup` and its ARIA role is the library's business, not this
       * file's; `data-slot` is set by our own component and can be read in its
       * source. A locator written from a recollection of what a library emits
       * is the kind that passes review and then matches nothing.
       *
       * **Scoped to `main`, because the first cold run found six items rather
       * than four.** The header's language switcher is a `ToggleGroup` too, so
       * an unscoped `[data-slot="toggle-group"]` matches two groups on this
       * page and counts their items together. The count below is the floor for
       * the width assertion, so a locator quietly spanning two controls would
       * have made the floor pass for the wrong reason — and the width
       * measurement after it is of the whole document, which would still have
       * been right. A floor that passes by accident protects nothing.
       */
      const main = page.getByRole("main");
      const selector = main.locator('[data-slot="toggle-group"]');

      // The assumption that broke, now asserted rather than assumed: exactly
      // one group of report names inside the screen's own region.
      await expect(selector, "one toggle group in main").toHaveCount(1);
      await expect(selector).toBeVisible();
      await expect(
        selector.locator('[data-slot="toggle-group-item"]'),
        "the four report names are drawn",
      ).toHaveCount(4);

      const margin = await horizontalMargin(page);

      expect(
        margin,
        `${path} at ${size.width} is ${-margin}px too wide`,
      ).toBeGreaterThanOrEqual(-1);

      expect(watcher.errors, `${path} logged to the console`).toEqual([]);
    });
  }
}
