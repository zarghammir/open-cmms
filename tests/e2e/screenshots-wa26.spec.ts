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

/**
 * The pictures for WA-26: the records reaching the interface, and the reset
 * that rebuilds them. Skipped unless WA_SCREENSHOTS=1, so continuous
 * integration never writes into the repository.
 */
const OUT = screenshotDir("WA-26");

test.describe("WA-26 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  test("the notifications count, from the records", async ({
    context,
    page,
  }) => {
    await useRole(context, "facilityManager");
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/en/dashboard");
    await hydrated(page);

    const bell = page.getByRole("button", {
      name: new RegExp(en.shell.notifications.label),
    });
    await expect(bell.locator("span[aria-hidden='true']")).toBeVisible();
    await bell.click();
    // The popover by its slot, not by its heading: "Notifications" is also the
    // button's label and its accessible name, and a locator that matches three
    // elements is a worse instrument than no locator at all.
    const panel = page.locator('[data-slot="popover-content"]');
    await expect(panel).toBeVisible();
    await expect(panel.getByText(/unread notification/)).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/notifications-count-1440.png`,
      animations: "disabled",
    });
  });

  test("an inbox that is genuinely empty", async ({ context, page }) => {
    await useRole(context, "auditor");
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/en/dashboard");
    await hydrated(page);
    await page
      .getByRole("button", { name: new RegExp(en.shell.notifications.label) })
      .click();
    await expect(
      page.getByText(en.shell.notifications.emptyTitle),
    ).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/notifications-empty-auditor-1440.png`,
      animations: "disabled",
    });
  });

  test("the reset, before and after", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/en/settings");
    await hydrated(page);
    await expect(page.getByText(en.demo.title)).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/settings-demo-controls-1440.png`,
      fullPage: true,
      animations: "disabled",
    });

    await page.getByRole("button", { name: en.demo.reset }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: en.demo.confirmTitle }),
    ).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/reset-confirm-1440.png`,
      animations: "disabled",
    });

    await dialog.getByRole("button", { name: en.demo.confirmAction }).click();
    await expect(page).toHaveURL(/\/en\/dashboard$/);
    await expect(
      page.getByRole("heading", { level: 1, name: en.modules.dashboard.title }),
    ).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/reset-done-1440.png`,
      animations: "disabled",
    });
  });

  test("French", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/fr/dashboard");
    await hydrated(page);
    await page
      .getByRole("button", { name: new RegExp(fr.shell.notifications.label) })
      .click();
    const panel = page.locator('[data-slot="popover-content"]');
    await expect(panel).toBeVisible();
    await expect(panel.getByText(/notifications? non lues?/)).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/fr-notifications-count-1440.png`,
      animations: "disabled",
    });

    await useRole(context, "administrator");
    await page.goto("/fr/settings");
    await expect(page.getByText(fr.demo.title)).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/fr-settings-demo-controls-1440.png`,
      fullPage: true,
      animations: "disabled",
    });
  });

  test("the header holds its shape on a tablet and a phone", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");

    for (const size of [VIEWPORTS.tablet, VIEWPORTS.phone]) {
      await page.setViewportSize(size);
      await page.goto("/en/dashboard");
      await expect(
        page.getByRole("button", {
          name: new RegExp(en.shell.notifications.label),
        }),
      ).toBeVisible();
      await settled(page);
      await page.screenshot({
        path: `${OUT}/desk-dashboard-${size.width}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  });
});
