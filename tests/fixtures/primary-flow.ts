import { expect, type BrowserContext, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { buildSeed } from "@/data/seed";
import { currentUserIdForRole } from "@/data/seed/people";
import { crossingAt, siteCodeOf } from "./crossable";
import {
  VIEWPORTS,
  hydrated,
  // Aliased: this file calls it from a plain helper rather than from a test
  // body, and `react-hooks/rules-of-hooks` reads any `use*` call inside a
  // function whose name is not a component or a hook as a misplaced React
  // hook. It is a cookie write, not a hook.
  useRole as setRole,
  watchConsole,
} from "./shell";

/**
 * One completion, moving every screen that should move.
 *
 * This is the sentence the bid makes, and until now nothing tested it. Every
 * other browser spec stays inside one module or two: the queue proves the
 * queue, the register proves the register. Each of them can be green while the
 * product contradicts itself, because "the dashboard counts what the work-order
 * page wrote" is not a claim any of them makes.
 *
 * So this walks the story a person walks — raise it from the equipment
 * register, assign it, pick it up on a phone as the technician, tick the
 * checklist, log the time, take a part out of stores, finish it with a note —
 * and after every step asserts the number or the row that step is supposed to
 * have moved, on the screen that owns it.
 *
 * **Every number is read from the screen before the flow starts and compared
 * to itself afterwards.** None is written down here. A test that hardcodes
 * "open work orders: 14" passes on the day it was written and fails on the
 * seed's next birthday, and the failure says nothing about propagation.
 *
 * Run twice, in English and in French. The second run is not decoration: the
 * numbers must be identical, so a French formatter that groups digits
 * differently, or a translation that changes a row's accessible name, shows up
 * here rather than in front of an evaluator.
 */

const seed = buildSeed(new Date());

/**
 * The part this flow will push below its minimum, chosen for the site the
 * order is raised at.
 *
 * The rule lives in `./crossable` because two things need it and they must not
 * drift: this fixture picks the part, and `tests/unit/issuable-site.test.ts`
 * says in advance whether any site the register can open on holds one.
 *
 * The issue dialog offers **this site's** stock and only what there is any of
 * (`parts.list(order.facilityId)`, `quantityOnHand > 0`), so a part picked
 * from the whole seed is usually not on the list — the first run timed out on
 * `selectOption` with "did not find some options", which is that filter.
 */
function crossingFor(facilityId: string) {
  const found = crossingAt(seed, facilityId);
  if (!found) {
    /*
     * The failure names the data, not the fixture.
     *
     * "No part above its minimum at facility fac-MCT" reads as a broken test
     * helper, and the next person spends their time in this file. It is
     * neither broken nor surprising: one site in the demonstration is
     * deliberately a store with nothing on the shelves, and the walkthrough
     * starts from whatever the equipment register puts on its first row. If
     * that row is at that site, the story cannot issue a part there — a fact
     * about the estate, which someone can act on by changing the estate or by
     * starting the story somewhere else.
     */
    const code = siteCodeOf(seed, facilityId) ?? facilityId;
    throw new Error(
      [
        `${code} holds no part that is above its minimum, so nothing issued there can cross one.`,
        "That is the seeded estate, not a broken fixture: one site is deliberately a store with no stock,",
        "and this walkthrough raises its order against whatever the equipment register lists first.",
        "tests/unit/issuable-site.test.ts asserts in advance that the register opens on a site that has stock;",
        "if it is green and this is not, the register's order has changed rather than the estate.",
      ].join(" "),
    );
  }
  return found;
}

/** The user the technician role is, so the assignment lands on their list. */
const TECHNICIAN = currentUserIdForRole("technician");

const TITLE = "Replace the supply fan belt";
const NOTE = "Belt replaced, tension checked, run under load.";

type Messages = typeof en;

async function readNumber(page: Page, testId: string): Promise<number> {
  const text = await page.getByTestId(testId).innerText();
  return Number.parseInt(text.replace(/\D/g, ""), 10);
}

/**
 * Both waits, every time, and they do different jobs.
 *
 * `hydrated` says the store has answered, so a click lands on a bound handler
 * rather than on server-rendered markup. The second wait is the page's own
 * element: the layout's marker is drawn by the shell and is true of a screen
 * that has not painted its panel yet, which is WA-59's family. A flow test
 * crosses eight screens, so waiting on the shell would be waiting on the same
 * thing eight times and proving nothing about any of them.
 */
async function onScreen(page: Page, own: string) {
  await hydrated(page);
  await expect(page.locator(own).first()).toBeVisible();
}

async function dashboardNumbers(page: Page, locale: string) {
  await page.goto(`/${locale}/dashboard`);
  await onScreen(page, '[data-testid="kpi-open"]');

  return {
    open: await readNumber(page, "kpi-open"),
    overdue: await readNumber(page, "kpi-overdue"),
    critical: await readNumber(page, "kpi-critical"),
    lowStock: await readNumber(page, "kpi-low-stock"),
    inspections: await readNumber(page, "kpi-inspections"),
    /*
     * What the feed SAYS, not how long it is.
     *
     * `recentActivity` slices to ACTIVITY_LIMIT — eight — so the list is full
     * on a seeded demonstration and a new event pushes an old one off the
     * bottom rather than making it longer. The first version of this test
     * asserted the count grew by one and failed 8 against 9, which was the
     * test being wrong rather than the product: a capped list cannot grow.
     */
    feed: await page.locator('[data-slot="activity-feed"]').innerText(),
  };
}

/** Called at the three moments worth photographing, when there is a camera. */
export type Shoot = (name: string) => Promise<void>;

export async function walkPrimaryFlow(
  page: Page,
  context: BrowserContext,
  locale: "en" | "fr",
  shoot: Shoot = async () => {},
  /**
   * Off only for the picture run, and the reason is worth keeping.
   *
   * `watchConsole` collects warnings as well as errors, deliberately. The
   * picture run waits for each toast to clear before the shutter, which leaves
   * a screen idle for several seconds — long enough for Chromium to warn that
   * a preloaded font was "not used within a few seconds from the window's load
   * event". Every existing spec is too quick to ever see it.
   *
   * So it is a real thing the application does on any page somebody actually
   * reads, and it is reported rather than filtered in the shared watcher,
   * where it would have been hidden from every other spec too. The flow spec
   * keeps the assertion; only the camera looks away.
   */
  assertConsole = true,
) {
  const m: Messages = locale === "fr" ? (fr as Messages) : en;
  const watcher = watchConsole(page);

  await page.setViewportSize(VIEWPORTS.desktop);
  // Asserted rather than assumed: a flow measured at the wrong width would
  // still pass every assertion below while testing a layout nobody uses.
  expect(page.viewportSize()).toEqual(VIEWPORTS.desktop);

  /*
   * Reset first, so the five numbers depend on the seed and nothing else.
   *
   * Every test gets its own browser context, so the records start fresh
   * anyway — but "anyway" is the word that stops being true the day someone
   * adds a fixture, a shared context, or a test that runs before this one.
   * The flow compares numbers to themselves, so a dirty start would not make
   * it fail; it would make it pass while measuring a different story. Resetting
   * costs one navigation and removes the whole question.
   *
   * As the administrator, because `demo.reset` is the administrator's alone —
   * the coordinator who walks the rest of this flow cannot reach the control.
   * The reset lands on the dashboard by itself, which is where the numbers are
   * read.
   */
  await setRole(context, "administrator");
  await page.goto(`/${locale}/settings`);
  await onScreen(page, "h1");
  await page.getByRole("button", { name: m.demo.reset }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: m.demo.confirmAction })
    .click();
  /*
   * The reset lands on the ENGLISH dashboard, in both runs, and that is the
   * product's decision rather than an accident.
   *
   * `demo-controls.tsx` calls `router.replace("/", { locale: defaultLocale })`
   * and clears the session cookies: "reset the demonstration" means back to
   * defaults, and the default language is one of them. The French run found
   * this by failing here, and it is left alone — a reviewer reading in French
   * who presses Reset does change language, which is worth the owner's
   * opinion, but it is not a propagation and not this test's to change.
   */
  await expect(page).toHaveURL(/\/en\/dashboard$/);
  await onScreen(page, '[data-testid="kpi-open"]');

  await setRole(context, "maintenanceCoordinator");

  // ── Before ──────────────────────────────────────────────────────────────
  const before = await dashboardNumbers(page, locale);
  expect(before.open).toBeGreaterThan(0);
  await shoot("dashboard-before");

  // ── Raise it, from the equipment register ───────────────────────────────
  await page.goto(`/${locale}/assets`);
  await onScreen(page, '[data-slot="data-table"] tbody tr');

  const tag = (
    await page
      .locator('[data-slot="data-table"] tbody tr td:first-child')
      .first()
      .innerText()
  ).trim();

  /*
   * The part is chosen for THIS asset's site, which is only knowable once the
   * register has told us which asset is on the first row.
   */
  const asset = seed.assets.find((candidate) => candidate.assetTag === tag);
  if (!asset) throw new Error(`The seed holds no asset ${tag}`);
  const CROSSING = crossingFor(asset.facilityId);

  await page
    .getByRole("button", {
      name: m.assetsTable.rowActions.replace("{tag}", tag),
    })
    .click();
  await page
    .getByRole("menuitem", { name: m.assetsTable.actions.newWorkOrder })
    .click();

  await expect(page).toHaveURL(new RegExp(`asset=${tag}`));
  await onScreen(page, "form[novalidate]");
  await expect(page.getByLabel(m.workOrderForm.fields.asset)).toContainText(
    tag,
  );

  /*
   * Assigned here, at creation, rather than afterwards — and not for
   * convenience.
   *
   * There is no way to assign an existing order in the product today. The
   * catalogue carries `workOrderDetail.write.actions.assign`, the repository
   * carries `assign(id, userId, actor)`, `roles.ts` carries the
   * `workOrder.assign` capability — and no component renders a control for any
   * of it. Measured by grep: `actions.assign` appears nowhere under
   * `src/components`. That is reported rather than built here; see the body.
   *
   * The form's own assignee field is a real path a coordinator uses, so the
   * story loses nothing. Selected by user id rather than by name: the option's
   * value is the id, which does not change when the interface is read in
   * French.
   */
  await page
    .getByLabel(m.workOrderForm.fields.assignee)
    .selectOption(TECHNICIAN);
  await page.getByLabel(m.workOrderForm.fields.title).fill(TITLE);
  await page
    .getByLabel(m.workOrderForm.fields.description)
    .fill("Squealing on start, replace the belt and check tension.");
  await page.getByRole("button", { name: m.workOrderForm.submit }).click();

  // The queue is where it lands, and the row is the assertion.
  await onScreen(page, '[data-slot="data-table"]');
  await expect(page.getByRole("table")).toContainText(TITLE);

  // ── Open it, and keep its number ────────────────────────────────────────
  // Before the dashboard, because the feed names the order by its number and
  // the number is only knowable once the record exists.
  /*
   * The row is found by its title; the LINK inside it is what opens it.
   *
   * The queue links a row by its work-order number, not by its title, so
   * `getByRole("link", { name: TITLE })` matches nothing — it timed out here
   * on the first run while `toContainText(TITLE)` on the table passed two
   * lines earlier, which is the pair that says "the text is there, the
   * accessible name is something else".
   */
  await page
    .getByRole("row")
    .filter({ hasText: TITLE })
    .getByRole("link")
    .first()
    .click();
  /*
   * Waiting for the ADDRESS to change, not for an `h1`.
   *
   * The queue has an `h1` of its own, so a wait for one is satisfied by the
   * page being left — WA-59's family exactly, and it cost a run here: the URL
   * still read `/work-orders` when the number was taken from it. A navigation
   * is proved by the address, and only then is the new screen's own element
   * worth waiting for.
   */
  await page.waitForURL(/\/work-orders\/WO-/);
  await onScreen(page, '[data-slot="work-order-actions"], h1');
  /*
   * The number comes from the address, not from the heading.
   *
   * A route names a record by the identifier people say out loud, so the URL
   * IS the number. The heading wraps it in words ("Work order WO-…"), and
   * those words are translated — reading it from the heading worked out to
   * "Work" on the first run, and would have needed different slicing per
   * language even once fixed.
   */
  const number = decodeURIComponent(
    new URL(page.url()).pathname.split("/").pop() ?? "",
  );
  expect(number).toMatch(/^WO-/);

  // The dashboard counted it, and the feed says so by name.
  const raised = await dashboardNumbers(page, locale);
  expect(raised.open, "raising a work order raises the open count").toBe(
    before.open + 1,
  );
  expect(
    raised.feed,
    "the raise reached the activity feed, named by its number",
  ).toContain(number);

  // ── The technician, on a phone ──────────────────────────────────────────
  await page.setViewportSize(VIEWPORTS.phone);
  expect(page.viewportSize()).toEqual(VIEWPORTS.phone);
  await setRole(context, "technician");

  await page.goto(`/${locale}/my-work`);
  await onScreen(page, '[data-testid="my-work-rows"]');
  const myWorkAfterAssign = await page
    .getByTestId("my-work-rows")
    .getByRole("listitem")
    .count();

  /*
   * The assertion `field-order.spec.ts` held for WA-67, written here at last.
   *
   * It needs a role change, which is a cookie change and therefore a full
   * document load — the path where a written record could be missing from the
   * screen that reads it. WA-67 fixed that; this is the test that says so.
   */
  await expect(
    page.getByTestId("my-work-rows").getByText(TITLE),
    "the order this flow raised is on the technician's list",
  ).toBeVisible();

  // Same shape on the technician's list: the row carries the title, the link
  // carries the number.
  await page
    .getByTestId("my-work-rows")
    .getByRole("listitem")
    .filter({ hasText: TITLE })
    .getByRole("link")
    .first()
    .click();
  await page.waitForURL(/\/work-orders\/WO-/);
  await onScreen(page, '[data-slot="work-order-actions"], h1');

  /*
   * Start it, and confirm.
   *
   * Starting is a `ConfirmDialog`, so the first click opens the dialog and the
   * second, on the button with the same name inside it, performs the act. The
   * consequence is asserted between the two: the screen says what pressing it
   * will do BEFORE it is pressed, which is the behaviour the dialog exists
   * for, and `.last()` is what distinguishes the dialog's button from the
   * trigger that is still on the page behind it.
   */
  await page
    .getByRole("button", { name: m.workOrderDetail.write.actions.start })
    .click();
  await expect(
    page.getByText(m.workOrderDetail.write.consequence.start),
  ).toBeVisible();
  await page
    .getByRole("button", { name: m.workOrderDetail.write.actions.start })
    .last()
    .click();
  await expect(
    page.getByText(m.workOrderStatus.inProgress).first(),
  ).toBeVisible();

  /*
   * Tick the checklist — and say plainly that today there is nothing to tick.
   *
   * An order raised from the register carries no tasks: checklists come from
   * preventive-maintenance plans, so a newly raised corrective order has an
   * empty Tasks panel. The screenshot shows it saying "No tasks were listed on
   * this order."
   *
   * The count is asserted rather than left implicit. A silent `for` over zero
   * boxes is a step that looks tested and is not — the shape this project has
   * been bitten by often enough to name. When plan-generated orders enter this
   * flow the count changes, this assertion fails, and whoever is here then is
   * told to tick them rather than discovering the gap later.
   */
  const boxes = page.getByRole("checkbox");
  const tasks = await boxes.count();
  expect(
    tasks,
    "a newly raised order has no checklist; if this changed, tick them here",
  ).toBe(0);

  // ── Take a part out of stores, and cross its minimum ────────────────────
  await page
    .getByRole("button", { name: m.workOrderDetail.write.issuePart.action })
    .click();
  await page
    .getByLabel(m.workOrderDetail.write.issuePart.part)
    .selectOption(CROSSING.part.id);
  await page
    .getByLabel(m.workOrderDetail.write.issuePart.quantity)
    .fill(String(CROSSING.issue));
  await page
    .getByRole("button", { name: m.workOrderDetail.write.issuePart.submit })
    .click();

  await expect(page.getByText(m.workOrderDetail.parts.none)).toHaveCount(0);
  await expect(page.getByText(CROSSING.part.partNumber).first()).toBeVisible();

  // ── Log the time and finish it ──────────────────────────────────────────
  await page
    .getByRole("button", { name: m.workOrderDetail.write.actions.complete })
    .click();
  await page.getByLabel(m.workOrderDetail.write.complete.minutes).fill("120");
  await page.getByLabel(m.workOrderDetail.write.complete.note).fill(NOTE);
  await page
    .getByRole("button", { name: m.workOrderDetail.write.complete.submit })
    .click();

  await expect(
    page.getByText(m.workOrderStatus.completed).first(),
  ).toBeVisible();
  /*
   * Scoped to the page, not the whole document, because the toast says the
   * same words.
   *
   * Completing raises a toast reading "WO-… terminé, 120 min consignées." and
   * the labour panel reads "120 min". Unscoped, `getByText("120 min")` matches
   * both and Playwright refuses on strict mode. It passed three times in
   * isolation and failed only in the full suite, which is the tell: under
   * parallel load the toast was still on screen when the assertion ran, so
   * this was a race the isolated runs could not show.
   *
   * The toaster is a portal outside `main`, so asking the page's own content
   * removes the ambiguity rather than papering over it with `.first()`, which
   * would have depended on document order.
   */
  await shoot("trail-after-completion");

  const content = page.getByRole("main");
  await expect(content.getByText(NOTE)).toBeVisible();
  await expect(
    content.getByText(
      m.workOrderDetail.labour.total.replace("{minutes}", "120"),
    ),
  ).toBeVisible();

  /*
   * The trail, in order, on the screen that owns it.
   *
   * There is no separate audit screen in Phase 1: the order's own history
   * panel is the ordered record of what happened to it, and the dashboard's
   * activity feed is the organisation-wide one. Both are asserted, because
   * they are written by different code and either can be right alone.
   */
  const trail = page
    .getByRole("listitem")
    .filter({ hasText: m.workOrderStatus.completed });
  await expect(trail.first()).toBeVisible();

  // ── Verify, back at the desk ────────────────────────────────────────────
  await page.setViewportSize(VIEWPORTS.desktop);
  await setRole(context, "maintenanceCoordinator");

  const after = await dashboardNumbers(page, locale);
  expect(after.open, "completing the order lowers the open count").toBe(
    raised.open - 1,
  );
  expect(
    after.lowStock,
    "issuing the part pushed it below its minimum, which the dashboard counts",
  ).toBe(before.lowStock + 1);
  expect(
    after.feed,
    "the completion reached the activity feed, with the time logged",
  ).toContain(
    m.audit.workOrderCompleted
      .replace("{number}", number)
      .replace("{minutes}", "120"),
  );

  await shoot("dashboard-after");

  // The part's own screen agrees with the dashboard's number.
  await page.goto(`/${locale}/inventory/${CROSSING.part.partNumber}`);
  await onScreen(page, "h1");
  await expect(
    page
      .getByText(String(CROSSING.part.quantityOnHand - CROSSING.issue), {
        exact: false,
      })
      .first(),
    "the part's on-hand fell by what was issued",
  ).toBeVisible();

  // The equipment's own history carries the completed order.
  await page.goto(`/${locale}/assets/${tag}?tab=history`);
  await onScreen(page, "h1");
  await expect(
    page.getByText(TITLE).first(),
    "the completed order is in the equipment's history",
  ).toBeVisible();

  // And the technician's list is shorter than it was.
  await setRole(context, "technician");
  await page.goto(`/${locale}/my-work`);
  /*
   * The ROWS, not the heading — WA-59's family one more time, in this file.
   *
   * This waited on `h1`, which the my-work screen draws before the store has
   * answered, so the count was read against a list that had not rendered. It
   * passed every fast run and failed the slower picture run with 0 against 2:
   * a race that only loses when something else on the page takes longer. The
   * earlier count in this same walk already waited on the rows, which is what
   * made the inconsistency visible once it failed.
   */
  await onScreen(page, '[data-testid="my-work-rows"]');
  const myWorkAtEnd = await page
    .getByTestId("my-work-rows")
    .getByRole("listitem")
    .count();
  expect(myWorkAtEnd, "a completed order leaves the technician's list").toBe(
    myWorkAfterAssign - 1,
  );

  if (assertConsole) {
    expect(watcher.errors, "no console errors anywhere in the flow").toEqual(
      [],
    );
  }
}
