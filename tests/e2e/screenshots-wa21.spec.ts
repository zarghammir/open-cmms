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
 * The pictures for WA-21: the library, and attachments on a work order.
 * Skipped unless WA_SCREENSHOTS=1.
 *
 * Named before they were taken, in the pull request, so the set is a claim that
 * can be checked rather than whatever the run happened to produce.
 *
 * Every shot passes `animations: "disabled"`, which fast-forwards CSS
 * transitions to their end state. Without it the refusal picture came back
 * showing **no refusal**: the toast was in the DOM and asserted, and the
 * shutter caught it mid-slide with nothing on screen. It is also the cheapest
 * thing available against WA-63's instability, where an unfinished transition
 * is one of the named causes of a picture that differs run to run.
 */

const OUT = screenshotDir("WA-21");

/** The order the seed files paperwork against, read from the seed itself. */
const PAPERED_ORDER = (() => {
  const seed = buildSeed(PINNED_DAY);
  const withPaper = seed.documents.find((one) => one.workOrderId !== null)!;
  return seed.workOrders.find((one) => one.id === withPaper.workOrderId)!
    .number;
})();

async function library(
  page: Page,
  locale: "en" | "fr",
  { asCards = false }: { asCards?: boolean } = {},
) {
  await pinTheDay(page);
  await page.goto(`/${locale}/documents`);
  await hydrated(page);
  /*
   * At 390 the table is not a table: the rows are cards, by design and by the
   * repository's own rule. Waiting for a `<table>` there waits for something
   * that correctly does not exist — which is what this helper did at first,
   * and the phone picture was the only one that failed.
   */
  await expect(
    asCards
      ? page.locator('[data-slot="data-table-cards"] article').first()
      : page.getByRole("table"),
  ).toBeVisible();
  await settled(page);
}

async function attachments(page: Page, locale: "en" | "fr") {
  await pinTheDay(page);
  await page.goto(`/${locale}/work-orders/${PAPERED_ORDER}`);
  await hydrated(page);
  await settled(page);
}

test.describe("WA-21 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  for (const locale of ["en", "fr"] as const) {
    test(`the library at 1440, ${locale}`, async ({ context, page }) => {
      await useRole(context, "maintenanceCoordinator");
      await page.setViewportSize(VIEWPORTS.desktop);
      await library(page, locale);
      await page.screenshot({
        animations: "disabled",
        path: `${OUT}/${locale}-library-1440.png`,
      });
    });

    test(`attachments on a work order, ${locale}`, async ({
      context,
      page,
    }) => {
      await useRole(context, "maintenanceCoordinator");
      await page.setViewportSize(VIEWPORTS.desktop);
      await attachments(page, locale);
      await page.screenshot({
        animations: "disabled",
        path: `${OUT}/${locale}-work-order-attachments-1440.png`,
        fullPage: true,
      });
    });
  }

  test("the library at 1024, where the format column drops", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.tablet);
    await library(page, "en");
    await page.screenshot({
      animations: "disabled",
      path: `${OUT}/en-library-1024.png`,
    });
  });

  test("the library as cards at 390", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.phone);
    await library(page, "en", { asCards: true });
    await page.screenshot({
      animations: "disabled",
      path: `${OUT}/en-library-390.png`,
    });
  });

  test("the organisation's own document, named rather than blank", async ({
    context,
    page,
  }) => {
    await useRole(context, "administrator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await library(page, "en");
    await page
      .getByRole("searchbox", { name: en.documentsTable.searchLabel })
      .fill("agreement");
    await expect(
      page
        .locator('[data-slot="data-table"] tbody tr')
        .filter({ hasText: en.filedAgainst.organisation })
        .first(),
    ).toBeVisible();
    await settled(page);
    await page.screenshot({
      animations: "disabled",
      path: `${OUT}/en-library-organisation-1440.png`,
    });
  });

  test("a file type the system does not take", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await attachments(page, "en");

    await page.locator('input[type="file"]').setInputFiles({
      name: "site-photo.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("not a document"),
    });

    /*
     * Asserted on the **toast**, not on the file name anywhere on the page.
     *
     * `getByText("site-photo.jpg")` passes without the refusal ever appearing:
     * Chromium renders the chosen file name inside the `<input type="file">`
     * itself, the input is `sr-only` rather than removed, and a 1px clipped
     * element counts as visible. The first version of this test was green and
     * the picture it took showed no refusal at all — which is what looking at
     * the picture is for.
     */
    const refusal = page.locator("[data-sonner-toast]");
    await expect(refusal).toContainText("site-photo.jpg");
    await page.screenshot({
      animations: "disabled",
      path: `${OUT}/en-upload-refused-1440.png`,
    });
  });

  test("the attach control an auditor may not use", async ({
    context,
    page,
  }) => {
    await useRole(context, "auditor");
    await page.setViewportSize(VIEWPORTS.desktop);
    await attachments(page, "en");
    await page.screenshot({
      animations: "disabled",
      path: `${OUT}/en-work-order-attachments-auditor-1440.png`,
      fullPage: true,
    });
  });
});
