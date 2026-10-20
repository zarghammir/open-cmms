import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { buildSeed } from "@/data/seed";
import { hydrated, useRole, withoutServiceWorker } from "../fixtures/shell";
import { pinTheDay, screenshotDir, settled } from "../fixtures/screenshots";

/**
 * The dialog in both languages, and the control a role that may not use it
 * still sees.
 *
 * The third picture is the one worth taking: the rule this project settled on
 * twice is that a control a role cannot use stays visible and says why, so a
 * viewer watching somebody switch roles can see that the product is
 * role-based. A picture of that is the evidence the rule is kept, and it is
 * the state no page-level screenshot ever catches.
 */

const OUT = screenshotDir("WA-88");

test.beforeEach(async ({ page }) => {
  await pinTheDay(page);
  await withoutServiceWorker(page);
});

const seed = buildSeed(new Date());

const OPEN_ORDER = (() => {
  const found = seed.workOrders.find((order) => order.status === "open");
  if (!found) throw new Error("The seed holds no open work order");
  return found;
})();

async function openOrder(page: Page, locale: string) {
  await page.goto(`/${locale}/work-orders/${OPEN_ORDER.number}`);
  await hydrated(page);
  await expect(page.locator('[data-slot="work-order-actions"]')).toBeVisible();
}

test.describe("screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  /*
   * The pair here is the two languages, and a pair that agrees is a red.
   *
   * These two pictures exist to show the dialog is bilingual. If they came back
   * byte-identical the screen would not be translated — or, just as likely, the
   * French run photographed the English screen because a locale did not take.
   * Either way the pictures would look like evidence of French and be evidence
   * of nothing.
   *
   * One test rather than two, deliberately. The obvious shape is a loop over
   * the locales with the hashes kept in a module-level map, and under this
   * project's `fullyParallel: true` that is a check that cannot fail: the two
   * tests may land in different workers, each with its own module instance, so
   * the second one finds an empty map and compares nothing. Taking both
   * pictures in one test is what makes the comparison reachable.
   */
  test("the assign dialog, both languages", async ({ context, page }) => {
    const hashes = new Map<string, string>();

    // Set once, outside the loop: the role does not change between the two
    // languages, and the lint rules read a `use` prefix in a loop as a React
    // hook called conditionally.
    await useRole(context, "maintenanceCoordinator");

    for (const locale of ["en", "fr"] as const) {
      const m = locale === "fr" ? fr : en;
      await openOrder(page, locale);

      await page
        .getByRole("button", { name: m.workOrderDetail.write.actions.assign })
        .click();
      await expect(
        page.getByText(m.workOrderDetail.write.assign.description),
      ).toBeVisible();
      await settled(page);

      const path = `${OUT}/${locale}-assign-dialog-1440.png`;
      await page.screenshot({ path, animations: "disabled" });
      hashes.set(
        locale,
        createHash("sha256").update(readFileSync(path)).digest("hex"),
      );
    }

    expect(
      [...hashes.keys()],
      "both languages must have been photographed before they are compared",
    ).toEqual(["en", "fr"]);

    expect(
      hashes.get("fr"),
      "en-assign-dialog-1440.png and fr-assign-dialog-1440.png are byte-identical: the dialog is not translated, or one run photographed the other language",
    ).not.toBe(hashes.get("en"));
  });

  test("the control an auditor cannot use", async ({ context, page }) => {
    await useRole(context, "auditor");
    await openOrder(page, "en");

    // Focused, because the explanation hangs off the focusable wrapper around
    // the disabled button — a picture of it at rest would show the control and
    // not the reason, which is the half worth photographing.
    await page.locator('[data-slot="capability-action"]').first().focus();
    await expect(
      page.getByText(
        en.permissions.actionDenied.replace("{role}", en.roles.auditor.name),
      ),
    ).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/auditor-cannot-assign-1440.png`,
      animations: "disabled",
    });
  });
});
