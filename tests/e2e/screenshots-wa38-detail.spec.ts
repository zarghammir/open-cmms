import { expect, test } from "@playwright/test";
import en from "../../messages/en.json";
import { buildSeed } from "@/data/seed";
import { toIsoDate } from "@/data/seed/dates";
import { useRole, VIEWPORTS, watchConsole } from "../fixtures/shell";
import { pinTheDay, screenshotDir, settled } from "../fixtures/screenshots";

/**
 * The pictures for WA-38 part 2, and the click-through that produces them.
 * Skipped unless WA_SCREENSHOTS=1.
 */
// Every picture is dated, so a run on a different day regenerates every file
// for no reason anybody can read in a diff. The clock is fixed before anything
// loads, because the records are built during the boot that follows.
test.beforeEach(async ({ page }) => {
  await pinTheDay(page);
});

const OUT = screenshotDir("WA-38");

const now = new Date();
const today = toIsoDate(now);
const seed = buildSeed(now);

test.describe("WA-38 detail screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  test("one order at three widths, both languages", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    const watcher = watchConsole(page);

    // An order with something in every panel, so the pictures show the page
    // rather than a column of empty states.
    const richest = [...seed.workOrders].sort(
      (a, b) =>
        countFor(b.id) - countFor(a.id) || a.number.localeCompare(b.number),
    )[0]!;

    for (const locale of ["en", "fr"]) {
      for (const size of Object.values(VIEWPORTS)) {
        await page.setViewportSize(size);
        await page.goto(`/${locale}/work-orders/${richest.number}`);
        await expect(
          page.getByRole("heading", { name: richest.number, exact: true }),
        ).toBeVisible();
        await settled(page);
        await page.screenshot({
          path: `${OUT}/${locale}-order-${size.width}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
    }

    expect(watcher.errors).toEqual([]);
  });

  test("a number that resolves to nothing, and work that is late", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);

    await page.goto("/en/work-orders/WO-1999-9999");
    await expect(page.getByText(en.records.missingTitle)).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/order-not-found-1440.png`,
      animations: "disabled",
    });

    const late = seed.workOrders.find(
      (order) =>
        order.dueAt !== null &&
        order.dueAt < today &&
        (order.status === "open" ||
          order.status === "assigned" ||
          order.status === "inProgress"),
    )!;
    await page.goto(`/en/work-orders/${late.number}`);
    await expect(
      page.getByRole("heading", { name: late.number, exact: true }),
    ).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/order-late-1440.png`,
      fullPage: true,
      animations: "disabled",
    });
  });
});

/** How much of the page an order actually fills, for picking one to photograph. */
function countFor(workOrderId: string): number {
  return (
    seed.workOrderTasks.filter((task) => task.workOrderId === workOrderId)
      .length +
    seed.workOrderComments.filter(
      (comment) => comment.workOrderId === workOrderId,
    ).length +
    seed.inventoryTransactions.filter(
      (transaction) => transaction.workOrderId === workOrderId,
    ).length +
    seed.workOrderStatusHistory.filter(
      (entry) => entry.workOrderId === workOrderId,
    ).length
  );
}
