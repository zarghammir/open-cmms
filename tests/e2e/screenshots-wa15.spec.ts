import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import { VIEWPORTS, useRole } from "../fixtures/shell";
import { pinTheDay, screenshotDir, settled } from "../fixtures/screenshots";

/** The pictures for WA-15. Skipped unless WA_SCREENSHOTS=1. */
// Every picture is dated, so a run on a different day regenerates every file
// for no reason anybody can read in a diff. The clock is fixed before anything
// loads, because the records are built during the boot that follows.
test.beforeEach(async ({ page }) => {
  await pinTheDay(page);
});

const OUT = screenshotDir("WA-15");

async function underWorker(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("main")).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.catch(() => null));
  await page.reload();
  await expect(page.getByRole("main")).toBeVisible();
}

test.describe("WA-15 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  test("offline, queued, and reconnecting", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await underWorker(page, "/en/work-orders");

    await context.setOffline(true);
    await page.reload();
    await page.waitForTimeout(400);
    await settled(page);
    await page.screenshot({
      path: `${OUT}/offline-banner-1440.png`,
      fullPage: true,
      animations: "disabled",
    });

    await page
      .getByLabel(en.workOrderForm.fields.asset)
      .selectOption({ index: 1 });
    await page.getByLabel(en.workOrderForm.fields.title).fill("Queued offline");
    await page
      .getByLabel(en.workOrderForm.fields.description)
      .fill("Raised with no connection.");
    await page.getByRole("button", { name: en.workOrderForm.submit }).click();
    await page.waitForTimeout(300);
    await settled(page);
    await page.screenshot({
      path: `${OUT}/queued-1440.png`,
      fullPage: true,
      animations: "disabled",
    });

    await context.setOffline(false);
    await expect(page.locator('[data-slot="conflict-dialog"]')).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/conflict-1440.png`,
      animations: "disabled",
    });

    await page
      .getByRole("button", { name: en.offline.conflictKeepMine })
      .click();
    await useRole(context, "administrator");
    await page.goto("/en/settings");
    await expect(page.locator('[data-slot="sync-log"]')).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/sync-log-1440.png`,
      fullPage: true,
      animations: "disabled",
    });
  });

  test("on a phone, offline", async ({ context, page }) => {
    await useRole(context, "technician");
    await page.setViewportSize(VIEWPORTS.phone);
    await underWorker(page, "/en/my-work");

    await context.setOffline(true);
    await page.reload();
    await page.waitForTimeout(400);
    await settled(page);
    await page.screenshot({
      path: `${OUT}/offline-390.png`,
      fullPage: true,
      animations: "disabled",
    });
    await context.setOffline(false);
  });

  test("French", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await underWorker(page, "/fr/work-orders");

    await context.setOffline(true);
    await page.reload();
    await page.waitForTimeout(400);
    await settled(page);
    await page.screenshot({
      path: `${OUT}/fr-offline-1440.png`,
      fullPage: true,
      animations: "disabled",
    });
    await context.setOffline(false);
  });
});
