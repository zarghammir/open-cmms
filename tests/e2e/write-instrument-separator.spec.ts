import { expect, test } from "@playwright/test";
import en from "../../messages/en.json";
import { buildSeed } from "@/data/seed";
import { hydrated, useRole, withoutServiceWorker } from "../fixtures/shell";
import { settledAuditCount, storedAuditCount } from "../fixtures/storage";

/**
 * THE SEPARATOR, NOT A TEST. Runs only when `WA_WRITE_INSTRUMENTS=1`.
 *
 * The forty-cycle diagnosis falsified the first hypothesis: in all three
 * failing cycles the stored trail read 118 three seconds after the new document
 * had drawn its dashboard, so the write is not merely in flight when the
 * navigation begins. But it could not say *which* of two things happened, and
 * that was a gap in the instrument rather than in the data:
 *
 *   (a) the write never reached the database at all; or
 *   (b) it reached the database, and the new document then overwrote it —
 *       rehydrating the pre-write snapshot and persisting that back, which
 *       `ensureSeeded`'s `set` does within a few hundred milliseconds of boot,
 *       long before any reading taken after the dashboard has drawn.
 *
 * Both produce exactly the same numbers. They need different fixes: (a) wants a
 * barrier before the page goes, (b) wants ordering between two documents over
 * one database, which is the ticket's own second hypothesis.
 *
 * **The separator is a document that tears the page down without booting the
 * application.** `/icon.svg` is served from the same origin, so IndexedDB is
 * still the same database and still readable from `page.evaluate`; it is a real
 * navigation, so the writing document is really destroyed; and nothing in it
 * runs the store, so nothing can overwrite anything.
 *
 * Three readings, and the verdict falls out of a single cycle rather than out
 * of a rate:
 *
 *   before     in the application, before the person's write
 *   atStatic   at `/icon.svg`, after the writing document is gone
 *   afterApp   after the dashboard has booted and drawn the feed
 *
 *   atStatic > before, afterApp > before    the cycle passed
 *   atStatic > before, afterApp == before   (b) PROVEN. The write survived the
 *                                           teardown, and the application
 *                                           destroyed it afterwards.
 *   atStatic == before, afterApp == before  (a). The write did not survive the
 *                                           teardown; no reader was involved.
 *
 * That second row is why this is worth running rather than comparing rates: it
 * catches the overwrite in the act, in one cycle, with no statistics.
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

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

test.describe("write instruments: the separator", () => {
  test.skip(
    !process.env.WA_WRITE_INSTRUMENTS,
    "set WA_WRITE_INSTRUMENTS=1 to run the write instruments",
  );

  test("WA-67 separator: does the write survive a teardown with nothing to overwrite it", async ({
    context,
    page,
  }) => {
    const order = seed.workOrders.find((one) => one.status === "open");
    if (!order) throw new Error("The seed holds no open work order");

    await useRole(context, "maintenanceCoordinator");
    await page.goto(`/en/work-orders/${order.number}`);
    await hydrated(page);
    await expect(
      page.getByRole("heading", { name: order.number, exact: true }),
    ).toBeVisible();

    const origin = new URL(page.url()).origin;
    const before = await settledAuditCount(page);

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

    // The floor, off the screen so it touches no database: the write happened.
    await expect(
      page.getByText(en.workOrderStatus.cancelled).first(),
      "the cancellation never reached the store — this cycle says nothing",
    ).toBeVisible();

    // Nothing between the write and the teardown.
    await page.goto("/icon.svg");

    /*
     * Floor C, and it is the one that could quietly ruin this experiment.
     *
     * IndexedDB is per origin. If this document turned out to be on a different
     * origin — or to be one where the database is simply not reachable — then
     * `storedAuditCount` would answer -1, "there is no database", and -1 is not
     * greater than 118. The cycle would read as (a) and be wrong: a measurement
     * of the wrong database reported as a lost write.
     *
     * So the origin is checked, and the reading is required to be a real count
     * rather than one of the named negatives, before any verdict is drawn.
     */
    expect(
      new URL(page.url()).origin,
      "the separator document is on a different origin, so it is not looking at the same database",
    ).toBe(origin);

    const atStatic = await storedAuditCount(page);
    expect(
      atStatic,
      `the separator document cannot read the database (${atStatic}): ` +
        "-1 no database, -2 no object store, -3 no record, -4 no records in the blob. " +
        "This cycle is invalid, not evidence of a lost write.",
    ).toBeGreaterThan(0);

    // And now let the application have it.
    await page.goto("/en/dashboard");
    await hydrated(page);
    await expect(
      page.locator('[data-slot="activity-feed"] li').first(),
    ).toBeVisible();

    const sentence = en.audit.workOrderCancelled
      .replace("{number}", order.number)
      .replace("{reason}", en.cancellationReason.duplicate);
    const survived = await page.getByText(sentence).count();
    const afterApp = await storedAuditCount(page);

    const verdict =
      atStatic > before
        ? afterApp > before
          ? "PASSED — the write landed and stayed"
          : "(b) OVERWRITTEN — the write survived the teardown, the application destroyed it"
        : "(a) NOT WRITTEN — the write did not survive the teardown";

    console.info(
      `WA67SEP before=${before} atStatic=${atStatic} afterApp=${afterApp} feed=${survived} ${verdict}`,
    );

    if (SMOKE) return;
    expect(
      survived,
      `WA67SEP before=${before} atStatic=${atStatic} afterApp=${afterApp} :: ${verdict}`,
    ).toBeGreaterThan(0);
  });
});
