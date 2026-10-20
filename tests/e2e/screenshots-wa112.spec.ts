import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import { pinTheDay, screenshotDir, settled } from "../fixtures/screenshots";
import { VIEWPORTS, hydrated, useRole } from "../fixtures/shell";
import { buildSeed } from "@/data/seed";

/**
 * The pictures for WA-112. Skipped unless WA_SCREENSHOTS=1.
 *
 * Three, named here before they were taken: the rules an administrator reads,
 * the notification defaults beside them, and the one state a reader cannot
 * infer from either — a control disabled by a rule, with its reason showing.
 * A disabled button photographs as nothing happening unless the explanation is
 * in the frame.
 */

const OUT = screenshotDir("WA-112");

const LIVE_NUMBER = buildSeed(new Date()).workOrders.find(
  (order) => order.status === "inProgress",
)!.number;

async function settings(page: Page) {
  await pinTheDay(page);
  await page.goto("/en/settings");
  await hydrated(page);
  await expect(page.locator('[data-slot="workflow-rules"]')).toBeVisible();
  await expect(
    page.locator('[data-slot="notification-defaults"]'),
  ).toBeVisible();
  await settled(page);
}

test.describe("WA-112 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  test("the rules an administrator may change", async ({ context, page }) => {
    await useRole(context, "administrator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await settings(page);
    await page.locator('[data-slot="workflow-rules"]').screenshot({
      animations: "disabled",
      path: `${OUT}/en-workflow-rules-1440.png`,
    });
  });

  test("the notification defaults", async ({ context, page }) => {
    await useRole(context, "administrator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await settings(page);
    await page.locator('[data-slot="notification-defaults"]').screenshot({
      animations: "disabled",
      path: `${OUT}/en-notification-defaults-1440.png`,
    });
  });

  test("a control a rule turned off, saying why", async ({ context, page }) => {
    await useRole(context, "administrator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await settings(page);

    await page
      .locator(
        '[data-slot="workflow-move"][data-from="inProgress"][data-to="completed"]',
      )
      .locator("input")
      .uncheck();
    // The trail is the signal that the change is on the device; leaving the
    // page before it lands would photograph a rule that was never stored.
    await expect
      .poll(() =>
        page.evaluate(
          () => document.querySelectorAll('[data-slot="workflow-move"]').length,
        ),
      )
      .toBeGreaterThan(0);

    await useRole(context, "technician");
    await page.goto(`/en/work-orders/${LIVE_NUMBER}`);
    await hydrated(page);
    await expect(
      page.getByRole("heading", { name: LIVE_NUMBER, exact: true }),
    ).toBeVisible();

    const blocked = page.locator('[data-slot="rule-blocked-action"]');
    await expect(blocked).toBeVisible();
    await blocked.focus();
    await expect(
      page.getByText(en.workOrderStatus.refusedByRule),
    ).toBeVisible();
    await settled(page);

    await page.screenshot({
      animations: "disabled",
      path: `${OUT}/en-rule-blocked-complete.png`,
    });
  });
});
