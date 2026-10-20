import { expect, test, type Page } from "@playwright/test";
import { buildSeed } from "@/data/seed";
import { isTerminal } from "@/domain/constants/work-order-status";
import { fullName } from "@/domain/types/user";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import {
  VIEWPORTS,
  hasHorizontalOverflow,
  hydrated,
  useRole,
  watchConsole,
  withoutServiceWorker,
} from "../fixtures/shell";

/**
 * Neither assignee list offers a person who cannot do the work.
 *
 * The unit suite reads both selects over the real store; this reads them in a
 * browser, in both languages, because the half of this change a unit test
 * cannot see is the sentence under the control — whether it is there at all,
 * and whether it is readable at the width a person holds in one hand.
 */

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

const seed = buildSeed(new Date());
const AUDITOR = seed.users.find((user) => user.role === "auditor")!;
const INSPECTOR = seed.users.find((user) => user.role === "inspector")!;
const TECHNICIAN = seed.users.find((user) => user.role === "technician")!;

/** An order still open, and held by no person — the dialog omits the holder. */
const ORDER = seed.workOrders.find((order) => {
  if (isTerminal(order.status)) return false;
  const assignment = seed.workOrderAssignments.find(
    (candidate) => candidate.workOrderId === order.id,
  );
  return !assignment?.userId;
})!;

async function optionsOf(page: Page, selector: string): Promise<string[]> {
  return page
    .locator(`${selector} option`)
    .allTextContents()
    .then((all) => all.map((one) => one.trim()).filter(Boolean));
}

for (const locale of ["en", "fr"] as const) {
  test(`the create form offers nobody who cannot do the work, in ${locale}`, async ({
    context,
    page,
  }) => {
    const strings = locale === "en" ? en : fr;
    await useRole(context, "maintenanceCoordinator");
    const watcher = watchConsole(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(`/${locale}/work-orders`);
    await hydrated(page);

    // The select's own options, which the store fills in — not the shell.
    await expect(page.locator("#wo-assignee")).toBeVisible();
    await expect
      .poll(async () => (await optionsOf(page, "#wo-assignee")).length)
      .toBeGreaterThan(2);

    const names = await optionsOf(page, "#wo-assignee");
    expect(names).toContain(fullName(TECHNICIAN));
    // The inspector IS offered: `assign-order.spec.ts` hands an order to one.
    expect(names).toContain(fullName(INSPECTOR));
    expect(names, "the auditor is offered work").not.toContain(
      fullName(AUDITOR),
    );

    // The absence is explained where the person is looking, in their language.
    const hint = page.locator("#wo-assignee-hint");
    await expect(hint).toBeVisible();
    await expect(hint).toContainText(strings.roles.auditor.name);
    await expect(hint).not.toContainText(strings.roles.inspector.name);

    expect(watcher.errors).toEqual([]);
  });

  test(`the assign dialog offers the same people, in ${locale}`, async ({
    context,
    page,
  }) => {
    const strings = locale === "en" ? en : fr;
    await useRole(context, "maintenanceCoordinator");
    const watcher = watchConsole(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(`/${locale}/work-orders/${ORDER.number}`);
    await hydrated(page);

    // Wait for something the store drew before clicking: the actions bar is
    // rendered from the order the browser read back, not from the server's
    // markup.
    const assign = page.getByRole("button", {
      name: strings.workOrderDetail.write.actions.assign,
    });
    await expect(assign).toBeVisible();
    await assign.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const names = await optionsOf(page, "#wo-assign-assignee");
    expect(names).toContain(fullName(TECHNICIAN));
    expect(names).toContain(fullName(INSPECTOR));
    expect(names, "the auditor is offered work").not.toContain(
      fullName(AUDITOR),
    );

    const hint = page.locator("#wo-assign-assignee-hint");
    await expect(hint).toBeVisible();
    await expect(hint).toContainText(strings.roles.auditor.name);

    expect(watcher.errors).toEqual([]);
  });
}

test("the hint is readable on a phone, where it wraps", async ({
  context,
  page,
}) => {
  /*
   * The sentence is the longest thing under either control and 390 is where it
   * wraps. Read rather than asserted to exist: a hint that is present and
   * clipped, or that pushes the page sideways, is a hint nobody reads.
   */
  await useRole(context, "maintenanceCoordinator");
  await page.setViewportSize(VIEWPORTS.phone);
  await page.goto("/en/work-orders");
  await hydrated(page);

  const hint = page.locator("#wo-assignee-hint");
  await expect(hint).toBeVisible();
  await expect(hint).toContainText(en.roles.auditor.name);

  const box = (await hint.boundingBox())!;
  // It wraps rather than running off: more than one line high, and inside the
  // viewport.
  expect(box.height).toBeGreaterThan(20);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(await hasHorizontalOverflow(page)).toBe(false);
});
