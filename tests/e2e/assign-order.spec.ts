import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import { buildSeed } from "@/data/seed";
import { currentUserIdForRole } from "@/data/seed/people";
import {
  hydrated,
  useRole,
  watchConsole,
  withoutServiceWorker,
} from "../fixtures/shell";

/**
 * Handing a work order to somebody, and taking it back off them.
 *
 * The repository could always do this. Nothing rendered a control, so an order
 * could not change hands at all — WA-88 is that control, and these are the two
 * things it has to get right: the work arrives on the right person's list, and
 * when it moves again it *leaves* the first one. A test that only asserted the
 * arrival would pass on an implementation that gave the job to two people.
 */

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

const seed = buildSeed(new Date());

/** An order nobody is holding yet, so the first assignment is a first one. */
const UNASSIGNED = (() => {
  const assigned = new Set(
    seed.workOrderAssignments.map((assignment) => assignment.workOrderId),
  );
  const found = seed.workOrders.find(
    (order) => order.status === "open" && !assigned.has(order.id),
  );
  if (!found) throw new Error("The seed holds no open, unassigned work order");
  return found;
})();

/**
 * An open order a CREW holds, with nobody's name on it.
 *
 * The seed gives three of these to CONT01, one each at three of the five
 * sites, and they sit near the top of the queue — which is where a
 * demonstration clicks first. They are the
 * orders the contractor handover defect was found on, so they are the orders
 * it is tested on.
 */
const CREW_HELD = (() => {
  const assignment = seed.workOrderAssignments.find(
    (candidate) => candidate.userId === null && candidate.crewCode !== null,
  );
  if (!assignment) throw new Error("The seed holds no crew-only assignment");
  const order = seed.workOrders.find(
    (candidate) => candidate.id === assignment.workOrderId,
  );
  if (!order) throw new Error("A crew assignment names no work order");
  return { order, crewCode: assignment.crewCode as string };
})();

const TECHNICIAN = currentUserIdForRole("technician");
const INSPECTOR = currentUserIdForRole("inspector");

function personName(id: string) {
  const user = seed.users.find((candidate) => candidate.id === id);
  if (!user) throw new Error(`The seed holds no user ${id}`);
  return { full: `${user.firstName} ${user.lastName}`, last: user.lastName };
}

/**
 * How many rows the current role's own list is showing, including none.
 *
 * Two resolutions, not one. The list is only drawn when there is something in
 * it — an empty list is an empty state with no `my-work-rows` anywhere on the
 * screen — so waiting for the testid alone hangs for ten seconds and fails on
 * the perfectly ordinary case of a person holding no work. This waits for the
 * panel to have ANSWERED, either way, and then counts; absent means zero.
 *
 * The rows rather than the heading, for the usual reason: the screen draws its
 * heading before the store has answered.
 */
async function myWorkCount(page: Page) {
  await page.goto("/en/my-work");
  await hydrated(page);
  const list = page.getByTestId("my-work-rows");
  await expect(
    list.or(page.getByText(en.dashboard.myWork.emptyTitle)).first(),
  ).toBeVisible();
  return list.getByRole("listitem").count();
}

async function openOrder(page: Page, number: string) {
  await page.goto(`/en/work-orders/${number}`);
  await hydrated(page);
  await expect(page.locator('[data-slot="work-order-actions"]')).toBeVisible();
}

async function assignTo(page: Page, userId: string) {
  await page
    .getByRole("button", { name: en.workOrderDetail.write.actions.assign })
    .click();
  await expect(
    page.getByText(en.workOrderDetail.write.assign.description),
  ).toBeVisible();
  await page
    .getByLabel(en.workOrderDetail.write.assign.assignee)
    .selectOption(userId);
  await page
    .getByRole("button", { name: en.workOrderDetail.write.assign.submit })
    .click();

  /*
   * The helper asserts its own success, or it is not a helper.
   *
   * Without this a submit that refused — a validation message, a write that
   * did not reach the device — left the dialog open and the test walked on to
   * assert things about an assignment that never happened. It did: the second
   * call here silently did nothing and the failure surfaced ten lines later as
   * a missing sentence in the activity feed, which is a long way from the act
   * that failed.
   */
  await expect(
    page.getByRole("dialog"),
    "the assign dialog closed, so the assignment was accepted",
  ).toHaveCount(0);
}

test.describe("assigning a work order", () => {
  test("the work arrives on one list and leaves it when it moves", async ({
    context,
    page,
  }) => {
    const watcher = watchConsole(page);
    const technician = personName(TECHNICIAN);
    const inspector = personName(INSPECTOR);

    // What each list holds before anybody is given anything.
    await useRole(context, "technician");
    const technicianBefore = await myWorkCount(page);
    await useRole(context, "inspector");
    const inspectorBefore = await myWorkCount(page);

    // Give it to the technician.
    await useRole(context, "maintenanceCoordinator");
    await openOrder(page, UNASSIGNED.number);
    await assignTo(page, TECHNICIAN);

    await expect(
      page.getByRole("main").getByText(technician.full),
      "the order names the person now holding it",
    ).toBeVisible();
    await expect(
      page.getByText(en.workOrderStatus.assigned).first(),
      "assigning an open order moves it to Assigned",
    ).toBeVisible();

    await useRole(context, "technician");
    expect(
      await myWorkCount(page),
      "the work arrived on the technician's list",
    ).toBe(technicianBefore + 1);

    // Hand it to somebody else.
    await useRole(context, "maintenanceCoordinator");
    await openOrder(page, UNASSIGNED.number);
    await assignTo(page, INSPECTOR);

    /*
     * The trail says where it came from, on the screen that owns the trail.
     *
     * Not the order page: that draws a STATUS history — from Open to Assigned,
     * from Assigned to In progress — which is a different record and says
     * nothing about who held the work. Audit sentences surface in the
     * dashboard's activity feed, which is where this assertion was moved to
     * after looking for it on the order page and not finding it.
     */
    await page.goto("/en/dashboard");
    await hydrated(page);
    await expect(page.getByTestId("kpi-open")).toBeVisible();
    const feed = await page.locator('[data-slot="activity-feed"]').innerText();
    expect(
      feed,
      "the trail records the handover, naming both people",
    ).toContain(
      en.audit.workOrderReassigned
        .replace("{number}", UNASSIGNED.number)
        .replace("{from}", technician.last)
        .replace("{to}", inspector.last),
    );

    // Both lists moved, which is the assertion that matters: one person cannot
    // still be holding work another person was given.
    await useRole(context, "technician");
    expect(
      await myWorkCount(page),
      "the work left the technician's list when it was handed on",
    ).toBe(technicianBefore);

    await useRole(context, "inspector");
    expect(
      await myWorkCount(page),
      "the work arrived on the inspector's list",
    ).toBe(inspectorBefore + 1);

    expect(watcher.errors).toEqual([]);
  });

  /**
   * The walk the demonstration will actually do.
   *
   * An order held by a contractor crew, handed to a person. Before WA-88's
   * second pass this wrote "assigned to Mbeki" and CONT01 vanished from the
   * record — an absent value read as "nobody held it", on the orders nearest
   * the top of the queue.
   */
  test("handing a contractor's work to a person says where it came from", async ({
    context,
    page,
  }) => {
    const technician = personName(TECHNICIAN);

    await useRole(context, "maintenanceCoordinator");
    await openOrder(page, CREW_HELD.order.number);

    // The crew is who holds it, on the screen, before anything is done.
    await expect(
      page.getByRole("main").getByText(CREW_HELD.crewCode),
      "the order is held by a crew to begin with",
    ).toBeVisible();

    await assignTo(page, TECHNICIAN);

    await page.goto("/en/dashboard");
    await hydrated(page);
    await expect(page.getByTestId("kpi-open")).toBeVisible();
    const feed = await page.locator('[data-slot="activity-feed"]').innerText();
    expect(
      feed,
      "the trail names the crew the work came from, not just the person it went to",
    ).toContain(
      en.audit.workOrderReassignedFromCrew
        .replace("{number}", CREW_HELD.order.number)
        .replace("{crew}", CREW_HELD.crewCode)
        .replace("{to}", technician.last),
    );
  });

  test("a role that may not assign is told so rather than shown nothing", async ({
    context,
    page,
  }) => {
    const action = page.getByRole("button", {
      name: en.workOrderDetail.write.actions.assign,
    });

    await useRole(context, "auditor");
    await openOrder(page, UNASSIGNED.number);

    // Present and disabled, with the reason — the rule AGENTS.md states, and
    // the reason a demonstration shows a permission boundary rather than an
    // emptier screen.
    await expect(action).toBeDisabled();
    await page.locator('[data-slot="capability-action"]').first().focus();

    // And the positive half, on the same locator: a disabled control proves
    // nothing about permissions if the control is disabled for everybody.
    await useRole(context, "maintenanceCoordinator");
    await openOrder(page, UNASSIGNED.number);
    await expect(action).toBeEnabled();
  });
});
