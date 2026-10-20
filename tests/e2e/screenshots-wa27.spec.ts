import { expect, test } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import {
  VIEWPORTS,
  hydrated,
  useRole,
  withoutServiceWorker,
} from "../fixtures/shell";
import { pinTheDay, screenshotDir, settled } from "../fixtures/screenshots";

// WA-15 registers a service worker that caches HTML. Every spec but its
// own asserts against a fresh response, so the worker is removed first:
// a cached page would let a test quietly pass against a build that is no
// longer on disk.
test.beforeEach(async ({ page }) => {
  await pinTheDay(page);
  await withoutServiceWorker(page);
});

/** The pictures for WA-27. Skipped unless WA_SCREENSHOTS=1. */
const OUT = screenshotDir("WA-27");

test.describe("WA-27 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  test("the assets table at three widths", async ({ page }) => {
    for (const size of Object.values(VIEWPORTS)) {
      await page.setViewportSize(size);
      await page.goto("/en/assets");
      await expect(page.getByRole("main")).toBeVisible();
      await page.waitForTimeout(300);
      await settled(page);
      await page.screenshot({
        path: `${OUT}/assets-${size.width}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  });

  test("filtering and column visibility", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/en/assets");
    await hydrated(page);
    const toolbar = page.locator('[data-slot="data-table-toolbar"]');
    await toolbar
      .getByRole("button", { name: en.assetsTable.columns.status })
      .click();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/assets-facet-filter-1440.png`,
      animations: "disabled",
    });
    await page.keyboard.press("Escape");

    await toolbar.getByRole("button", { name: en.dataTable.columns }).click();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/assets-columns-1440.png`,
      animations: "disabled",
    });
  });

  test("the work-order form, empty and refusing", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/en/work-orders");
    await settled(page);
    await page.screenshot({
      path: `${OUT}/work-order-form-1440.png`,
      fullPage: true,
      animations: "disabled",
    });

    await page.getByRole("button", { name: en.workOrderForm.submit }).click();
    await page.waitForTimeout(200);
    await settled(page);
    await page.screenshot({
      path: `${OUT}/work-order-form-invalid-1440.png`,
      fullPage: true,
      animations: "disabled",
    });
  });

  test("French", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/fr/assets");
    await expect(page.getByRole("main")).toBeVisible();
    await page.waitForTimeout(300);
    await settled(page);
    await page.screenshot({
      path: `${OUT}/fr-assets-1440.png`,
      fullPage: true,
      animations: "disabled",
    });

    await page.goto("/fr/work-orders");
    await expect(page.getByText(fr.workOrderForm.title)).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/fr-work-order-form-1440.png`,
      fullPage: true,
      animations: "disabled",
    });
  });

  test("the phone view", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto("/en/assets");
    await expect(page.locator('[data-slot="data-table-cards"]')).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/assets-cards-390.png`,
      fullPage: true,
      animations: "disabled",
    });
  });
});
