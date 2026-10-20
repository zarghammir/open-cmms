import { expect, test } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import {
  hydrated,
  useRole,
  VIEWPORTS,
  withoutServiceWorker,
} from "../fixtures/shell";
import { pinTheDay, screenshotDir, settled } from "../fixtures/screenshots";

/**
 * The pictures for WA-18. Skipped unless WA_SCREENSHOTS=1.
 *
 * **Nothing here is staged.** Every other picture on this project needed an
 * instrument — a write held open, a read forced to fail — because it
 * photographed a state the application works to make rare. These four are the
 * ordinary demonstration: the bell has things in it because the records have
 * overdue work in them, and the email log has lines because the rules ran.
 * That is worth saying once, since a reader who has seen the other captions
 * will assume otherwise.
 *
 * The bell is photographed **open**, which is the state a menu is otherwise
 * never seen in — the same gap that hid WA-49's accessibility defect on main
 * for weeks.
 */
const OUT = screenshotDir("WA-18");

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

test.describe("WA-18 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  test("the bell, open, with what is waiting grouped under it", async ({
    context,
    page,
  }) => {
    await pinTheDay(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    await useRole(context, "maintenanceCoordinator");
    await page.goto("/en/dashboard");
    await hydrated(page);
    await settled(page);

    await page
      .getByRole("button", { name: new RegExp(en.shell.notifications.label) })
      .click();

    // The picture is of the list, so the list has to be in it: a shot taken
    // while the popover is still arriving is a picture of a button.
    await expect(
      page.locator('[data-slot="notification-groups"]'),
    ).toBeVisible();
    await page.waitForFunction(() =>
      document
        .getAnimations()
        .every((animation) => animation.playState !== "running"),
    );
    await page.screenshot({ path: `${OUT}/en-bell-open-1440.png` });
  });

  test("the same bell in French, on the phone a technician carries", async ({
    context,
    page,
  }) => {
    await pinTheDay(page);
    await page.setViewportSize(VIEWPORTS.phone);
    expect(page.viewportSize()).toEqual(VIEWPORTS.phone);
    await useRole(context, "technician");
    await page.goto("/fr/my-work");
    await hydrated(page);
    await settled(page);

    /*
     * The field shell, and the reason this picture is in French and on a
     * phone rather than being a translation of the first one: this bell did
     * not exist until the browser tests went looking for it. A technician is
     * who "a job has landed on you" is written for, and this is the only
     * shell they see.
     */
    await page
      .getByRole("button", { name: new RegExp(fr.shell.notifications.label) })
      .click();
    await expect(
      page.locator('[data-slot="notification-groups"]'),
    ).toBeVisible();
    await page.waitForFunction(() =>
      document
        .getAnimations()
        .every((animation) => animation.playState !== "running"),
    );
    await page.screenshot({ path: `${OUT}/fr-bell-open-390.png` });
  });

  test("the email log, in the recipient's language rather than the reader's", async ({
    context,
    page,
  }) => {
    await pinTheDay(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    await useRole(context, "administrator");
    await page.goto("/en/settings");
    await hydrated(page);

    // Wait for the log to have something in it. The rules write it as they
    // run, so an early shot is a picture of an empty table with a true caption
    // and no information.
    await expect
      .poll(() => page.locator('[data-slot="email-log-row"]').count(), {
        timeout: 15_000,
      })
      .toBeGreaterThan(0);
    await settled(page);
    await page.screenshot({ path: `${OUT}/en-email-log-1440.png` });
  });

  test("the toggles an auditor may read and not change", async ({
    context,
    page,
  }) => {
    await pinTheDay(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    await useRole(context, "auditor");
    await page.goto("/en/my-notifications");
    await hydrated(page);
    await settled(page);

    /*
     * The auditor rather than a role that can change them, because the
     * disabled state with its reason beside it is the thing worth
     * photographing: a screen that is simply shorter for one role
     * demonstrates nothing, and an evaluator watching somebody switch roles
     * has to be able to see that the product is role-based.
     */
    await expect(
      page.locator('[data-slot="notifications-read-only"]'),
    ).toBeVisible();
    await page.screenshot({ path: `${OUT}/en-toggles-auditor-1440.png` });
  });
});
