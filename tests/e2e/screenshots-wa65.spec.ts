import { expect, test } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import {
  useRole,
  VIEWPORTS,
  watchConsole,
  withoutServiceWorker,
} from "../fixtures/shell";
import { pinTheDay, screenshotDir, settled } from "../fixtures/screenshots";

/**
 * The pictures for WA-65. Skipped unless WA_SCREENSHOTS=1.
 *
 * The site facet gets its own capture because the existing one
 * (`WA-27/assets-facet-filter-1440.png`) shows the **Status** facet open, so it
 * is no evidence at all about the facet this ticket changes. The register
 * itself is already photographed under WA-10, WA-25 and WA-27; those move and
 * are committed, they are not re-taken here.
 */
const OUT = screenshotDir("WA-65");

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
  await pinTheDay(page);
});

test.describe("WA-65 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  for (const locale of ["en", "fr"] as const) {
    test(`the site facet, ${locale}`, async ({ context, page }) => {
      const watcher = watchConsole(page);
      const messages = locale === "fr" ? fr : en;
      await useRole(context, "maintenanceCoordinator");
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.goto(`/${locale}/assets`);
      await settled(page);

      // The facet trigger, exactly — the column header carries a sort button
      // whose accessible name is the same label plus "Sort by this column", so
      // a non-exact match resolves to both and Playwright refuses.
      await page
        .getByRole("button", {
          name: messages.assetsTable.columns.facility,
          exact: true,
        })
        .click();
      await expect(page.getByRole("menu")).toBeVisible();
      await settled(page);

      await page.screenshot({
        path: `${OUT}/${locale}-site-facet-1440.png`,
        animations: "disabled",
      });

      expect(watcher.errors).toEqual([]);
    });
  }
});
