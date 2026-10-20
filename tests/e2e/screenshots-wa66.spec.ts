import { test } from "@playwright/test";
import { expect } from "@playwright/test";
import {
  failTheNextRead,
  useRole,
  VIEWPORTS,
  withoutServiceWorker,
} from "../fixtures/shell";
import { pinTheDay, screenshotDir, settled } from "../fixtures/screenshots";

/**
 * The pictures for WA-66. Skipped unless WA_SCREENSHOTS=1.
 *
 * **All three are staged, and the pull request says so under each one.** The
 * read is *forced* to fail, because a browser that will not give the records
 * back is not a state anybody can wait for — and the picture is true about the
 * state while saying nothing about how often a person would meet it.
 *
 * Three rather than two, and the third is the point of the ticket. The desk
 * pair shows the refusal where a coordinator meets it; the phone shot shows the
 * scan screen, which is where the old behaviour was worst: WA-68 took the
 * camera away correctly and the page heading above it went on inviting a scan,
 * so the screen refused and invited in the same breath. A picture of the desk
 * alone would not show that, and neither would an English-only run show a
 * French screen still inviting one.
 */
const OUT = screenshotDir("WA-66");

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

test.describe("WA-66 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  for (const locale of ["en", "fr"] as const) {
    test(`the refusal, where a coordinator meets it (${locale})`, async ({
      context,
      page,
    }) => {
      await pinTheDay(page);
      await page.setViewportSize(VIEWPORTS.desktop);
      await useRole(context, "maintenanceCoordinator");
      await failTheNextRead(page);
      await page.goto(`/${locale}/dashboard`);

      /*
       * The forced failure has to have reached the store before anything is
       * photographed. Without this the picture could be of a page that never
       * booted, which looks similar enough in a still image to be worse than
       * no picture at all.
       */
      await expect(
        page.locator('[data-demo-status="unreadable"]'),
        "the forced failure never reached the store: this would photograph the wrong screen",
      ).toBeAttached({ timeout: 15_000 });

      /*
       * `store: false`, and it is not a shortcut.
       *
       * `settled()` waits for `[data-demo-status="ready"]`, which is the one
       * thing this screen will never be — waiting for it here waits fifteen
       * seconds for something that by design never arrives. What is still
       * wanted is the rest of it: no skeleton anywhere, and the fonts loaded.
       * The skeleton half is doubly apt here, since the defect this ticket
       * fixes *was* a skeleton with no end.
       */
      await settled(page, { store: false });
      await page.screenshot({ path: `${OUT}/${locale}-refusal-1440.png` });
    });
  }

  test("the scan screen, on the phone it is used on", async ({
    context,
    page,
  }) => {
    await pinTheDay(page);
    await page.setViewportSize(VIEWPORTS.phone);
    // Asserted rather than assumed: a shot that silently ran at the project
    // default would be a desk picture filed under the phone's name.
    expect(page.viewportSize()).toEqual(VIEWPORTS.phone);
    await useRole(context, "technician");
    await failTheNextRead(page);
    await page.goto("/en/my-work/scan");

    await expect(
      page.locator('[data-demo-status="unreadable"]'),
      "the forced failure never reached the store: this would photograph the wrong screen",
    ).toBeAttached({ timeout: 15_000 });

    await settled(page, { store: false });
    await page.screenshot({ path: `${OUT}/en-scan-refusal-390.png` });
  });
});
