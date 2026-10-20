import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { buildSeed } from "@/data/seed";
import { assetHistory } from "@/data/selectors/asset-history";
import { VIEWPORTS, hydrated, useRole, watchConsole } from "../fixtures/shell";
import { pinTheDay, screenshotDir, settled } from "../fixtures/screenshots";

/**
 * The pictures for WA-10, and the click-through that produces them.
 *
 * Each drives the screen the way a person would and asserts what it is about to
 * photograph, so a screenshot cannot quietly become a picture of the wrong
 * thing. Skipped unless WA_SCREENSHOTS=1, so continuous integration never
 * writes into the repository.
 */
// Every picture is dated, so a run on a different day regenerates every file
// for no reason anybody can read in a diff. The clock is fixed before anything
// loads, because the records are built during the boot that follows.
test.beforeEach(async ({ page }) => {
  await pinTheDay(page);
});

const OUT = screenshotDir("WA-10");

const seed = buildSeed(new Date());

/*
 * The asset with the most varied history, not simply the busiest. A timeline
 * that merges four kinds of record is worth photographing with more than one
 * kind in it — the first asset with two work orders had exactly two work orders
 * and nothing else, which is a picture of a list rather than of the feature.
 */
const busiest = [...seed.assets].sort((a, b) => {
  const variety = (id: string) => {
    const entries = assetHistory(seed, id);
    return (
      new Set(entries.map((entry) => entry.kind)).size * 100 + entries.length
    );
  };
  return variety(b.id) - variety(a.id);
})[0]!;

async function open(page: Page, tab: string, locale = "en") {
  const suffix = tab === "overview" ? "" : `?tab=${tab}`;
  await page.goto(`/${locale}/assets/${busiest.assetTag}${suffix}`);
  await expect(page.getByTestId("asset-place")).toBeVisible();
}

test.describe("WA-10 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  test("the asset, at three widths", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");
    const watcher = watchConsole(page);

    for (const size of Object.values(VIEWPORTS)) {
      await page.setViewportSize(size);
      await open(page, "overview");
      await settled(page);
      await page.screenshot({
        path: `${OUT}/asset-overview-${size.width}.png`,
        fullPage: size.width === 1440,
        animations: "disabled",
      });
    }

    expect(watcher.errors).toEqual([]);
  });

  test("every other section", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");
    const watcher = watchConsole(page);
    await page.setViewportSize(VIEWPORTS.desktop);

    for (const tab of [
      "history",
      "workOrders",
      "maintenance",
      "inspections",
      "documents",
      "parts",
      "label",
    ]) {
      await open(page, tab);
      // Scoped to the sections nav: the module rail carries a "Work orders"
      // link too, which is exactly why this nav has an accessible name.
      await expect(
        page
          .getByRole("navigation", { name: en.assetDetail.sections })
          .getByRole("link", { name: en.assetDetail.tabs[tab as "history"] }),
      ).toHaveAttribute("aria-current", "page");
      await settled(page);
      await page.screenshot({
        path: `${OUT}/asset-${tab}-1440.png`,
        fullPage: true,
        animations: "disabled",
      });
    }

    expect(watcher.errors).toEqual([]);
  });

  test("the same asset in French", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");
    const watcher = watchConsole(page);

    await page.setViewportSize(VIEWPORTS.desktop);
    await open(page, "history", "fr");
    await expect(
      page.getByRole("link", { name: fr.assetDetail.tabs.history }),
    ).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/fr-asset-history-1440.png`,
      fullPage: true,
      animations: "disabled",
    });

    await page.setViewportSize(VIEWPORTS.phone);
    await open(page, "overview", "fr");
    await settled(page);
    await page.screenshot({
      path: `${OUT}/fr-asset-overview-390.png`,
      animations: "disabled",
    });

    expect(watcher.errors).toEqual([]);
  });

  test("editing what the system records", async ({ context, page }) => {
    await useRole(context, "administrator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await open(page, "overview");

    await page
      .getByRole("button", { name: en.assetDetail.edit.action })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/asset-edit-1440.png`,
      animations: "disabled",
    });
  });

  test("a tag this system does not hold", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/en/assets/AHU-KGN-99");
    await hydrated(page);
    await expect(page.getByText(en.records.missingTitle)).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/asset-missing-1440.png`,
      animations: "disabled",
    });
  });

  test("the keyboard reaches a section, and the focus shows", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await open(page, "overview");

    const history = page.getByRole("link", {
      name: en.assetDetail.tabs.history,
    });
    await history.focus();
    await expect(history).toBeFocused();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/keyboard-focus-section-1440.png`,
      animations: "disabled",
    });
  });

  test("the way in, from the table", async ({ context, page }) => {
    // The path QA step 1 walks, at both widths and in both languages, because
    // the phone shows cards rather than a table and the two carry the link
    // separately.
    await useRole(context, "maintenanceCoordinator");
    const watcher = watchConsole(page);

    for (const locale of ["en", "fr"]) {
      for (const size of [VIEWPORTS.desktop, VIEWPORTS.phone]) {
        await page.setViewportSize(size);
        await page.goto(`/${locale}/assets`);
        await hydrated(page);
        const tag = page.locator(`a[href^='/${locale}/assets/']`).first();
        await expect(tag).toBeVisible();
        await settled(page);
        await page.screenshot({
          path: `${OUT}/${locale}-assets-table-${size.width}.png`,
          animations: "disabled",
        });

        await tag.click();
        await expect(page.getByTestId("asset-place")).toBeVisible();
        await settled(page);
        await page.screenshot({
          path: `${OUT}/${locale}-opened-from-table-${size.width}.png`,
          animations: "disabled",
        });
      }
    }

    expect(watcher.errors).toEqual([]);
  });
});
