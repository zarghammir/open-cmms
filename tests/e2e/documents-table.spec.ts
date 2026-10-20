import { expect, test, type Page } from "@playwright/test";
import { expectTableFits, measureTableFit } from "../fixtures/table-fit";
import en from "../../messages/en.json";
import {
  VIEWPORTS,
  hydrated,
  useRole,
  withoutServiceWorker,
} from "../fixtures/shell";

// WA-15 registers a service worker that caches HTML; every spec but its own
// asserts against a fresh response.
test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

async function rowCount(page: Page) {
  return page.locator('[data-slot="data-table"] tbody tr').count();
}

/**
 * Opens the library and refuses to continue until it has drawn rows.
 *
 * The floor. Every assertion below is about the shape of a table full of
 * documents and every one of them is satisfied by a table with nothing in it —
 * a library that drew zero rows fits any width you care to name.
 */
async function openLibrary(page: Page, locale: "en" | "fr" = "en") {
  await page.goto(`/${locale}/documents`);
  await hydrated(page);
  await expect(page.getByRole("table")).toBeVisible();
  expect(
    await rowCount(page),
    "the library drew no rows, so nothing below is measuring anything",
  ).toBeGreaterThan(0);
}

/*
 * Seven columns, against the parts register's nine — which overflowed at 1024
 * and had to drop one. So the fit is measured here in the same commit that
 * draws the table rather than after somebody notices, and in both languages:
 * the parts register found French wider on its widest column and the assets
 * register found English wider on its, so neither language is the safe one to
 * check alone.
 */
for (const locale of ["en", "fr"] as const)
  for (const [label, viewport] of [
    ["1024", VIEWPORTS.tablet],
    ["1440", VIEWPORTS.desktop],
  ] as const) {
    test(`at ${label} in ${locale} the document library fits its container`, async ({
      context,
      page,
    }) => {
      await useRole(context, "maintenanceCoordinator");
      await page.setViewportSize(viewport);
      await openLibrary(page, locale);

      const fit = await measureTableFit(page);

      expectTableFits(fit, `at ${label} in ${locale}`);
    });
  }

test.describe("the document library", () => {
  test("draws a skeleton rather than an empty table before the records are read", async ({
    page,
  }) => {
    // Three states, never two. "No documents" and "not read back yet" are
    // different claims and only one of them is true at that moment.
    await page.goto("/en/documents");
    await hydrated(page);
    await expect(page.locator('[data-slot="data-table"]')).toBeVisible();
    await expect(page.locator('[data-slot="data-table-skeleton"]')).toHaveCount(
      0,
    );
  });

  test("names the document that belongs to the organisation rather than leaving a blank", async ({
    context,
    page,
  }) => {
    /*
     * The case this ticket exists to make reachable. A contract is filed
     * against no asset, no order, no plan and no site — and a library that
     * rendered an empty cell for it would tell a reader it is filed against
     * nothing, which is the opposite of what it means.
     */
    await useRole(context, "administrator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await openLibrary(page);

    await page
      .getByRole("searchbox", { name: en.documentsTable.searchLabel })
      .fill("agreement");

    await expect.poll(async () => rowCount(page)).toBeGreaterThan(0);
    await expect(
      page
        .locator('[data-slot="data-table"] tbody tr')
        .filter({ hasText: en.filedAgainst.organisation })
        .first(),
    ).toBeVisible();
  });

  test("filters by file type, which needs more than one type to mean anything", async ({
    context,
    page,
  }) => {
    // The seed holds PDF, Word and Excel. A filter offered over one value
    // demonstrates the filter's absence.
    await useRole(context, "administrator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await openLibrary(page);

    const before = await rowCount(page);
    await page
      .getByRole("searchbox", { name: en.documentsTable.searchLabel })
      .fill(".xlsx");

    await expect.poll(async () => rowCount(page)).toBeLessThan(before);
    expect(await rowCount(page)).toBeGreaterThan(0);
  });
});
