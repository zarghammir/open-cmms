import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { buildSeed } from "@/data/seed";
import {
  hydrated,
  slowCpu,
  useRole,
  VIEWPORTS,
  watchConsole,
  withoutServiceWorker,
} from "../fixtures/shell";

/**
 * One order at a time, on a phone.
 *
 * What a technician does on this screen, at the width they do it: the checklist
 * first, controls big enough to hit, and the same repository writes the desk
 * uses. The dashboard half of WA-40's assertion is deliberately absent — see
 * the note on the last test.
 */

const seed = buildSeed(new Date());
const TARGET = 44;

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

function orderWith(status: string) {
  const found = seed.workOrders.find((order) => order.status === status);
  if (!found) throw new Error(`The seed holds no ${status} work order`);
  return found;
}

async function openOnPhone(page: Page, number: string, locale = "en") {
  // Off unless `WA_CPU_THROTTLE` is set. It is how the wait below was measured
  // and is the only way the control over it can go red on a fast machine.
  await slowCpu(page);
  await page.setViewportSize(VIEWPORTS.phone);
  await page.goto(`/${locale}/work-orders/${number}`);
  await hydrated(page);
  /*
   * And then the order's own controls, which are a different subtree.
   *
   * `hydrated` answers for `DemoBoot`, mounted once in the application layout.
   * The order is drawn behind this page's own `Suspense` boundary, and
   * `WorkOrderActions` returns null until `useRepositories` has handed it a
   * repository — so the layout marker reads "ready" in one subtree while the
   * bar does not yet exist in the other. Every `expect` and every action in
   * these tests would wait that moment out; `count()` is the one member of the
   * locator family that does not, and it reports the gap as zero controls.
   *
   * Waited for here rather than in the one test, because all five read the
   * order's body, and the bar is the latest of the markers available: it needs
   * the body rendered *and* the repositories bound, so it cannot be attached
   * before the panels the other tests measure.
   */
  await expect(page.locator('[data-slot="work-order-actions"]')).toBeVisible();
}

test.describe("one order at a time, at 390", () => {
  test("puts the checklist above the reading matter", async ({
    context,
    page,
  }) => {
    /*
     * A technician opens this to do the job, so the work comes first; the same
     * screen for a coordinator reads the record first. Asserted by comparing
     * positions on the screen rather than by looking for a class, because the
     * question is what somebody scrolls past, not how it was implemented.
     */
    await useRole(context, "technician");
    await openOnPhone(page, orderWith("inProgress").number);

    const tasks = await page
      .getByText(en.workOrderDetail.tasks.title, { exact: true })
      .first()
      .boundingBox();
    const description = await page
      .getByText(en.workOrderDetail.description.title, { exact: true })
      .first()
      .boundingBox();

    expect(tasks, "the tasks panel is not on the screen").not.toBeNull();
    expect(
      description,
      "the description panel is not on the screen",
    ).not.toBeNull();
    expect(
      tasks!.y,
      `the checklist is ${Math.round(tasks!.y - description!.y)}px below the description on a phone`,
    ).toBeLessThan(description!.y);
  });

  test("the same screen reads the record first for a coordinator", async ({
    context,
    page,
  }) => {
    // The control. Without it, "tasks first" would pass just as well if the
    // panels were in that order for everybody, and the by-view decision would
    // be doing nothing.
    await useRole(context, "maintenanceCoordinator");
    await openOnPhone(page, orderWith("inProgress").number);

    const tasks = (await page
      .getByText(en.workOrderDetail.tasks.title, { exact: true })
      .first()
      .boundingBox())!;
    const description = (await page
      .getByText(en.workOrderDetail.description.title, { exact: true })
      .first()
      .boundingBox())!;

    expect(description.y).toBeLessThan(tasks.y);
  });

  test("every control a thumb has to hit is at least 44px", async ({
    context,
    page,
  }) => {
    /*
     * Measured, not eyeballed, and measured on every control rather than on a
     * named one: a target added later is exactly the one nobody checks. The
     * failure names each control that is short and by how much, so a red says
     * what to fix.
     */
    await useRole(context, "technician");
    await openOnPhone(page, orderWith("inProgress").number);

    const controls = page.locator(
      '[data-slot="work-order-actions"] button, label:has(input[type="checkbox"])',
    );
    const count = await controls.count();
    // A floor under the measurement: zero controls would satisfy every
    // assertion below.
    expect(count, "no controls were found to measure").toBeGreaterThan(2);

    const short: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const box = await controls.nth(index).boundingBox();
      const name = (await controls.nth(index).textContent())?.trim() ?? "?";
      if (!box) continue;
      if (box.height < TARGET)
        short.push(`${name} ${Math.round(box.height)}px`);
    }
    expect(short, `controls under ${TARGET}px: ${short.join(", ")}`).toEqual(
      [],
    );
  });

  test("nothing scrolls sideways", async ({ context, page }) => {
    const watcher = watchConsole(page);
    await useRole(context, "technician");
    await openOnPhone(page, orderWith("inProgress").number);

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth - doc.clientWidth;
    });
    expect(
      overflow,
      `the page is ${overflow}px wider than the phone`,
    ).toBeLessThanOrEqual(1);
    expect(watcher.errors).toEqual([]);
  });

  test("reads as French", async ({ context, page }) => {
    await useRole(context, "technician");
    await openOnPhone(page, orderWith("inProgress").number, "fr");

    await expect(
      page.getByText(fr.workOrderDetail.tasks.title, { exact: true }).first(),
    ).toBeVisible();
  });
});

/*
 * WA-40's other half is written now, and it is not here.
 *
 * This block held an assertion — completing an order moves the dashboard's
 * numbers and this technician's own /my-work count — waiting on WA-67, because
 * it needs a role change, which is a full document load, which was where a
 * written record could be missing from the screen that reads it.
 *
 * WA-67 is merged. The assertion lives in `primary-flow.spec.ts`, inside the
 * whole story rather than on its own, because the numbers it checks are the
 * same numbers every other step of that flow moves.
 */
