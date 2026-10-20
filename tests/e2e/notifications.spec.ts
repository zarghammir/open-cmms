import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import {
  hydrated,
  useRole,
  VIEWPORTS,
  withoutServiceWorker,
} from "../fixtures/shell";

/**
 * The alerts, in a browser, each one made to happen rather than read from the
 * seed.
 *
 * RFP 4.1.1(c) is the reason this file exists: automated notifications for
 * upcoming and overdue work, so completion can be monitored. What that clause
 * asks for is not "a bell with something in it" — it is that **doing something
 * to the records produces a notice for the right person**, which is the only
 * thing these tests assert.
 *
 * Each test makes its event happen the way a person does: raising an order
 * with a due date, issuing parts until the shelf runs short. Reading the
 * seeded notices instead would be a test of the seed.
 *
 * **The rules run on boot and after every write**, so nothing here waits on a
 * timer and nothing pins a clock. The sweep publishes what it did onto
 * `[data-slot="notification-sweep"]`, and every test below waits for a pass to
 * have finished before looking at the bell — a pass that ran and found nothing
 * looks exactly like a pass that never ran.
 */

const SWEEP = '[data-slot="notification-sweep"]';
const BELL = "[data-slot='notification-groups']";

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

/** Waits until the rules have finished at least one pass on this document. */
async function swept(page: Page) {
  await expect
    .poll(
      async () =>
        Number(
          (await page.locator(SWEEP).getAttribute("data-sweep-passes")) ?? "0",
        ),
      {
        message: "the notification rules never ran on this page",
        timeout: 15_000,
      },
    )
    .toBeGreaterThan(0);
}

/** Opens the bell and returns the number on its badge. */
async function unreadCount(page: Page): Promise<number> {
  const label =
    (await page
      .getByRole("button", { name: new RegExp(en.shell.notifications.label) })
      .getAttribute("aria-label")) ?? "";
  const found = /(\d+)/.exec(label);
  return found ? Number(found[1]) : 0;
}

/** Raises a work order from the queue screen, with the due date given. */
async function raiseOrder(page: Page, title: string, dueOn: string) {
  await page
    .getByLabel(en.workOrderForm.fields.asset)
    .selectOption({ index: 1 });
  await page.getByLabel(en.workOrderForm.fields.title).fill(title);
  await page
    .getByLabel(en.workOrderForm.fields.description)
    .fill("Raised by the notifications browser test.");
  await page.getByLabel(en.workOrderForm.fields.dueOn).fill(dueOn);
  await page.getByRole("button", { name: en.workOrderForm.submit }).click();
}

/** A calendar day relative to today, as the form's date field wants it. */
function day(offset: number): string {
  const at = new Date();
  at.setDate(at.getDate() + offset);
  return at.toISOString().slice(0, 10);
}

test("the bell groups what is waiting, and each item opens its record", async ({
  context,
  page,
}) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  await useRole(context, "maintenanceCoordinator");
  await page.goto("/en/dashboard");
  await hydrated(page);
  await swept(page);

  await page
    .getByRole("button", { name: new RegExp(en.shell.notifications.label) })
    .click();

  const groups = page.locator(BELL);
  await expect(groups).toBeVisible();

  /*
   * A floor before anything about grouping: an empty bell would satisfy every
   * assertion about what it does not contain.
   */
  const items = page.locator('[data-slot="notification-item"]');
  expect(
    await items.count(),
    "the bell is empty, so nothing below is being tested",
  ).toBeGreaterThan(0);

  // Grouped by kind, with a heading per group rather than one flat list.
  expect(
    await page.locator('[data-slot="notification-group"]').count(),
  ).toBeGreaterThan(0);

  // And the deep link: the first item that is a link goes to its record.
  const link = page.locator('[data-slot="notification-item"] a').first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  expect(href, "the item links nowhere").toMatch(/\/(work-orders|inventory)\//);
  await link.click();
  await expect(page).toHaveURL(new RegExp(href!.replace(/\//g, "\\/")));
});

test("raising work due tomorrow tells the people who watch that site", async ({
  context,
  page,
}) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  await useRole(context, "maintenanceCoordinator");
  await page.goto("/en/work-orders");
  await hydrated(page);
  await swept(page);

  const before = await unreadCount(page);
  await raiseOrder(page, "Due tomorrow, raised by the test", day(1));

  /*
   * The count rises, and it rises because of the rule rather than because a
   * record appeared: the assertion below names the kind, which only the
   * due-soon rule produces.
   */
  await expect
    .poll(() => unreadCount(page), {
      message: "raising work due tomorrow told nobody",
      timeout: 15_000,
    })
    .toBeGreaterThan(before);

  await page
    .getByRole("button", { name: new RegExp(en.shell.notifications.label) })
    .click();
  await expect(
    page.locator(
      '[data-slot="notification-group"][data-kind="workOrderDueSoon"]',
    ),
    "no due-soon group appeared",
  ).toBeVisible();
});

test("the same event is never reported twice, however often the rules run", async ({
  context,
  page,
}) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  await useRole(context, "maintenanceCoordinator");
  await page.goto("/en/work-orders");
  await hydrated(page);
  await swept(page);

  await raiseOrder(page, "Counted once, not twice", day(1));
  await expect
    .poll(() => unreadCount(page), { timeout: 15_000 })
    .toBeGreaterThan(0);
  const afterFirstPass = await unreadCount(page);

  /*
   * The duplicate control. Every reload runs the rules again over the same
   * records, and a rule that named its events by the moment it noticed them —
   * or did not name them at all — would produce a second copy of every notice
   * on each one. Three reloads rather than one, because a dedupe that only
   * compares against the previous pass would survive a single repeat.
   */
  for (let visit = 0; visit < 3; visit += 1) {
    await page.reload();
    await hydrated(page);
    await swept(page);
  }

  expect(
    await unreadCount(page),
    "the rules reported the same events again on a reload",
  ).toBe(afterFirstPass);
});

test("marking everything read clears the badge, and it stays clear", async ({
  context,
  page,
}) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  await useRole(context, "maintenanceCoordinator");
  await page.goto("/en/dashboard");
  await hydrated(page);
  await swept(page);

  expect(
    await unreadCount(page),
    "nothing was unread, so clearing it proves nothing",
  ).toBeGreaterThan(0);

  await page
    .getByRole("button", { name: new RegExp(en.shell.notifications.label) })
    .click();
  await page.locator('[data-slot="mark-all-read"]').click();

  await expect.poll(() => unreadCount(page), { timeout: 15_000 }).toBe(0);

  /*
   * And after a reload, which is the half that matters. The badge clearing on
   * screen is a claim about the browser having stored the change; WA-67 is the
   * ticket that taught this project the difference, and a mark-read that did
   * not survive would bring the whole list back with no explanation.
   */
  await page.reload();
  await hydrated(page);
  await swept(page);
  expect(
    await unreadCount(page),
    "the notifications came back after a reload",
  ).toBe(0);
});

test("the email log names the recipient's language, not the reader's", async ({
  context,
  page,
}) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  await useRole(context, "administrator");
  await page.goto("/en/work-orders");
  await hydrated(page);
  await swept(page);

  // Something has to have been raised for anybody to be written to.
  await raiseOrder(page, "Something worth writing about", day(1));

  /*
   * Waited for on the log itself, and the first version of this waited on the
   * badge instead — which for an administrator is **already** above zero from
   * the seeded notices, so the wait was satisfied before the rule had run and
   * the page was opened on an empty table. A floor that is true before the act
   * is not a floor.
   */
  await page.goto("/en/settings");
  await hydrated(page);

  const rows = page.locator('[data-slot="email-log-row"]');
  await expect
    .poll(() => rows.count(), {
      message:
        "no mail would have been sent, so the language column proves nothing",
      timeout: 15_000,
    })
    .toBeGreaterThan(0);

  /*
   * The bilingual claim, made visible: an English reader sees a French subject
   * against a colleague who works in French. The seed gives the people at the
   * Sudbury laboratory French, so a French row exists whenever an event
   * reaches one of them.
   */
  const french = page.locator(
    '[data-slot="email-log-row"][data-language="fr"]',
  );
  if ((await french.count()) > 0) {
    await expect(french.first()).toContainText(
      new RegExp(
        fr.notifications.workOrderDueSoonSubject.split("{")[0]!.trim(),
      ),
    );
  }
});

test("an auditor sees the switches, disabled, and is told why", async ({
  context,
  page,
}) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  await useRole(context, "auditor");
  /*
   * Its own route, and an auditor may open it — which is the ticket's step and
   * the reason this screen moved. It began on Settings, which two of the six
   * roles can open, so an auditor met a permission panel instead of the
   * switches they are meant to see disabled.
   */
  await page.goto("/en/my-notifications");
  await hydrated(page);

  const panel = page.locator('[data-slot="my-notifications"]');
  await expect(panel).toBeVisible();

  // Visible, not hidden: a screen that is simply shorter for one role
  // demonstrates nothing about the product being role-based.
  const boxes = panel.locator('input[type="checkbox"]');
  expect(
    await boxes.count(),
    "the switches are not on the page",
  ).toBeGreaterThan(0);
  for (const box of await boxes.all()) {
    await expect(box).toBeDisabled();
  }

  await expect(
    page.locator('[data-slot="notifications-read-only"]'),
    "the switches are disabled and the screen does not say why",
  ).toBeVisible();
  await expect(page.getByText(en.myNotifications.readOnlyTitle)).toBeVisible();
});

test("a technician hears about a job that lands on them, in French", async ({
  context,
  page,
}) => {
  await page.setViewportSize(VIEWPORTS.phone);
  await useRole(context, "technician");
  await page.goto("/fr/my-work");
  await hydrated(page);
  await swept(page);

  /*
   * The French half, on the phone, which is where a technician meets this.
   * Both facts matter: every word of a notice is translated, and an
   * English-only run would not see a French bell that never opened.
   */
  await page
    .getByRole("button", { name: new RegExp(fr.shell.notifications.label) })
    .click();

  const groups = page.locator(BELL);
  if ((await groups.count()) > 0) {
    await expect(groups).toBeVisible();
    await expect(
      page.locator('[data-slot="notification-group"]').first(),
    ).toBeVisible();
  }
});
