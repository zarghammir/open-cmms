import path from "node:path";
import { expect, test } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { VIEWPORTS, hydrated, useRole } from "../fixtures/shell";
import { pinTheDay, screenshotDir, settled } from "../fixtures/screenshots";

/**
 * The pictures for WA-35, and the click-through that produces them.
 * Skipped unless WA_SCREENSHOTS=1.
 */
test.beforeEach(async ({ page }) => {
  await pinTheDay(page);
});

const OUT = screenshotDir("WA-35");
// `process.cwd()`, not `import.meta.dirname`: Playwright transpiles specs to
// CommonJS, where `import.meta` does not exist. The runner starts at the
// project root, so this resolves the same on every machine and in CI.
const FIXTURE = path.resolve(
  process.cwd(),
  "tests/fixtures/mp2-export-sample.xlsx",
);

const CATALOGUES = { en, fr } as const;

test.describe("WA-35 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  for (const locale of ["en", "fr"] as const) {
    test(`the wizard at three widths, ${locale}`, async ({ context, page }) => {
      const t = CATALOGUES[locale].import;
      await useRole(context, "administrator");

      for (const [name, size] of Object.entries(VIEWPORTS)) {
        await page.setViewportSize(size);
        await page.goto(`/${locale}/settings/import`);
        await hydrated(page);
        await settled(page);
        await page.screenshot({
          path: `${OUT}/${locale}-upload-${name}.png`,
          fullPage: true,
        });
      }

      // Then the three screens that only exist once a file has been read.
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.goto(`/${locale}/settings/import`);
      await hydrated(page);
      await page.locator('input[type="file"]').setInputFiles(FIXTURE);
      await expect(
        page.getByRole("heading", { name: t.map.title }),
      ).toBeVisible();
      await settled(page);
      await page.screenshot({
        path: `${OUT}/${locale}-map-1440.png`,
        fullPage: true,
      });

      await page.locator("#equipment-criticality").selectOption("CRITICALITY");
      await page.locator("#inventory-reorderPoint").selectOption("MIN_QTY");
      await page.getByRole("button", { name: t.next }).click();
      await expect(
        page.getByRole("heading", { name: t.report.title }),
      ).toBeVisible();
      await settled(page);
      await page.screenshot({
        path: `${OUT}/${locale}-report-1440.png`,
        fullPage: true,
      });

      await page.getByRole("button", { name: t.next }).click();
      await expect(
        page.getByRole("heading", { name: t.preview.title }),
      ).toBeVisible();
      await settled(page);
      await page.screenshot({
        path: `${OUT}/${locale}-preview-1440.png`,
        fullPage: true,
      });

      // The report at phone width: the one a technician would never use, and
      // the one most likely to be unreadable if nobody looked.
      await page.setViewportSize(VIEWPORTS.phone);
      await settled(page);
      await page.screenshot({
        path: `${OUT}/${locale}-preview-390.png`,
        fullPage: true,
      });
    });
  }
});
