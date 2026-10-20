import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { buildSeed } from "@/data/seed";
import { toIsoDate } from "@/data/seed/dates";
import {
  VIEWPORTS,
  hasHorizontalOverflow,
  hydrated,
  useRole,
  watchConsole,
} from "../fixtures/shell";

/**
 * The work-order detail page, in a real browser.
 *
 * What is proved here is that a person can get to one order from each of the
 * places that name one, and that the page answers honestly when the number is
 * not ours. The numbers themselves come from the same generator the browser
 * seeds itself with rather than being typed in.
 */

const now = new Date();
const today = toIsoDate(now);
const seed = buildSeed(now);

/** The heading the page carries: the number, which is what a server can know. */
function heading(page: Page, number: string) {
  return page.getByRole("heading", { name: number, exact: true });
}

test.describe("one work order", () => {
  test("opens by its number, in both languages", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");
    const watcher = watchConsole(page);
    const order = seed.workOrders[0]!;

    for (const locale of ["en", "fr"] as const) {
      await page.goto(`/${locale}/work-orders/${order.number}`);
      await expect(heading(page, order.number)).toBeVisible();

      // The panels a reader came for, named in their own language.
      const messages = locale === "fr" ? fr : en;
      await expect(
        page.getByText(messages.workOrderDetail.history.title),
      ).toBeVisible();
      await expect(
        page.getByText(messages.workOrderDetail.tasks.title),
      ).toBeVisible();
    }

    expect(watcher.errors).toEqual([]);
  });

  test("reads a number typed in the wrong case", async ({ context, page }) => {
    // An address gets retyped off a phone screen. The repository trims and
    // upper-cases, and this is the proof a reader never sees that rule.
    await useRole(context, "maintenanceCoordinator");
    const order = seed.workOrders[1]!;

    await page.goto(`/en/work-orders/${order.number.toLowerCase()}`);
    await expect(heading(page, order.number)).toBeVisible();
  });

  test("a number this system does not hold says so, and names it back", async ({
    context,
    page,
  }) => {
    /*
     * Three states, and this is the middle one. An order that resolves to
     * nothing is not an empty order: somebody followed a link, and the first
     * thing they do is check they read the number right — so it is on screen.
     */
    await useRole(context, "maintenanceCoordinator");
    await page.goto("/en/work-orders/WO-1999-9999");
    await hydrated(page);

    await expect(page.getByText(en.records.missingTitle)).toBeVisible();
    // In the panel, not merely somewhere on the page: the heading is the
    // address and carries the number whatever the answer turns out to be, so
    // an unscoped match would pass on a page that never said anything.
    await expect(
      page
        .locator('[data-slot="empty-description"]')
        .filter({ hasText: "WO-1999-9999" }),
    ).toBeVisible();

    // And a way back, rather than a dead end.
    await page
      .getByRole("link", { name: en.workOrderDetail.backToQueue })
      .click();
    await expect(page).toHaveURL(/\/en\/work-orders$/);
  });

  test("the queue opens an order", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.goto("/en/work-orders");
    await hydrated(page);

    // Whatever the screen is showing, not a number named in advance: which
    // order lands on page one has nothing to do with what this test is about.
    const first = page
      .getByRole("table")
      .getByRole("link", { name: /WO-\d{4}-\d{4}/ })
      .first();
    const number = (await first.innerText()).trim();
    await first.click();

    await expect(heading(page, number)).toBeVisible();
  });

  test("the asset page opens an order", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");

    /*
     * An asset that actually has work orders, chosen from the generator.
     *
     * The first version read the first row of the assets table, which is the
     * right habit — read what the screen shows — applied to the wrong thing.
     * Only 29 of the 60 assets have any work orders and the first row has
     * none, so the test spent its timeout waiting for a link that was never
     * coming. Which asset is not what this test is about; that it opens the
     * order is. The number is still read off the screen below.
     */
    const withOrders = seed.assets.find((asset) =>
      seed.workOrders.some((order) => order.assetId === asset.id),
    )!;
    expect(withOrders).toBeDefined();

    await page.goto(`/en/assets/${withOrders.assetTag}?tab=workOrders`);
    await hydrated(page);

    const link = page
      .getByTestId("asset-work-orders")
      .getByRole("link")
      .first();
    const number = (await link.innerText()).trim().split(/\s+/)[0]!;
    await link.click();

    await expect(heading(page, number)).toBeVisible();
  });

  test("the dashboard opens an order", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.goto("/en/dashboard");
    await hydrated(page);

    const link = page.getByRole("link", { name: /WO-\d{4}-\d{4}/ }).first();
    const number = (await link.innerText()).trim().match(/WO-\d{4}-\d{4}/)![0];
    await link.click();

    await expect(heading(page, number)).toBeVisible();
  });

  test("the address these links used to carry still arrives", async ({
    context,
    page,
  }) => {
    /*
     * `?order=<number>` is in pasted messages and screenshots taken before this
     * ticket. Nothing on the queue ever read it, so it used to open a list of
     * forty orders and say nothing about the one it named. It now goes where
     * the link always meant to go.
     */
    await useRole(context, "maintenanceCoordinator");
    const order = seed.workOrders[2]!;

    await page.goto(`/en/work-orders?order=${order.number}`);
    await expect(page).toHaveURL(
      new RegExp(`/en/work-orders/${order.number}$`),
    );
    await expect(heading(page, order.number)).toBeVisible();
  });

  test("an old address naming no order lands on the answer, not on the queue", async ({
    context,
    page,
  }) => {
    // The redirect does not check first, deliberately: the detail page already
    // says "we do not hold this number" and holding it here would be a second
    // copy of that panel, free to drift from the first.
    await useRole(context, "maintenanceCoordinator");
    await page.goto("/en/work-orders?order=WO-1999-9999");

    await expect(page.getByText(en.records.missingTitle)).toBeVisible();
  });

  test("tells a person, a crew and nobody apart", async ({ context, page }) => {
    /*
     * The three answers, on the screen a coordinator reads before picking up
     * the phone. The crew-code-only orders are the ones WA-38 part 1 seeded;
     * `CONT01` is external work, so the page says that rather than naming a
     * person who is not involved.
     */
    await useRole(context, "maintenanceCoordinator");

    const crewOnly = seed.workOrderAssignments.find(
      (assignment) =>
        assignment.userId === null && assignment.crewCode === "CONT01",
    )!;
    const order = seed.workOrders.find(
      (candidate) => candidate.id === crewOnly.workOrderId,
    )!;

    await page.goto(`/en/work-orders/${order.number}`);
    // The catalogue tags the code so only it is monospaced; what a reader sees
    // is the sentence with the tags resolved, so that is what is asserted.
    const contractor = en.workOrderDetail.assignee.contractor
      .replace(/<\/?mono>/g, "")
      .replace("{code}", "CONT01");
    await expect(page.getByText(contractor)).toBeVisible();
    // Not the word the record does not say.
    await expect(
      page.getByText(en.workOrderDetail.assignee.nobody, { exact: true }),
    ).toHaveCount(0);
  });

  test("does not call finished work late", async ({ context, page }) => {
    /*
     * A cancelled order whose date has gone by had a date, and is not late:
     * nobody is waiting on it. The selector decides this and the page prints
     * it, so this is the end-to-end half of that unit test.
     */
    await useRole(context, "maintenanceCoordinator");

    const closed = seed.workOrders.find(
      (order) =>
        order.dueAt !== null &&
        order.dueAt < today &&
        (order.status === "cancelled" || order.status === "completed"),
    )!;
    expect(closed).toBeDefined();

    await page.goto(`/en/work-orders/${closed.number}`);
    await expect(heading(page, closed.number)).toBeVisible();
    await expect(page.getByText(/days late/)).toHaveCount(0);
  });

  test("becomes one column on a phone, with nothing overflowing", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.phone);

    const order = seed.workOrders[0]!;
    await page.goto(`/en/work-orders/${order.number}`);
    await expect(heading(page, order.number)).toBeVisible();

    expect(await hasHorizontalOverflow(page)).toBe(false);
  });
});
