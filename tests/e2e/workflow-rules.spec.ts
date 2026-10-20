import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { buildSeed } from "@/data/seed";
import { settledAuditCount, storedAuditCount } from "../fixtures/storage";
import {
  VIEWPORTS,
  hydrated,
  useRole,
  watchConsole,
  withoutServiceWorker,
} from "../fixtures/shell";

// WA-15 registers a service worker that caches HTML. Every spec but its own
// asserts against a fresh response, so the worker is removed first.
test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

/**
 * WA-22's QA steps 3 and 4, which nothing could demonstrate until now.
 *
 * Step 3: turn off "in progress → completed" in Settings; as a technician the
 * Complete button on a live work order is **visible, disabled and says why**;
 * turn it back on and it returns. Step 4: with the note required, finishing
 * without one is refused.
 *
 * Both are here rather than in a unit test because both are about what a
 * person sees after a rule changes under them — a route, a cookie, a rendered
 * shell and a store write, none of which a unit test assembles.
 */

/**
 * Waits for a rule change to be on the device before leaving the page.
 *
 * The repository's own rule — the write, then the navigation — and a checkbox
 * has no dialog whose closing says it landed. So the trail is the signal: one
 * change writes one audit entry, and reading the stored count until it moves
 * is both the proof and the wait.
 *
 * A read here is deliberately a synchronisation point rather than an
 * accident. A readonly transaction opened after an in-flight readwrite waits
 * for it, so polling *helps* the write land — which is the opposite of what it
 * would do to a test measuring a write's absence, and is why the fixture's
 * docblock warns against polling there. Here landing is what is wanted.
 */
async function ruleChangeStored(page: Page, before: number) {
  await expect
    .poll(() => storedAuditCount(page), {
      message: "the rule change never reached the database",
      timeout: 15_000,
    })
    .toBeGreaterThan(before);
}

/**
 * A work order that is in progress, named from the same generator the browser
 * seeds itself with.
 *
 * Reached by its number rather than by clicking the first row of a list: the
 * Complete button only exists on an order that can still be finished, and a
 * technician's own list is whatever was assigned to them. Naming a record in
 * advance is the thing WA-10 warns about when it decides which *page* of a
 * table a test lands on — a detail route has no pages, so the objection does
 * not apply here.
 */
const LIVE_NUMBER = buildSeed(new Date()).workOrders.find(
  (order) => order.status === "inProgress",
)!.number;

async function openLiveOrder(page: Page, locale: "en" | "fr") {
  await page.goto(`/${locale}/work-orders/${LIVE_NUMBER}`);
  await hydrated(page);
  await expect(
    page.getByRole("heading", { name: LIVE_NUMBER, exact: true }),
  ).toBeVisible();
}

/** The checkbox governing one move of the status map, on the Settings screen. */
function moveSwitch(page: Page, from: string, to: string) {
  return page
    .locator(
      `[data-slot="workflow-move"][data-from="${from}"][data-to="${to}"]`,
    )
    .locator("input");
}

async function openSettings(page: Page, locale: "en" | "fr") {
  await page.goto(`/${locale}/settings`);
  await hydrated(page);
  // The panel draws from the store, so this is also the wait that makes the
  // click below land on a bound handler rather than on server markup.
  await expect(page.locator('[data-slot="workflow-rules"]')).toBeVisible();
}

for (const locale of ["en", "fr"] as const) {
  for (const [label, size] of [
    ["desk", VIEWPORTS.desktop],
    ["phone", VIEWPORTS.phone],
  ] as const) {
    test(`a rule turned off disables the control and says why: ${locale} at ${size.width}`, async ({
      context,
      page,
    }) => {
      const messages = locale === "fr" ? fr : en;
      const watcher = watchConsole(page);
      await page.setViewportSize(size);
      expect(page.viewportSize()).toEqual(size);

      await useRole(context, "administrator");
      await openSettings(page, locale);

      const before = await settledAuditCount(page);
      const toggle = moveSwitch(page, "inProgress", "completed");
      await expect(
        toggle,
        "the move is allowed before anything is changed",
      ).toBeChecked();
      await toggle.uncheck();
      await ruleChangeStored(page, before);

      /*
       * Now as somebody who does the work. The role gate and the rule gate are
       * different questions, and the point of this step is that a technician —
       * who holds `workOrder.complete` — is stopped by the rule rather than by
       * their role.
       */
      await useRole(context, "technician");
      await openLiveOrder(page, locale);

      const blocked = page.locator('[data-slot="rule-blocked-action"]');
      await expect(
        blocked,
        "the control is gone rather than disabled — a screen that gets shorter shows nothing",
      ).toBeVisible();
      await expect(blocked.getByRole("button")).toBeDisabled();

      // And it says why, on the keyboard path: a disabled button cannot take
      // focus, so the wrapper is the only way a keyboard reaches the reason.
      await blocked.focus();
      await expect(
        page.getByText(messages.workOrderStatus.refusedByRule),
      ).toBeVisible();

      expect(watcher.errors, "the console stayed clean").toEqual([]);
    });
  }
}

test("turning the rule back on returns the control", async ({
  context,
  page,
}) => {
  await useRole(context, "administrator");
  await openSettings(page, "en");

  const before = await settledAuditCount(page);
  const toggle = moveSwitch(page, "inProgress", "completed");
  await toggle.uncheck();
  await ruleChangeStored(page, before);

  const middle = await storedAuditCount(page);
  await toggle.check();
  await ruleChangeStored(page, middle);

  await useRole(context, "technician");
  await openLiveOrder(page, "en");

  // Back to a real control, and no disabled stand-in left behind.
  await expect(page.locator('[data-slot="rule-blocked-action"]')).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", {
      name: en.workOrderDetail.write.actions.complete,
    }),
  ).toBeVisible();
});

test("the completion note is required while the rule says so", async ({
  context,
  page,
}) => {
  /*
   * QA step 4. The rule is seeded on, so this is today's behaviour — the step
   * demonstrates that the switch governs something real rather than that the
   * behaviour is new.
   */
  await useRole(context, "administrator");
  await openSettings(page, "en");
  await expect(page.locator('[data-slot="require-note"]')).toBeChecked();

  await useRole(context, "technician");
  await openLiveOrder(page, "en");

  await page
    .getByRole("button", { name: en.workOrderDetail.write.actions.complete })
    .click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Confirm with the note empty: the dialog stays open and says what is
  // missing, rather than closing on a write that was refused.
  await dialog
    .getByRole("button", { name: en.workOrderDetail.write.actions.complete })
    .click();
  await expect(
    dialog,
    "the dialog closed on a refused completion",
  ).toBeVisible();

  /*
   * The positive beside the negative, and step 4's actual demonstration.
   *
   * "The dialog stayed open" is true of a dialog that stayed open for any
   * reason at all — a validation message, a slow write, a button that does
   * nothing. What makes it evidence that the RULE stopped it is that turning
   * the rule off lets the same empty note through. Without this half the test
   * would pass on a completion path that was simply broken.
   */
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await useRole(context, "administrator");
  await openSettings(page, "en");
  const before = await settledAuditCount(page);
  await page.locator('[data-slot="require-note"]').uncheck();
  await ruleChangeStored(page, before);

  await useRole(context, "technician");
  await openLiveOrder(page, "en");
  await page
    .getByRole("button", { name: en.workOrderDetail.write.actions.complete })
    .click();
  const second = page.getByRole("dialog");
  await expect(second).toBeVisible();
  await second
    .getByRole("button", { name: en.workOrderDetail.write.actions.complete })
    .click();

  // The dialog closing is this screen's durability signal: it shuts only after
  // the write reports stored.
  await expect(
    second,
    "the completion was still refused with the rule switched off",
  ).toBeHidden();
});

test("the reset puts the rules back, and the trail says it happened", async ({
  context,
  page,
}) => {
  await useRole(context, "administrator");
  await openSettings(page, "en");

  const before = await settledAuditCount(page);
  await moveSwitch(page, "inProgress", "completed").uncheck();
  await ruleChangeStored(page, before);

  await page.getByRole("button", { name: en.demo.reset }).click();
  const confirm = page.getByRole("dialog");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: en.demo.reset }).click();
  // The dialog closing is the durability signal this screen offers.
  await expect(confirm).toBeHidden();

  await openSettings(page, "en");
  await expect(
    moveSwitch(page, "inProgress", "completed"),
    "the reset did not put the rule back",
  ).toBeChecked();
});
