import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import { buildSeed } from "@/data/seed";
import { hydrated, useRole, withoutServiceWorker } from "../fixtures/shell";

/**
 * PR #42's CANCEL TEST IN ITS ORIGINAL FULL-LOAD FORM — THE INSTRUMENT, NOT A TEST. Runs only when `WA_WRITE_INSTRUMENTS=1`.
 *
 * WA-67's third QA step: this passes 40 of 40 cold at `--retries=0` on a branch
 * carrying the fix. Before the fix the reviewer measured about four failures in
 * forty-eight under eight workers, and 2 of 20 and 1 of 20 in two earlier cold
 * runs.
 *
 * The body below is `work-order-write.spec.ts`'s cancel test unchanged, with
 * the one line 6f6a23d replaced put back: `page.goto("/en/dashboard")` where
 * the application's own link now is.
 */

/**
 * In continuous integration these run once, to prove the instrument still
 * works — not to measure anything.
 *
 * The distinction matters, and getting it wrong would have turned main red at
 * random. These instruments navigate **before** the change is flushed, on
 * purpose: that is the race, and the fix does not remove it, because nothing
 * can stop a reload killing a write that is in flight. What the fix does is
 * stop the screen claiming the change was saved first. So the survival verdict
 * is expected to fail some of the time, for ever, and a build that asserted it
 * would go red whenever the defect it measures actually happened.
 *
 * A rot-check must not assert the thing being measured. Under
 * `WA_INSTRUMENT_SMOKE` the floors are still asserted — the seed reached the
 * database, the write happened, the readings are real numbers — which is the
 * whole surface on which an instrument rots. The verdict is printed instead.
 */
const SMOKE = process.env.WA_INSTRUMENT_SMOKE === "1";

const seed = buildSeed(new Date());

function orderWith(status: string) {
  const found = seed.workOrders.find((order) => order.status === status);
  if (!found) throw new Error(`The seed holds no ${status} work order`);
  return found;
}

async function openOrder(page: Page, number: string, locale = "en") {
  await page.goto(`/${locale}/work-orders/${number}`);
  await hydrated(page);
  await expect(
    page.getByRole("heading", { name: number, exact: true }),
  ).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

test.describe("changing a work order", () => {
  test.skip(
    !process.env.WA_WRITE_INSTRUMENTS,
    "set WA_WRITE_INSTRUMENTS=1 to run the write instruments",
  );

  test("cancelling takes a reason, and the reason reaches the trail", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    const order = orderWith("open");
    await openOrder(page, order.number);

    await page
      .getByRole("button", { name: en.workOrderDetail.write.actions.cancel })
      .click();
    await expect(
      page.getByText(en.workOrderDetail.write.cancel.description),
    ).toBeVisible();
    await page
      .getByLabel(en.workOrderDetail.write.cancel.reason)
      .selectOption("duplicate");
    await page
      .getByRole("button", { name: en.workOrderDetail.write.cancel.submit })
      .click();

    await expect(
      page.getByText(en.workOrderStatus.cancelled).first(),
    ).toBeVisible();

    /*
     * On the dashboard, where the trail lives. The sentence has to carry the
     * reason — `statusChanged` would have recorded that the order was cancelled
     * and thrown away why, which is the half somebody is asked about later.
     */
    /*
     * As PR #42 had it, before 6f6a23d narrowed the claim: a full document
     * load. That commit swapped this for the application's own link so the
     * test stopped claiming two things at once — and in doing so left nothing
     * in the suite asserting that a write survives a fresh document.
     *
     * Restored here only to satisfy WA-67's third QA step: forty cold runs, on
     * a branch carrying the fix. This file is the instrument, not the suite,
     * and is removed before the pull request.
     */
    await page.goto("/en/dashboard");
    await hydrated(page);
    /*
     * And then the panel itself — WA-58.
     *
     * `hydrated` answers for the store, not for this screen. `DemoBoot` draws
     * `data-demo-status` from the application layout, while the dashboard
     * renders `DashboardView` behind a `Suspense` boundary, so the marker can
     * read "ready" while the server's fallback is still what is on screen and
     * `[data-slot="activity-feed"]` does not exist yet. Measured on a cold
     * production build under eight workers: at the moment `hydrated` resolved,
     * the store held the cancellation entry 12 times out of 12, and the feed
     * was absent — fallback still showing — in 5 of those 12.
     *
     * Without this wait the ten-second budget below is spent loading the
     * panel's chunk, and when it runs out the failure accuses the write path
     * of losing a cancellation that the store is provably holding. With it,
     * the failure says the feed never arrived, which is the true thing.
     */
    await expect(
      page.locator('[data-slot="activity-feed"] li').first(),
    ).toBeVisible();
    // The claim itself, which is the race. Under the smoke flag the instrument
    // has already proved it still runs — everything above this line — and the
    // outcome is what a measurement run is for.
    if (SMOKE) return;
    await expect(
      page.getByText(
        en.audit.workOrderCancelled
          .replace("{number}", order.number)
          .replace("{reason}", en.cancellationReason.duplicate),
      ),
    ).toBeVisible();
  });
});
