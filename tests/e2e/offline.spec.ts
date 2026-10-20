import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import {
  VIEWPORTS,
  hydrated,
  useRole,
  watchConsole,
  withServiceWorker,
} from "../fixtures/shell";

/**
 * Offline mode, driven the way the recording will be.
 *
 * The tender asks that the application be usable with no network, that changes
 * queue, that they synchronise on reconnect and that conflicts be manageable.
 * Each of those is watched here rather than asserted about: the network is
 * actually switched off, the page is actually reloaded, and the queue is
 * actually drained.
 */

async function pendingText(page: Page) {
  return (
    await page.locator('[data-slot="pending-count"]').first().innerText()
  ).trim();
}

test.describe("offline mode", () => {
  test("the application opens with the network switched off", async ({
    context,
    page,
  }) => {
    await withServiceWorker(page);

    await context.setOffline(true);
    await page.reload();

    // The whole requirement in one assertion: the shell came from the cache.
    await expect(page.getByRole("main")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: en.modules.dashboard.title }),
    ).toBeVisible();
    await expect(
      page.locator('[data-slot="offline-banner"][data-state="offline"]'),
    ).toBeVisible();

    await context.setOffline(false);
  });

  test("three changes queue while offline and say how many are waiting", async ({
    context,
    page,
  }) => {
    const watcher = watchConsole(page);
    await useRole(context, "maintenanceCoordinator");
    await withServiceWorker(page, "/en/work-orders");
    await expect(
      page.getByRole("searchbox", { name: en.workOrderQueue.searchLabel }),
    ).toBeVisible();
    await context.setOffline(true);

    // Counted before anything is queued, so "three" below is a count that
    // moved rather than a number that was always there.
    await expect(
      page.locator('[data-slot="offline-banner"][data-state="offline"]'),
    ).toBeVisible();
    expect(await pendingText(page)).toContain("Nothing waiting");

    const seen: string[] = [];
    for (const title of ["First job", "Second job", "Third job"]) {
      await page
        .getByLabel(en.workOrderForm.fields.asset)
        .selectOption({ index: 1 });
      await page.getByLabel(en.workOrderForm.fields.title).fill(title);
      await page
        .getByLabel(en.workOrderForm.fields.description)
        .fill("Raised with no connection.");
      await page.getByRole("button", { name: en.workOrderForm.submit }).click();
      await expect(page.getByText(title)).toBeVisible();

      /*
       * And wait for the form to be ready again before typing the next one.
       *
       * The row above is drawn from the store, which the write updates
       * synchronously — so it appears while the submit is still waiting for
       * the browser to store the change, and the form clears only afterwards.
       * Without this wait the loop typed into a form that was about to be
       * reset underneath it, and the third order was silently lost.
       *
       * That was a real defect and not only a racing test: the fields used to
       * stay live while the button said "Saving…", so a person typing the next
       * order lost it too. A disabled fieldset closes that window now, and this
       * waits for the window to be shut rather than assuming it never opened.
       */
      await expect(page.getByLabel(en.workOrderForm.fields.title)).toHaveValue(
        "",
      );

      seen.push(await pendingText(page));
    }

    // One at a time: 1, then 2, then 3. A count that ignored the queue, or one
    // that counted records instead of acts, fails here rather than at the
    // total.
    expect(seen[0]).toContain("1");
    expect(seen[1]).toContain("2");
    expect(seen[2]).toContain("3");

    // Three, because three things were done.
    //
    // Raising an order writes the order and the first row of its history, and
    // a person did one thing — so the repository writes them as one act and
    // the queue holds one entry. Before the batch path this read six, which is
    // the count of records written rather than of changes a person made.
    await expect.poll(async () => pendingText(page)).toContain("3");

    await context.setOffline(false);

    // With the network off the browser logs every request it could not make.
    // That is the network being off, not the application misbehaving, so it is
    // filtered by exactly that signature — and anything else still fails, which
    // is the difference between filtering and loosening.
    const notTheNetwork = watcher.errors.filter(
      (message) => !/net::ERR_INTERNET_DISCONNECTED/.test(message),
    );
    expect(
      notTheNetwork,
      "the application logged something that was not the network being off",
    ).toEqual([]);
  });

  test("reconnecting drains the queue, and the log says what happened", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await withServiceWorker(page, "/en/work-orders");
    await expect(
      page.getByRole("searchbox", { name: en.workOrderQueue.searchLabel }),
    ).toBeVisible();

    await context.setOffline(true);
    await page
      .getByLabel(en.workOrderForm.fields.asset)
      .selectOption({ index: 1 });
    await page.getByLabel(en.workOrderForm.fields.title).fill("Queued job");
    await page
      .getByLabel(en.workOrderForm.fields.description)
      .fill("Raised with no connection.");
    await page.getByRole("button", { name: en.workOrderForm.submit }).click();
    await expect.poll(async () => pendingText(page)).toContain("1");

    await context.setOffline(false);

    // The planted conflict is the first thing reconnecting meets.
    const dialog = page.locator('[data-slot="conflict-dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(en.offline.conflictMine)).toBeVisible();
    await expect(dialog.getByText(en.offline.conflictTheirs)).toBeVisible();

    await page
      .getByRole("button", { name: en.offline.conflictKeepMine })
      .click();
    await expect(dialog).toHaveCount(0);

    // Settings is open to Administrator and Facility manager only, so the log
    // is read as one of those. The pending count in the banner is visible to
    // every role; the log is not, which is recorded as a limitation rather
    // than worked around here.
    await useRole(context, "administrator");
    await page.goto("/en/settings");
    await hydrated(page);
    const log = page.locator('[data-slot="sync-log"] li');
    await expect(log.first()).toBeVisible();
    expect(await log.count()).toBeGreaterThan(0);
    await expect(
      page
        .locator('[data-slot="sync-log"]')
        .getByText(en.offline.outcome.keptMine),
    ).toBeVisible();
  });

  test("the conflict is recorded in the trail as a sentence", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await withServiceWorker(page, "/en/work-orders");
    await expect(
      page.getByRole("searchbox", { name: en.workOrderQueue.searchLabel }),
    ).toBeVisible();

    await context.setOffline(true);
    await page
      .getByLabel(en.workOrderForm.fields.asset)
      .selectOption({ index: 1 });
    await page.getByLabel(en.workOrderForm.fields.title).fill("Audited job");
    await page
      .getByLabel(en.workOrderForm.fields.description)
      .fill("Raised with no connection.");
    await page.getByRole("button", { name: en.workOrderForm.submit }).click();
    await context.setOffline(false);

    await page
      .getByRole("button", { name: en.offline.conflictKeepTheirs })
      .click();

    // A sentence, not a raw key: registering an audit key without giving the
    // feed a branch for it is the failure this asserts against.
    /*
     * On the dashboard, not here. The trail used to sit on the work-orders page
     * inside `WorkOrderList`, which WA-38's queue replaced; the dashboard's
     * activity feed is where the trail lives. The claim is unchanged — the
     * resolution is recorded as a sentence a person can read — and asserting it
     * on another screen is the stronger version of it.
     */
    await page.goto("/en/dashboard");
    await expect(
      page.getByText(/Kept the server's version/).first(),
    ).toBeVisible();
  });

  test("it all works at 390, which is where it will be used", async ({
    context,
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.phone);
    await useRole(context, "technician");
    await withServiceWorker(page, "/en/my-work");

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByRole("main")).toBeVisible();
    await expect(
      page.locator('[data-slot="offline-banner"][data-state="offline"]'),
    ).toBeVisible();

    const overflows = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
    );
    expect(overflows).toBe(false);

    await context.setOffline(false);
  });
});
