import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { buildSeed } from "@/data/seed";
import {
  hydrated,
  useRole,
  watchConsole,
  withoutServiceWorker,
} from "../fixtures/shell";

/**
 * Changing a work order, in a real browser.
 *
 * The repository's own tests prove the records move and the trail says so. What
 * these prove is the half a unit test cannot: that a person can reach the act,
 * that the screen tells them what it will do before they do it, and that a role
 * who may not is told rather than shown a screen with a hole in it.
 */

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

const seed = buildSeed(new Date());

function orderWith(status: string) {
  const found = seed.workOrders.find((order) => order.status === status);
  if (!found) throw new Error(`The seed holds no ${status} work order`);
  return found;
}

async function openOrder(page: Page, number: string, locale = "en") {
  await page.goto(`/${locale}/work-orders/${number}`);
  /*
   * Before anything is asserted or clicked. The heading below is not a
   * substitute: `ModuleScreen` is given the number straight off the URL, so
   * the server prints that heading for an order that does not exist and prints
   * it long before React has bound a handler to anything. Waiting on it and
   * then clicking is WA-52's failure exactly — the click lands on nothing and
   * the test fails later, somewhere else, for a reason that looks unrelated.
   *
   * So the two waits do different jobs: `hydrated` says the screen can answer
   * a click, the heading says which record we are looking at.
   */
  await hydrated(page);
  await expect(
    page.getByRole("heading", { name: number, exact: true }),
  ).toBeVisible();
}

test.describe("changing a work order", () => {
  test("starts work, and the screen says what that did", async ({
    context,
    page,
  }) => {
    const watcher = watchConsole(page);
    await useRole(context, "maintenanceCoordinator");
    const order = orderWith("assigned");
    await openOrder(page, order.number);

    await page
      .getByRole("button", { name: en.workOrderDetail.write.actions.start })
      .click();

    // The consequence is on screen before the act, not after it.
    await expect(
      page.getByText(en.workOrderDetail.write.consequence.start),
    ).toBeVisible();
    await page
      .getByRole("button", { name: en.workOrderDetail.write.actions.start })
      .last()
      .click();

    await expect(
      page.getByText(en.workOrderStatus.inProgress).first(),
    ).toBeVisible();
    // And the trail on this page grew, which is the part a test could otherwise
    // take on trust.
    await expect(
      page.getByText(
        en.workOrderDetail.history.moved
          .replace("{from}", en.workOrderStatus.assigned)
          .replace("{to}", en.workOrderStatus.inProgress),
      ),
    ).toBeVisible();

    expect(watcher.errors).toEqual([]);
  });

  test("refuses to complete without a note, and says which field", async ({
    context,
    page,
  }) => {
    /*
     * The rule is the repository's, and the schema carries it too so a person
     * is told rather than thrown at. This asserts the telling.
     */
    await useRole(context, "maintenanceCoordinator");
    const order = orderWith("inProgress");
    await openOrder(page, order.number);

    await page
      .getByRole("button", { name: en.workOrderDetail.write.actions.complete })
      .click();
    await expect(
      page.getByText(en.workOrderDetail.write.complete.description),
    ).toBeVisible();

    // Submit with the note empty.
    await page
      .getByRole("button", { name: en.workOrderDetail.write.complete.submit })
      .click();

    await expect(page.getByRole("alert").first()).toBeVisible();
    // Nothing happened: the order is still in progress behind the dialog.
    await page.keyboard.press("Escape");
    await expect(
      page.getByText(en.workOrderStatus.inProgress).first(),
    ).toBeVisible();
  });

  test("completes with a note, and records the time against the order", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    const order = orderWith("inProgress");
    await openOrder(page, order.number);

    await page
      .getByRole("button", { name: en.workOrderDetail.write.actions.complete })
      .click();
    await page
      .getByLabel(en.workOrderDetail.write.complete.minutes)
      .fill("120");
    await page
      .getByLabel(en.workOrderDetail.write.complete.note)
      .fill("Bearing replaced and run under load.");
    await page
      .getByRole("button", { name: en.workOrderDetail.write.complete.submit })
      .click();

    await expect(
      page.getByText(en.workOrderStatus.completed).first(),
    ).toBeVisible();
    // The minutes are a labour entry, so they show as time logged rather than
    // as a number stored on the order.
    await expect(
      page.getByText(
        en.workOrderDetail.labour.total.replace("{minutes}", "120"),
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Bearing replaced and run under load."),
    ).toBeVisible();
  });

  test("a completed order offers no way to start it again", async ({
    context,
    page,
  }) => {
    // The status map has no route out of Completed, and the screen asks the
    // same function the repository refuses with — so the button is absent
    // rather than present and broken.
    await useRole(context, "maintenanceCoordinator");
    const order = orderWith("completed");
    await openOrder(page, order.number);

    await expect(
      page.getByRole("button", {
        name: en.workOrderDetail.write.actions.start,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: en.workOrderDetail.write.actions.complete,
      }),
    ).toHaveCount(0);
  });

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
     * To the dashboard the way a person gets there — the application's own
     * link, not a fresh document.
     *
     * This test was asserting **two** things at once: that the reason reaches
     * the trail, and that it survives a full page load. Only the first is
     * WA-39's. The second is **WA-67**: measured twenty times cold on a build
     * carrying WA-58's fix and twenty without it, a fully rendered dashboard
     * holding the persisted records with the cancellation absent turns up
     * either way — a third mechanism, neither the reseed WA-58 removes nor the
     * unreadable state it adds, and most likely the write not reaching
     * IndexedDB before the navigation tears the page down.
     *
     * A test that claims two things fails for whichever is broken and names
     * the other. Left as `page.goto`, this one would have gone on reporting
     * "the reason never reached the trail" about a write it can prove
     * happened. A client-side navigation keeps the store in memory, so what is
     * left here is exactly the claim this ticket owns; WA-67's own regression
     * test takes the full-load form.
     */
    await page
      .getByRole("link", { name: en.modules.dashboard.title, exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/en\/dashboard/);
    // Still per navigation: a client-side route change replaces the screen, so
    // anything proved about the page before it says nothing about the page
    // after it.
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
    await expect(
      page.getByText(
        en.audit.workOrderCancelled
          .replace("{number}", order.number)
          .replace("{reason}", en.cancellationReason.duplicate),
      ),
    ).toBeVisible();
  });

  test("does not offer the importer's reason to a person", async ({
    context,
    page,
  }) => {
    // `notRecordedInSource` is what the MP2 import writes when the source
    // system had none. Offering it here would let somebody record that a
    // system had no reason for a decision they are making themselves.
    await useRole(context, "maintenanceCoordinator");
    await openOrder(page, orderWith("open").number);

    await page
      .getByRole("button", { name: en.workOrderDetail.write.actions.cancel })
      .click();
    const reasons = page.getByLabel(en.workOrderDetail.write.cancel.reason);
    await expect(reasons).toBeVisible();
    await expect(
      reasons.locator("option", {
        hasText: en.cancellationReason.notRecordedInSource,
      }),
    ).toHaveCount(0);
    // The control: the reasons a person may pick are there.
    await expect(
      reasons.locator("option", {
        hasText: en.cancellationReason.duplicate,
      }),
    ).toHaveCount(1);
  });

  test("a technician may finish work but not call it off", async ({
    context,
    page,
  }) => {
    /*
     * Two different sentences. The technician is shown Complete and is shown
     * Cancel *disabled with the reason* — not nothing, because a control that
     * is missing leaves somebody wondering whether the feature exists.
     */
    await useRole(context, "technician");
    await openOrder(page, orderWith("inProgress").number);

    await expect(
      page.getByRole("button", {
        name: en.workOrderDetail.write.actions.complete,
      }),
    ).toBeEnabled();

    const cancel = page.getByRole("button", {
      name: en.workOrderDetail.write.actions.cancel,
    });
    await expect(cancel).toBeDisabled();
    await page.locator('[data-slot="capability-action"]').first().hover();
    await expect(
      page.getByText(
        en.permissions.actionDenied.replace("{role}", en.roles.technician.name),
      ),
    ).toBeVisible();
  });

  /**
   * The reason, by both routes a person uses to ask for it.
   *
   * This test used to be called "an auditor is told why every control is
   * unavailable" and asserted only that the button was disabled and that no
   * checkbox was drawn. Neither of those is the reason, and a name claiming
   * more than the body performs hides the untested path better than no test
   * would: WA-78 is a defect in one of the two routes, and this file was green
   * throughout.
   *
   * **The reason hangs on the wrapper, not on the button.** A disabled button
   * cannot take focus, so `CapabilityAction` wraps it in a focusable span and
   * makes that span the tooltip trigger. The pointer reaches the span for the
   * same reason: the disabled button is transparent to it, so the hit test
   * lands on the span behind. Hovering the button locator would therefore be
   * asking Playwright to deliver a pointer event to an element that refuses
   * them, which is neither the product's route nor a person's.
   */
  test("an auditor is told why a control is unavailable, by pointer and by keyboard", async ({
    context,
    page,
  }) => {
    await useRole(context, "auditor");
    const order = orderWith("inProgress");
    await openOrder(page, order.number);

    const complete = page.getByRole("button", {
      name: en.workOrderDetail.write.actions.complete,
    });
    await expect(complete).toBeDisabled();

    const wrapper = page
      .locator('[data-slot="capability-action"]')
      .filter({ has: complete });
    const reason = en.permissions.actionDenied.replace(
      "{role}",
      en.roles.auditor.name,
    );

    // The pointer.
    await wrapper.hover();
    await expect(page.getByRole("tooltip")).toHaveText(reason);

    /*
     * Dismissed before the keyboard is tried, and asserted gone.
     *
     * Without this the second assertion would be reading the tooltip the
     * pointer opened, and would pass with the keyboard route broken — the
     * mirror image of the defect this test exists for.
     *
     * **Leaving a Radix tooltip trigger does not close it, and one jump of the
     * mouse is not leaving.** `pointerleave` on the trigger only builds a
     * grace-area polygon between the trigger and the content and sets "pointer
     * in transit" (`react-tooltip`, `TooltipContentHoverable`); the close lives
     * in a `document` `pointermove` listener that is attached on the render
     * after that. A single `mouse.move` fires exactly one event — the one that
     * built the polygon — so the listener never runs and the tooltip stays open
     * indefinitely. The first version of this test did exactly that and failed
     * here on the runner, twenty-four polls apart, on the attempt and on the
     * retry: deterministic, which is what says it is the instrument rather than
     * a race.
     *
     * So the pointer is moved to a neutral element and then nudged, which is
     * the second event the grace area is waiting for, and Escape is pressed as
     * well so the assertion does not depend on that geometry at all.
     */
    const heading = page.getByRole("heading", {
      name: order.number,
      exact: true,
    });
    // Neutral is asserted, not assumed: a "somewhere else" that carries a
    // trigger of its own opens a second tooltip and the count below reads 1
    // for a reason that has nothing to do with this test. Every trigger is
    // checked, not only the gated ones — the shell's own controls have them.
    await expect(heading.locator('[data-slot="tooltip-trigger"]')).toHaveCount(
      0,
    );
    await heading.hover();
    const away = (await heading.boundingBox())!;
    await page.mouse.move(away.x + away.width / 2 + 4, away.y + 2);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);

    // The keyboard.
    await wrapper.focus();
    await expect(page.getByRole("tooltip")).toHaveText(reason);

    // It explains itself; it does not become usable by being explained.
    await expect(complete).toBeDisabled();
  });

  /*
   * Split out of the test above, because it is a different claim about a
   * different control and the two were sharing one name.
   */
  test("an auditor sees the tasks as text rather than as disabled checkboxes", async ({
    context,
    page,
  }) => {
    await useRole(context, "auditor");
    await openOrder(page, orderWith("inProgress").number);

    // A disabled control says "unavailable to you", which is a claim about the
    // reader rather than about the record.
    await expect(page.getByRole("checkbox")).toHaveCount(0);
  });

  test("ticking a task records it, and unticking takes it back", async ({
    context,
    page,
  }) => {
    await useRole(context, "technician");
    const order = seed.workOrders.find((candidate) =>
      seed.workOrderTasks.some(
        (task) => task.workOrderId === candidate.id && !task.done,
      ),
    )!;
    await openOrder(page, order.number);

    const box = page.getByRole("checkbox").first();
    await expect(box).not.toBeChecked();
    await box.check();
    await expect(box).toBeChecked();
    await expect(
      page.getByText(en.workOrderDetail.tasks.done).first(),
    ).toBeVisible();

    // And back. A technician working one-handed mis-taps, and a checklist that
    // only goes one way turns that into a record of work nobody did.
    await box.uncheck();
    await expect(box).not.toBeChecked();
  });

  test("reads as French", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");
    await openOrder(page, orderWith("inProgress").number, "fr");

    await expect(
      page.getByRole("button", {
        name: fr.workOrderDetail.write.actions.complete,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: en.workOrderDetail.write.actions.complete,
      }),
    ).toHaveCount(0);
  });
});
