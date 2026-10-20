import { expect, test } from "@playwright/test";
import { buildSeed } from "@/data/seed";
import {
  useRole,
  VIEWPORTS,
  watchConsole,
  withoutServiceWorker,
} from "../fixtures/shell";
import { pinTheDay, screenshotDir, settled } from "../fixtures/screenshots";

/**
 * The pictures for WA-12. Skipped unless WA_SCREENSHOTS=1.
 *
 * Six, and each is a different claim rather than the same screen twice.
 *
 * The register at **1024** is the one that would not obviously be here. It is
 * the visual half of the fit decision: the category column is absent at that
 * width by priority, and the four measured lines say why. A picture at 1440
 * alone would show a table that fits and prove nothing about the width where it
 * did not.
 */
const OUT = screenshotDir("WA-12");

const seed = buildSeed(new Date());
/** A part the seed has moved, so the ledger is drawn rather than empty. */
const MOVED = seed.parts.find((part) =>
  seed.inventoryTransactions.some((one) => one.partId === part.id),
)!;

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
  await pinTheDay(page);
});

test.describe("WA-12 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  for (const locale of ["en", "fr"] as const) {
    test(`the parts register at 1440, ${locale}`, async ({ context, page }) => {
      const watcher = watchConsole(page);
      await useRole(context, "maintenanceCoordinator");
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.goto(`/${locale}/inventory`);
      await settled(page);

      // A floor under the picture: an empty register photographs perfectly.
      await expect(page.getByRole("table")).toBeVisible();
      expect(
        await page.locator('[data-slot="data-table"] tbody tr').count(),
        "the register drew no rows, so the picture shows nothing",
      ).toBeGreaterThan(0);

      await page.screenshot({
        path: `${OUT}/${locale}-parts-register-1440.png`,
        animations: "disabled",
      });
      expect(watcher.errors).toEqual([]);
    });

    test(`one part and its ledger, ${locale}`, async ({ context, page }) => {
      const watcher = watchConsole(page);
      await useRole(context, "maintenanceCoordinator");
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.goto(`/${locale}/inventory/${MOVED.partNumber}`);
      await settled(page);

      // The ledger is the point of this picture, so its absence must fail
      // rather than photograph.
      const rows = page.locator('[data-slot="part-ledger"] li');
      await expect(rows.first()).toBeVisible();
      expect(
        await rows.count(),
        "no movements drawn, so the ledger picture is empty",
      ).toBeGreaterThan(1);

      await page.screenshot({
        path: `${OUT}/${locale}-part-ledger-1440.png`,
        animations: "disabled",
      });
      expect(watcher.errors).toEqual([]);
    });
  }

  test("the register at 1024, where the category drops", async ({
    context,
    page,
  }) => {
    const watcher = watchConsole(page);
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.tablet);
    await page.goto("/en/inventory");
    await settled(page);

    await expect(page.getByRole("table")).toBeVisible();
    /*
     * The claim the picture is evidence for, asserted so the picture cannot
     * quietly become evidence for the opposite. Category is priority 3 and must
     * be absent here; the stock number is priority 1 and must not be.
     */
    await expect(
      page.getByRole("columnheader", { name: "Category" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("columnheader", { name: "Stock number" }),
    ).toBeVisible();

    await page.screenshot({
      path: `${OUT}/en-parts-register-1024.png`,
      animations: "disabled",
    });
    expect(watcher.errors).toEqual([]);
  });

  test("the register as cards at 390", async ({ context, page }) => {
    const watcher = watchConsole(page);
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto("/en/inventory");
    await settled(page);

    await expect(page.locator('[data-slot="data-table-cards"]')).toBeVisible();
    expect(
      await page.locator('[data-slot="data-table-cards"] article').count(),
      "no cards drawn",
    ).toBeGreaterThan(0);

    await page.screenshot({
      path: `${OUT}/en-parts-register-390.png`,
      animations: "disabled",
    });
    expect(watcher.errors).toEqual([]);
  });
});
