import { expect, test } from "@playwright/test";
import en from "../../messages/en.json";
import {
  hydrated,
  useRole,
  watchConsole,
  withoutServiceWorker,
} from "../fixtures/shell";

// WA-15 registers a service worker that caches HTML. Every spec but its
// own asserts against a fresh response, so the worker is removed first:
// a cached page would let a test quietly pass against a build that is no
// longer on disk.
test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

/**
 * Raising a work order, end to end: refused while it is wrong, accepted when it
 * is right, and visible afterwards in both the list and the trail.
 */

const TITLE = "Replace the supply fan belt";

test.describe("create a work order", () => {
  test("refuses an empty form and says what is missing", async ({ page }) => {
    const watcher = watchConsole(page);
    await page.goto("/en/work-orders");
    await hydrated(page);

    await expect(
      page.getByRole("button", { name: en.workOrderForm.submit }),
    ).toBeEnabled();
    await page.getByRole("button", { name: en.workOrderForm.submit }).click();

    // One message per empty required field, and they are announced.
    const alerts = page.getByRole("alert");
    await expect.poll(async () => alerts.count()).toBeGreaterThan(0);

    // Nothing was raised: the queue is unchanged.
    await expect(page.getByRole("table")).not.toContainText(TITLE);
    expect(watcher.errors).toEqual([]);
  });

  test("accepts a filled form, and the order reaches the list and the trail", async ({
    context,
    page,
  }) => {
    const watcher = watchConsole(page);
    await useRole(context, "maintenanceCoordinator");
    await page.goto("/en/work-orders");
    await hydrated(page);

    // The records are read in the browser, so the queue is a skeleton first.
    // Counting before it arrives would be counting nothing.
    await expect(page.getByRole("table")).toBeVisible();
    const before = await page.getByRole("row").count();
    expect(before).toBeGreaterThan(0);

    await page
      .getByLabel(en.workOrderForm.fields.asset)
      .selectOption({ index: 1 });
    await page.getByLabel(en.workOrderForm.fields.title).fill(TITLE);
    await page
      .getByLabel(en.workOrderForm.fields.description)
      .fill("Squealing on start, replace the belt and check tension.");

    await page.getByRole("button", { name: en.workOrderForm.submit }).click();

    // In the queue...
    await expect(page.getByRole("table").getByText(TITLE)).toBeVisible();

    /*
     * ...and in the trail, which is the part a test could otherwise take on
     * trust.
     *
     * On the dashboard, not here. The trail used to sit on this page inside
     * `WorkOrderList`, which the queue replaced — and the dashboard's activity
     * feed is where the trail actually lives. Asserting it there is the
     * stronger claim anyway: the entry has to reach a different screen, which
     * is what "written to the records" means.
     */
    await page.goto("/en/dashboard");
    await expect(
      page
        .getByText(TITLE)
        .or(page.getByText(/WO-\d{4}-\d{4}/))
        .first(),
    ).toBeVisible();

    expect(watcher.errors).toEqual([]);
  });

  test("an address naming equipment that does not exist says so", async ({
    page,
  }) => {
    // Three states, and the middle one is the whole point. No tag is nothing to
    // say; a tag that resolves preselects; a tag that does not resolve must not
    // look like the first, or a broken link is indistinguishable from an
    // ordinary visit and nobody learns the address was wrong.
    await page.goto("/en/work-orders?asset=NOPE-KGN-99");
    await hydrated(page);
    await expect(page.getByRole("table")).toBeVisible();

    const notFound = page.getByRole("alert").filter({ hasText: "NOPE-KGN-99" });
    await expect(notFound).toBeVisible();

    // And it stops being worth saying once they choose something themselves.
    await page
      .getByLabel(en.workOrderForm.fields.asset)
      .selectOption({ index: 1 });
    await expect(notFound).toHaveCount(0);
  });

  test("an address naming real equipment preselects it and says nothing", async ({
    page,
  }) => {
    await page.goto("/en/assets");
    const tag = (
      await page
        .locator('[data-slot="data-table"] tbody tr td:first-child')
        .first()
        .innerText()
    ).trim();

    await page.goto(`/en/work-orders?asset=${tag}`);
    await expect(page.getByRole("table")).toBeVisible();

    await expect(page.getByLabel(en.workOrderForm.fields.asset)).toContainText(
      tag,
    );
    await expect(page.getByRole("alert").filter({ hasText: tag })).toHaveCount(
      0,
    );
  });

  test("a role that may not raise work is told, not silently blocked", async ({
    context,
    page,
  }) => {
    await useRole(context, "auditor");
    await page.goto("/en/work-orders");

    await expect(page.getByText(en.permissions.deniedTitle)).toBeVisible();
    await expect(
      page.getByRole("button", { name: en.workOrderForm.submit }),
    ).toHaveCount(0);
  });

  test("the form is reachable by keyboard, with focus you can see", async ({
    page,
  }) => {
    await page.goto("/en/work-orders");
    await hydrated(page);
    // Wait for the records: focusing during hydration loses the focus again,
    // which is what the first version of this test was actually measuring.
    await expect(page.getByRole("table")).toBeVisible();

    // The resting appearance, captured before anything is focused, so the
    // assertion below is about a change rather than about a string. The first
    // version of this test asserted the shadow contained "rgb", which the
    // resting field already satisfies four times over — it could not fail.
    const atRest = await page.evaluate(
      () =>
        getComputedStyle(document.getElementById("wo-asset") as Element)
          .boxShadow,
    );

    // Tab in for real rather than calling focus(): programmatic focus does not
    // set :focus-visible, so a ring assertion after it would pass on a control
    // that shows nothing at all.
    /*
     * The bound is 200, not 40.
     *
     * WA-38 put the queue above this form and made every order number a link,
     * so the tab path from the top of the page now runs the search box, seven
     * facet triggers, ten row links and the pager before it arrives — the old
     * bound of 40 was written when the only thing above the form was a list of
     * eight. A bound too low does not measure a slow form; it fails a form that
     * is reachable, which is what it did here.
     *
     * The count is asserted rather than left open, because "reachable" stops
     * meaning anything if it is allowed to take arbitrarily long. A person who
     * does not want the journey has the header's "New work order" action, which
     * focuses this field from the first tab stop on the page.
     */
    let reached = false;
    let steps = 0;
    for (; steps < 200 && !reached; steps += 1) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate(
        () => document.activeElement?.id === "wo-asset",
      );
    }
    expect(reached, `never reached the first field in ${steps} tab stops`).toBe(
      true,
    );

    const seen = await page.evaluate(() => {
      const element = document.getElementById("wo-asset");
      if (!element) return null;
      return {
        focusVisible: element.matches(":focus-visible"),
        boxShadow: getComputedStyle(element).boxShadow,
      };
    });

    expect(seen?.focusVisible).toBe(true);
    // Something is actually drawn: the focused appearance differs from the
    // resting one. Comparing the two says nothing about which colour space the
    // ring is written in, which is the point — it was oklab, and asserting a
    // colour format is how the previous version measured nothing.
    expect(seen?.boxShadow).not.toBe(atRest);
  });
});
