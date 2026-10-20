import { expect, test } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { VIEWPORTS, useRole, withServiceWorker } from "../fixtures/shell";
import { pinTheDay, screenshotDir, settled } from "../fixtures/screenshots";

/** The pictures for WA-47. Skipped unless WA_SCREENSHOTS=1. */
// Every picture is dated, so a run on a different day regenerates every file
// for no reason anybody can read in a diff. The clock is fixed before anything
// loads, because the records are built during the boot that follows.
test.beforeEach(async ({ page }) => {
  await pinTheDay(page);
});

const OUT = screenshotDir("WA-47");

/**
 * The refusal as a person meets it: at 390, with the network actually off, on
 * an address this device has actually never opened. A picture of the handler's
 * return value would prove the string exists; this proves it reaches a screen.
 */
test.describe("WA-47 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  test("the refusal at 390, in both languages", async ({ context, page }) => {
    await useRole(context, "technician");
    await page.setViewportSize(VIEWPORTS.phone);

    await withServiceWorker(page, "/en/my-work");
    await context.setOffline(true);
    await page.goto("/en/documents");
    await expect(
      page.getByRole("heading", { level: 1, name: en.offlineRefusal.title }),
    ).toBeVisible();
    await settled(page, { store: false });
    await page.screenshot({
      path: `${OUT}/offline-refusal-390.png`,
      animations: "disabled",
    });

    await context.setOffline(false);
    await withServiceWorker(page, "/fr/my-work");
    await context.setOffline(true);
    await page.goto("/fr/documents");
    await expect(
      page.getByRole("heading", { level: 1, name: fr.offlineRefusal.title }),
    ).toBeVisible();
    await settled(page, { store: false });
    await page.screenshot({
      path: `${OUT}/fr-offline-refusal-390.png`,
      animations: "disabled",
    });
  });
});
