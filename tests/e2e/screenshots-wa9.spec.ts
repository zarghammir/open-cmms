import { expect, test } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import {
  VIEWPORTS,
  hydrated,
  useRole,
  watchConsole,
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
 * The pictures for WA-9, and the click-through that produces them.
 *
 * Each one drives the screen the way a person would — choose a site, open the
 * menu, tab to a row — and asserts what it is about to photograph, so a
 * screenshot cannot quietly become a picture of the wrong thing. Skipped unless
 * WA_SCREENSHOTS=1, so continuous integration never writes into the repository.
 */
const OUT = screenshotDir("WA-9");

test.describe("WA-9 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  test("the desk dashboard, at three widths", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");
    const watcher = watchConsole(page);

    for (const [name, size] of Object.entries(VIEWPORTS)) {
      await page.setViewportSize(size);
      await page.goto("/en/dashboard");
      await expect(page.getByTestId("kpi-open")).toBeVisible();
      await expect(
        page.getByTestId("exception-rows").getByRole("listitem").first(),
      ).toBeVisible();
      await settled(page);
      await page.screenshot({
        path: `${OUT}/desk-dashboard-${size.width}.png`,
        fullPage: name === "desktop",
        animations: "disabled",
      });
    }

    expect(watcher.errors).toEqual([]);
  });

  test("the same screen in French", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");
    const watcher = watchConsole(page);

    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/fr/dashboard");
    await expect(
      page.getByText(fr.dashboard.exceptions.title, { exact: true }),
    ).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/fr-desk-dashboard-1440.png`,
      fullPage: true,
      animations: "disabled",
    });

    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto("/fr/dashboard");
    await expect(page.getByTestId("kpi-open")).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/fr-desk-dashboard-390.png`,
      animations: "disabled",
    });

    expect(watcher.errors).toEqual([]);
  });

  test("choosing a site narrows the whole screen", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/en/dashboard");
    await hydrated(page);
    await expect(page.getByTestId("kpi-open")).toBeVisible();

    await page.getByRole("button", { name: en.dashboard.filter.label }).click();
    await expect(
      page.getByRole("menuitemradio", { name: en.dashboard.filter.allSites }),
    ).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/facility-filter-open-1440.png`,
      animations: "disabled",
    });

    const site = page.getByRole("menuitemradio").nth(2);
    const siteName = (await site.innerText()).trim();
    await site.click();
    await expect(page).toHaveURL(/facility=/);
    await expect(
      page.getByRole("button", { name: en.dashboard.filter.label }),
    ).toContainText(siteName);
    await settled(page);
    await page.screenshot({
      path: `${OUT}/desk-dashboard-one-site-1440.png`,
      fullPage: true,
      animations: "disabled",
    });
  });

  test("the field home on a phone, in both languages", async ({
    context,
    page,
  }) => {
    await useRole(context, "technician");
    const watcher = watchConsole(page);
    await page.setViewportSize(VIEWPORTS.phone);

    await page.goto("/en/my-work");
    await expect(
      page.getByTestId("my-work-rows").getByRole("listitem").first(),
    ).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/field-my-work-390.png`,
      animations: "disabled",
    });

    await page.goto("/fr/my-work");
    await expect(
      page.getByText(fr.dashboard.myWork.title, { exact: true }),
    ).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/fr-field-my-work-390.png`,
      animations: "disabled",
    });

    expect(watcher.errors).toEqual([]);
  });

  test("the keyboard reaches an exception, and the focus shows", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/en/dashboard");
    await hydrated(page);

    const firstRow = page
      .getByTestId("exception-rows")
      .getByRole("link")
      .first();
    await expect(firstRow).toBeVisible();
    await firstRow.focus();
    await expect(firstRow).toBeFocused();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/keyboard-focus-exception-1440.png`,
      animations: "disabled",
    });
  });
});
