import { expect, test, type Page } from "@playwright/test";
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
 * The pictures for WA-19. Skipped unless WA_SCREENSHOTS=1.
 *
 * Seven, and each is a different claim rather than the same screen twice. Two
 * of them are at 1024 because that is where the fit decisions are visible: the
 * next-due date is absent from the visits table and the frequency from the
 * plans table, and a picture at 1440 alone would show two tables that fit and
 * prove nothing about the width where they did not.
 *
 * Every capture asserts what it is evidence for before taking it. An empty
 * table photographs perfectly, and so does a month with no weeks in it.
 */
const OUT = screenshotDir("WA-19");

/**
 * A column header by its label, exactly.
 *
 * Anchoring only at the start is not enough, and this cost a picture: the
 * header's accessible name is the label plus the sort button's sr-only text,
 * so an exact match on the label finds nothing — but `^Equipment` matches both
 * "Equipment" and "Equipment type", so it finds two and Playwright refuses.
 * Both ends anchored, with the sort text optional for the headers that are not
 * sortable.
 */
const header = (label: string, sortBy: string) =>
  new RegExp(
    `^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?: ${sortBy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})?$`,
  );

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
  await pinTheDay(page);
});

async function open(page: Page, locale: "en" | "fr", view?: string) {
  await page.goto(`/${locale}/preventive-maintenance`);
  await settled(page);
  if (view) {
    await page
      .locator('[data-slot="maintenance-views"]')
      .getByRole("radio", { name: view })
      .click();
    await settled(page);
  }
}

async function rowsDrawn(page: Page) {
  const rows = await page.locator('[data-slot="data-table"] tbody tr').count();
  expect(
    rows,
    "the table drew no rows, so the picture shows nothing",
  ).toBeGreaterThan(0);
}

test.describe("WA-19 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  for (const locale of ["en", "fr"] as const) {
    test(`the planned visits at 1440, ${locale}`, async ({ context, page }) => {
      const watcher = watchConsole(page);
      await useRole(context, "maintenanceCoordinator");
      await page.setViewportSize(VIEWPORTS.desktop);
      await open(page, locale);
      await rowsDrawn(page);

      await page.screenshot({
        path: `${OUT}/${locale}-planned-visits-1440.png`,
        animations: "disabled",
      });
      expect(watcher.errors).toEqual([]);
    });
  }

  test("the planned visits at 1024, where the date drops", async ({
    context,
    page,
  }) => {
    const watcher = watchConsole(page);
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.tablet);
    await open(page, "en");
    await rowsDrawn(page);

    /*
     * The claim this picture is evidence for, asserted so it cannot quietly
     * become evidence for the opposite: the next-due date is gone at this
     * width and the due reading — the part a planner acts on — is not.
     */
    await expect(
      page.getByRole("columnheader", {
        name: header(en.maintenanceTable.columns.nextDue, en.dataTable.sortBy),
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("columnheader", {
        name: header(en.maintenanceTable.columns.due, en.dataTable.sortBy),
      }),
    ).toBeVisible();

    await page.screenshot({
      path: `${OUT}/en-planned-visits-1024.png`,
      animations: "disabled",
    });
    expect(watcher.errors).toEqual([]);
  });

  test("the month, grouped by week", async ({ context, page }) => {
    const watcher = watchConsole(page);
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await open(page, "en", en.maintenanceViews.month);

    // The month is not a table, so the floor is its own: weeks and days, not
    // rows. A month with nothing in it photographs as a sentence.
    await expect(page.locator('[data-slot="month-label"]')).not.toBeEmpty();
    expect(
      await page.locator('[data-slot="month-day"]').count(),
      "no days drawn, so the month picture is empty",
    ).toBeGreaterThan(0);

    await page.screenshot({
      path: `${OUT}/en-month-1440.png`,
      animations: "disabled",
    });
    expect(watcher.errors).toEqual([]);
  });

  test("the plans register at 1440, French", async ({ context, page }) => {
    const watcher = watchConsole(page);
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await open(page, "fr", fr.maintenanceViews.plans);
    await rowsDrawn(page);

    await page.screenshot({
      path: `${OUT}/fr-plans-1440.png`,
      animations: "disabled",
    });
    expect(watcher.errors).toEqual([]);
  });

  test("the plans register at 1024, where the frequency drops", async ({
    context,
    page,
  }) => {
    const watcher = watchConsole(page);
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.tablet);
    await open(page, "en", en.maintenanceViews.plans);
    await rowsDrawn(page);

    await expect(
      page.getByRole("columnheader", {
        name: header(en.plansTable.columns.frequency, en.dataTable.sortBy),
      }),
    ).toHaveCount(0);
    // The equipment count stays: it is the column that shows a plan nothing is
    // on, which is the one thing this table can say that the visits cannot.
    await expect(
      page.getByRole("columnheader", {
        name: header(en.plansTable.columns.onPlan, en.dataTable.sortBy),
      }),
    ).toBeVisible();

    await page.screenshot({
      path: `${OUT}/en-plans-1024.png`,
      animations: "disabled",
    });
    expect(watcher.errors).toEqual([]);
  });

  test("the planned visits as cards at 390", async ({ context, page }) => {
    const watcher = watchConsole(page);
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.phone);
    await open(page, "en");

    await expect(page.locator('[data-slot="data-table-cards"]')).toBeVisible();
    expect(
      await page.locator('[data-slot="data-table-cards"] article').count(),
      "no cards drawn",
    ).toBeGreaterThan(0);

    await page.screenshot({
      path: `${OUT}/en-planned-visits-390.png`,
      animations: "disabled",
    });
    expect(watcher.errors).toEqual([]);
  });
});
