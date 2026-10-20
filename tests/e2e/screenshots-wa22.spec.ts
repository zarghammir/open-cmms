import { expect, test, type Page } from "@playwright/test";
import { buildSeed } from "@/data/seed";
import en from "../../messages/en.json";
import {
  PINNED_DAY,
  pinTheDay,
  screenshotDir,
  settled,
} from "../fixtures/screenshots";
import { VIEWPORTS, hydrated, useRole } from "../fixtures/shell";

/**
 * The pictures for WA-22. Skipped unless WA_SCREENSHOTS=1.
 *
 * Four, named in the pull request before they were taken, so the set is a claim
 * that can be checked rather than whatever the run happened to produce.
 *
 * Every shot disables animations, which fast-forwards CSS transitions to their
 * end state. WA-21 learned that the expensive way: a toast asserted in the DOM
 * and absent from the picture, because the shutter caught it mid-slide.
 */

const OUT = screenshotDir("WA-22");

/** The first site by code, which is the row the tree draws at the top. */
const FIRST_SITE = [...buildSeed(PINNED_DAY).facilities].sort((a, b) =>
  a.code.localeCompare(b.code),
)[0]!;

async function facilities(page: Page) {
  await pinTheDay(page);
  await page.goto("/en/facilities");
  await hydrated(page);
  await expect(
    page.getByText(FIRST_SITE.code, { exact: false }).first(),
  ).toBeVisible();

  // Opened two levels, because a closed tree is a picture of five words.
  await page.locator("details:not([open]) > summary").first().click();
  await page.locator("details:not([open]) > summary").first().click();
  await settled(page);
}

test.describe("WA-22 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  test("the tree at desk width", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await facilities(page);
    await page.screenshot({
      animations: "disabled",
      path: `${OUT}/en-facilities-1440.png`,
    });
  });

  test("the tree at tablet width", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.tablet);
    await facilities(page);
    await page.screenshot({
      animations: "disabled",
      path: `${OUT}/en-facilities-1024.png`,
    });
  });

  test("a report narrowed to one site", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await pinTheDay(page);
    await page.goto("/en/reports?report=completion");
    await hydrated(page);
    await expect(page.getByRole("table")).toBeVisible();

    await page.getByRole("button", { name: en.dashboard.filter.label }).click();
    await page.getByRole("menuitemradio").nth(1).click();
    await expect.poll(async () => page.locator("tbody tr").count()).toBe(1);
    await settled(page);

    /*
     * Focus moved out of the picture on purpose.
     *
     * Choosing a site returns focus to the filter trigger, and whether the
     * browser then paints a `:focus-visible` ring after a synthetic click is
     * not deterministic: three runs gave two different images, 45,921 pixels
     * apart in a band across the toolbar. The ring is incidental to what this
     * shot is of — a report narrowed to one site — so it is removed rather than
     * left to decide the bytes. Measured, not guessed: the band was located by
     * diffing the runs before touching anything.
     */
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());

    /*
     * And the pointer out of the frame.
     *
     * After the menu closes the cursor is left wherever the item was, tinting
     * whatever row is beneath it. That is what the remaining instability was:
     * a 38-pixel band whose largest channel delta was 4 of 255 — a hover
     * background, invisible to a reader and decisive for the bytes. Found by
     * diffing runs pixel by pixel rather than by staring at two pictures that
     * look identical.
     */
    await page.mouse.move(0, 0);

    await page.screenshot({
      animations: "disabled",
      path: `${OUT}/en-reports-filtered-1440.png`,
    });
  });

  test("the export, and what the reader is told", async ({ context, page }) => {
    /*
     * **This stands in for the picture the dispatch asked for.** The fourth
     * shot was to be the export's line in the audit trail, and that line does
     * not exist yet: the store drops an act that changes no record, which is
     * WA-92. Photographing a trail entry that is not written would be the one
     * dishonest picture in the set, so this shows what a reader actually gets
     * — the file downloaded and the confirmation — and the body says the audit
     * shot follows WA-92.
     */
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await pinTheDay(page);
    await page.goto("/en/reports?report=inventory");
    await hydrated(page);
    await expect(page.getByRole("table")).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: en.reports.export }).click();
    await download;

    await expect(page.locator("[data-sonner-toast]")).toBeVisible();
    await page.screenshot({
      animations: "disabled",
      path: `${OUT}/en-reports-export-1440.png`,
    });
  });
});
