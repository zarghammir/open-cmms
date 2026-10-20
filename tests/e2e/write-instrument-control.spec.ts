import { expect, test } from "@playwright/test";
import en from "../../messages/en.json";
import { buildSeed } from "@/data/seed";
import { hydrated, useRole, withoutServiceWorker } from "../fixtures/shell";
import { settledAuditCount, storedAuditCount } from "../fixtures/storage";

/**
 * An instrument, not a test. Runs only when `WA_WRITE_INSTRUMENTS=1`.
 *
 * These four measure the write path rather than asserting a behaviour, and they
 * are in the repository because the mechanism they proved will be argued about
 * again the next time a change goes missing — and because a measurement nobody
 * can repeat is an opinion. They are out of the default run: forty cold cycles
 * apiece is not something a person should pay for on every push.
 *
 * `late-write.spec.ts` is the regression test and stays in the default suite.
 */

/**
 * THE CONTROL, NOT A TEST. Runs only when `WA_WRITE_INSTRUMENTS=1`.
 *
 * The separator showed the change is absent from the database once the writing
 * document is gone, with nothing in the next document able to overwrite it. It
 * did not show that **the teardown is what causes it**. The alternative it
 * leaves open is unglamorous and entirely possible: a write that sometimes
 * fails on its own, navigation or no navigation — and `setItem` swallows every
 * write error into `catch { durable = false }`, so a write that simply failed
 * would look exactly like a write that was killed.
 *
 * This is the separator with the one line that matters removed. Same role, same
 * order, same cancellation, same reading — and **no navigation at all**. The
 * document that made the change is the document that reads it back.
 *
 *   40 of 40 land  -> an undisturbed write always arrives, so the teardown is
 *                     the cause and the mechanism is closed.
 *   any that do not -> writes fail on their own too, and the teardown is at
 *                     most part of it.
 *
 * On reading from the same document: a readonly transaction created after an
 * in-flight readwrite on the same object store queues behind it, so this waits
 * for the write to settle rather than racing it. That is the wrong thing to do
 * between a write and a navigation — it would flush what is being measured —
 * and exactly the right thing here, where the question is not "has it landed
 * yet" but "does it land at all". It cannot make a write succeed that would
 * otherwise have failed; it only declines to look until the answer is final.
 */

const seed = buildSeed(new Date());

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

test.describe("write instruments: the control", () => {
  test.skip(
    !process.env.WA_WRITE_INSTRUMENTS,
    "set WA_WRITE_INSTRUMENTS=1 to run the write instruments",
  );

  test("WA-67 control: does an undisturbed write reach the database", async ({
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
      "the cancellation never reached the store — this cycle says nothing",
    ).toBeVisible();

    // And now the one difference from the separator: nothing happens to the page.
    // The same three seconds the diagnosis waited before its second reading.
    await page.waitForTimeout(3_000);

    const after = await storedAuditCount(page);

    const verdict =
      after > before
        ? "LANDED"
        : "DID NOT LAND — a write failed with no navigation anywhere near it";

    console.info(`WA67CTL before=${before} after=${after} ${verdict}`);

    expect(
      after,
      `WA67CTL before=${before} after=${after} :: ${verdict}`,
    ).toBeGreaterThan(before);
  });
});
