import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { buildSeed } from "@/data/seed";
import {
  hydrated,
  useRole,
  VIEWPORTS,
  watchConsole,
  withoutServiceWorker,
} from "../fixtures/shell";
import { pinTheDay, screenshotDir, settled } from "../fixtures/screenshots";

/**
 * The pictures for WA-39: the controls a person uses to change a work order.
 * Skipped unless WA_SCREENSHOTS=1.
 *
 * Every capture waits on `hydrated` rather than on the heading. The heading is
 * printed by the server from the URL segment, and the whole of this PR is
 * client-rendered — so a picture taken on the heading is a picture of the
 * loading state, which is the one thing a screenshot must never quietly be.
 */
const OUT = screenshotDir("WA-39");

const seed = buildSeed(new Date());

function orderWith(status: string) {
  const found = seed.workOrders.find((order) => order.status === status);
  if (!found) throw new Error(`The seed holds no ${status} work order`);
  return found;
}

async function open(page: Page, number: string, locale: string) {
  await page.goto(`/${locale}/work-orders/${number}`);
  await hydrated(page);
}

test.describe("WA-39 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  test.beforeEach(async ({ page }) => {
    await withoutServiceWorker(page);
    /*
     * The clock is fixed before anything loads, because the records are built
     * during the boot that follows. Without it every dated thing on these
     * screens moves daily and all twelve files regenerate for no reason a
     * reader can see in a diff.
     */
    await pinTheDay(page);
  });

  test("the controls, three widths, both languages", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    const watcher = watchConsole(page);
    const order = orderWith("inProgress");

    for (const locale of ["en", "fr"]) {
      for (const size of Object.values(VIEWPORTS)) {
        await page.setViewportSize(size);
        await open(page, order.number, locale);
        await settled(page);
        await page.screenshot({
          path: `${OUT}/${locale}-actions-${size.width}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
    }

    expect(watcher.errors).toEqual([]);
  });

  test("the two forms", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");

    for (const locale of ["en", "fr"]) {
      const messages = locale === "en" ? en : fr;
      await page.setViewportSize(VIEWPORTS.desktop);

      // Finishing a job: the time and the note, both required.
      await open(page, orderWith("inProgress").number, locale);
      await page
        .getByRole("button", {
          name: messages.workOrderDetail.write.actions.complete,
        })
        .click();
      await expect(
        page.getByText(messages.workOrderDetail.write.complete.description),
      ).toBeVisible();
      await settled(page);
      await page.screenshot({
        path: `${OUT}/${locale}-complete-dialog.png`,
        animations: "disabled",
      });
      await page.keyboard.press("Escape");

      // Calling one off: the reason list a person may actually pick from.
      await open(page, orderWith("open").number, locale);
      await page
        .getByRole("button", {
          name: messages.workOrderDetail.write.actions.cancel,
        })
        .click();
      await expect(
        page.getByText(messages.workOrderDetail.write.cancel.description),
      ).toBeVisible();
      await settled(page);
      await page.screenshot({
        path: `${OUT}/${locale}-cancel-dialog.png`,
        animations: "disabled",
      });
      await page.keyboard.press("Escape");
    }
  });

  /*
   * The two gates, one picture each: may this role, and can this order. A
   * technician finishes work but cannot call it off, and is told so rather than
   * shown a screen with a hole in it; an auditor reads the checklist as text,
   * because a disabled checkbox is a claim about the reader rather than about
   * the record.
   *
   * One test per role rather than a loop inside one test: `useRole` reads as a
   * React hook to the lint rules, and a hook in a loop is an error whatever the
   * function actually is.
   */
  for (const role of ["technician", "auditor"]) {
    test(`what a ${role} is shown`, async ({ context, page }) => {
      await page.setViewportSize(VIEWPORTS.desktop);
      await useRole(context, role);
      await open(page, orderWith("inProgress").number, "en");
      await settled(page);
      await page.screenshot({
        path: `${OUT}/en-role-${role}.png`,
        fullPage: true,
        animations: "disabled",
      });
    });
  }
});
