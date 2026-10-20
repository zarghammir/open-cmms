import { expect, test } from "@playwright/test";
import en from "../../messages/en.json";
import { buildSeed } from "@/data/seed";
import { hydrated, useRole, withoutServiceWorker } from "../fixtures/shell";
import { settledAuditCount, storedAuditCount } from "../fixtures/storage";

/**
 * THE INSTRUMENT, NOT A TEST. Runs only when `WA_WRITE_INSTRUMENTS=1`.
 *
 * Run cold with `--repeat-each=40 --retries=0`. Each repeat is a fresh context,
 * so each is one full cycle at the natural rate — no forcing, because what this
 * is for is finding out *which* mechanism is at work, and forcing one of them
 * would answer the question by assuming it.
 *
 * Three numbers per cycle, and the pair of the last two is the discriminator:
 *
 *   before      the stored trail before the person's write
 *   afterLoad   the stored trail as soon as the new document has drawn the feed
 *   afterSettle the stored trail three seconds later
 *
 *   feed has it, afterLoad > before        the cycle passed — discard
 *   feed lacks it, afterSettle > before    the write landed AFTER the new
 *                                          document read: late, not lost.
 *                                          Hypothesis 1 confirmed.
 *   feed lacks it, afterSettle == before   the write never reached the database
 *                                          at all: lost, not late.
 *                                          Hypothesis 1 falsified — go to 2.
 *
 * Two readings after the load rather than one, because a single reading taken
 * the instant the feed appears can itself be earlier than a late write, and
 * would report "lost" for something that was merely slow.
 *
 * NOTHING IS READ BETWEEN THE WRITE AND THE NAVIGATION. A readonly transaction
 * created after an in-flight readwrite on the same object store waits for that
 * readwrite to finish, so a probe there would flush the very write whose
 * absence is being measured and every cycle would pass. That is WA-58's lesson
 * — instrumenting the read moved the race — and it is why the instrument the
 * ticket originally described could not be built.
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

test.describe("write instruments: the diagnosis", () => {
  test.skip(
    !process.env.WA_WRITE_INSTRUMENTS,
    "set WA_WRITE_INSTRUMENTS=1 to run the write instruments",
  );

  test("WA-67 cycle: does a cancellation survive a full page load", async ({
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
      "the cancellation never reached the store — this cycle says nothing about persistence",
    ).toBeVisible();

    // Nothing between here and the navigation.
    await page.goto("/en/dashboard");
    await hydrated(page);
    await expect(
      page.locator('[data-slot="activity-feed"] li').first(),
    ).toBeVisible();

    const sentence = en.audit.workOrderCancelled
      .replace("{number}", order.number)
      .replace("{reason}", en.cancellationReason.duplicate);
    const survived = await page.getByText(sentence).count();

    const afterLoad = await storedAuditCount(page);
    await page.waitForTimeout(3_000);
    const afterSettle = await storedAuditCount(page);

    const verdict =
      survived > 0
        ? "PASSED"
        : afterSettle > before
          ? "LATE — the write landed after the new document read"
          : "LOST — the write never reached the database";

    console.info(
      `WA67 before=${before} afterLoad=${afterLoad} afterSettle=${afterSettle} feed=${survived} ${verdict}`,
    );

    if (SMOKE) return;
    expect(
      survived,
      `WA67 before=${before} afterLoad=${afterLoad} afterSettle=${afterSettle} :: ${verdict}`,
    ).toBeGreaterThan(0);
  });
});
