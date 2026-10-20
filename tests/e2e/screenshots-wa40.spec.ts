import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { buildSeed } from "@/data/seed";
import {
  useRole,
  VIEWPORTS,
  watchConsole,
  withoutServiceWorker,
} from "../fixtures/shell";
import { pinTheDay, screenshotDir, settled } from "../fixtures/screenshots";

/**
 * The pictures for WA-40: one order at a time, on a phone.
 * Skipped unless WA_SCREENSHOTS=1.
 */
const OUT = screenshotDir("WA-40");

const seed = buildSeed(new Date());

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
  await pinTheDay(page);
});

function liveOrder() {
  const found = seed.workOrders.find((order) => order.status === "inProgress");
  if (!found) throw new Error("The seed holds no order in progress");
  return found;
}

async function openOnPhone(page: Page, locale: string) {
  await page.setViewportSize(VIEWPORTS.phone);
  await page.goto(`/${locale}/work-orders/${liveOrder().number}`);
  await settled(page);
}

test.describe("WA-40 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  for (const locale of ["en", "fr"] as const) {
    test(`the field view at 390, ${locale}`, async ({ context, page }) => {
      const watcher = watchConsole(page);
      await useRole(context, "technician");
      await openOnPhone(page, locale);

      await page.screenshot({
        path: `${OUT}/${locale}-field-order-390.png`,
        fullPage: true,
        animations: "disabled",
      });

      expect(watcher.errors).toEqual([]);
    });

    test(`issuing a part at 390, ${locale}`, async ({ context, page }) => {
      const messages = locale === "fr" ? fr : en;
      await useRole(context, "technician");
      await openOnPhone(page, locale);

      await page
        .getByRole("button", {
          name: messages.workOrderDetail.write.issuePart.action,
        })
        .click();
      await expect(
        page.getByText(messages.workOrderDetail.write.issuePart.description),
      ).toBeVisible();
      await settled(page);

      await page.screenshot({
        path: `${OUT}/${locale}-issue-part-390.png`,
        animations: "disabled",
      });
    });
  }

  test("the same order as a coordinator, for the contrast", async ({
    context,
    page,
  }) => {
    // The desk arrangement at the same width: the record first, the checklist
    // after. Kept beside the field picture because the difference is the point
    // of the change and a reviewer should not have to hold two runs in mind.
    await useRole(context, "maintenanceCoordinator");
    await openOnPhone(page, "en");

    await page.screenshot({
      path: `${OUT}/en-desk-order-390.png`,
      fullPage: true,
      animations: "disabled",
    });
  });
});
