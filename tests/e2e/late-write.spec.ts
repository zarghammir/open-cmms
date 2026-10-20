import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import { buildSeed } from "@/data/seed";
import { hydrated, useRole, withoutServiceWorker } from "../fixtures/shell";
import {
  armSlowWrites,
  delayedOpenCount,
  installSlowWrites,
  settledAuditCount,
  storedAuditCount,
} from "../fixtures/storage";

/**
 * A change a person has made survives a full page load.
 *
 * Nothing else in the suite claims this. PR #42's cancel test used to, and it
 * was asked to stop: it was claiming two things at once and failing for
 * whichever was broken while naming the other, so it now reaches the dashboard
 * through the application's own link and keeps the store in memory. That left
 * the full-load claim uncovered, and this is where it lands — as the subject
 * rather than the scenery.
 *
 * The defect it is about: a write that has not reached IndexedDB when the
 * navigation tears the page down. `commit` returns `void`, nothing in the
 * application awaits a write, and there is no `pagehide`, `visibilitychange`
 * or `beforeunload` handler anywhere in `src` — so on a reload there is at
 * present nothing that could wait. It shows up as a fully rendered dashboard
 * holding the persisted records with the person's change simply absent, about
 * one load in ten to twenty.
 *
 * **Forced, not waited for.** A test that waited for that rate would pass for
 * the wrong reason nineteen times out of twenty, and the reviewer has already
 * watched this family get rescued by a retry on five different heads. The
 * write is held back by a known amount instead, so "it had not landed" is a
 * fact about the run rather than a hope about it.
 */

const HOLD = 3_000;

const seed = buildSeed(new Date());

function openOrder() {
  const found = seed.workOrders.find((order) => order.status === "open");
  if (!found) throw new Error("The seed holds no open work order");
  return found;
}

/** The sentence the trail should carry afterwards, in the reader's language. */
function cancelledSentence(number: string) {
  return en.audit.workOrderCancelled
    .replace("{number}", number)
    .replace("{reason}", en.cancellationReason.duplicate);
}

/**
 * Both readings, taken after the navigation and never before it.
 *
 * The pair is the discriminator. If the new document rehydrated the pre-write
 * snapshot while the database ends up holding the change, the write landed
 * late — which is this ticket. If the database never holds it either, the write
 * was lost rather than late, and that is a different defect with a different
 * fix.
 */
async function readings(page: Page) {
  // After the navigation, so the boot window is long past and a single read
  // is what is wanted: this is the reading the whole instrument is about.
  const afterLoad = await storedAuditCount(page);
  return { afterLoad };
}

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

test("a cancellation survives a full page load, even when the write is slow", async ({
  context,
  page,
}) => {
  const order = openOrder();

  await installSlowWrites(page);
  await useRole(context, "maintenanceCoordinator");
  await page.goto(`/en/work-orders/${order.number}`);
  await hydrated(page);
  await expect(
    page.getByRole("heading", { name: order.number, exact: true }),
  ).toBeVisible();

  // Before the write under test, so it cannot flush it: the seed has landed,
  // and there is a stored trail for the cancellation to be added to. Reading
  // here is safe for the same reason reading later is — what is forbidden is
  // reading *between* the write and the navigation.
  // Settled rather than sampled: this is a floor taken before anything has
  // been armed, and the seed's write lands after `hydrated` rather than with
  // it. Reading once here is the WA-94 window — it answers -4 on a loaded
  // machine and fails a run that has not measured anything yet. The number is
  // kept, because the message below quotes it against the reading taken after
  // the navigation.
  const before = await settledAuditCount(page);

  // From here every write is held back. Armed now rather than at the start, so
  // the only thing in flight is the one being measured — a navigation before
  // the *seed* landed is WA-58's defect, not this one.
  await armSlowWrites(page, HOLD);

  await page
    .getByRole("button", { name: en.workOrderDetail.write.actions.cancel })
    .click();
  await expect(
    page.getByText(en.workOrderDetail.write.cancel.description),
  ).toBeVisible();
  await page
    .getByLabel(en.workOrderDetail.write.cancel.reason)
    .selectOption("duplicate");
  const clicked = Date.now();
  await page
    .getByRole("button", { name: en.workOrderDetail.write.cancel.submit })
    .click();

  /*
   * Floor A: the screen said the change was saved.
   *
   * The **toast**, not the status chip. That distinction is the entire ticket
   * and this test had it wrong until it was read again: the chip is drawn from
   * the store, which `commit` updates synchronously, so it is true before a
   * byte has been written and a test that waits for it is waiting for nothing.
   * A regression test built on the chip would have gone on failing after the
   * fix — it would have been measuring the raw mechanism rather than the
   * promise the fix makes.
   *
   * The toast is the only place the application claims a change is saved, and
   * with the fix it is behind `whenFlushed()`. So this is the person's path:
   * they are told it is done, and then they reload.
   *
   * Reading the screen touches no database, so it cannot serialise the
   * transaction in flight.
   */
  await expect(
    page.getByText(
      en.workOrderDetail.write.cancel.done.replace("{number}", order.number),
    ),
    "the screen never said the cancellation was saved",
  ).toBeVisible({ timeout: 20_000 });

  /*
   * And it waited for it. Every write is held back by `HOLD`, so a "done" that
   * arrived sooner than that did not wait for the browser — which is the defect
   * with the message changed. Four fifths of the hold rather than all of it,
   * because the cancellation is more than one write and the clock starts before
   * the click is dispatched; the point is the order of magnitude, not the
   * millisecond.
   */
  expect(
    Date.now() - clicked,
    "the screen said the change was saved before the browser could have stored it",
  ).toBeGreaterThanOrEqual(HOLD * 0.8);

  // Floor B: the delay is real. A run where nothing was held back is a run
  // that did not test a slow write, however green it looks.
  expect(
    await delayedOpenCount(page),
    "no write was held back: the forcing script did not fire, so this run is not evidence",
  ).toBeGreaterThan(0);

  // The exposing sequence. Immediately, with nothing in between: a full
  // document load, which is what a person does when they reload or follow a
  // link from outside the application.
  await page.goto("/en/dashboard");
  await hydrated(page);

  /*
   * And the feed itself. `hydrated` answers for the store, not for this
   * screen: `DemoBoot` sits in the application layout while the dashboard
   * renders behind a Suspense boundary, so the marker can read ready while the
   * server's fallback is still what is on screen. Without this the budget
   * below is spent loading a chunk, and the failure accuses the write path of
   * losing something the store is holding.
   */
  await expect(
    page.locator('[data-slot="activity-feed"] li').first(),
  ).toBeVisible();

  const { afterLoad } = await readings(page);

  await expect(
    page.getByText(cancelledSentence(order.number)),
    `the cancellation did not survive the load. Stored trail: ${before} before the write, ` +
      `${afterLoad} after the load. If those are equal the write never reached the database at all; ` +
      `if the second is larger it arrived after the new document had already read.`,
  ).toBeVisible();
});
