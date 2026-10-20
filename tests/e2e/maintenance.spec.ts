import { expect, test, type Page } from "@playwright/test";
import { buildSeed } from "@/data/seed";
import { expectTableFits, measureTableFit } from "../fixtures/table-fit";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
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

const seed = buildSeed(new Date());

/**
 * How many work orders the queue holds, read from the total it renders.
 *
 * Through the screen rather than the store, because the claim is that a planner
 * pressing the button ends up with that many orders — and a count taken from
 * the records would pass on a sweep whose writes never reached a screen.
 */
/**
 * How many work orders the queue holds, read from the total it renders.
 *
 * **Navigated through the application, never with `goto`.** A `goto` is a full
 * document load, which rehydrates the store from IndexedDB and therefore races
 * the write that has just been made: this test passed on its own and failed in
 * a parallel run, reading the pre-sweep total because persistence had not
 * caught up. WA-67 has the same shape and the same fix — a click on the
 * sidebar keeps the store in memory, which is also what a planner does after
 * pressing the button.
 *
 * Through the screen rather than the records, because the claim is that a
 * person ends up with that many orders, and a count taken from the store would
 * pass on a sweep whose writes never reached one.
 */
async function ordersInQueue(page: Page) {
  await page
    .getByRole("navigation")
    .getByRole("link", { name: en.modules.workOrders.title })
    .click();
  await hydrated(page);
  // The queue draws its own "{shown} of {total}" rather than the shared
  // toolbar's row count, so this reads that line by its shape — no test seam
  // added to a file this pull request has no other business in.
  const total = page.getByText(/^\d+ of \d+$/).first();
  await expect(total).toBeVisible();
  const text = (await total.innerText()).trim();
  const held = Number(/of (\d+)/.exec(text)?.[1]);
  expect(Number.isFinite(held), `could not read a total from "${text}"`).toBe(
    true,
  );
  return held;
}

async function rowCount(page: Page) {
  return page.locator('[data-slot="data-table"] tbody tr').count();
}

/**
 * Opens the module and refuses to go on until a table has rows.
 *
 * The floor, and the reason it is a helper rather than a line in each test:
 * every assertion in this file is about the shape of a table full of visits or
 * plans, and every one of them is satisfied by a table with nothing in it. A
 * register that rendered zero rows fits any width you like.
 */
async function openModule(
  page: Page,
  locale: "en" | "fr" = "en",
  view?: string,
) {
  await page.goto(`/${locale}/preventive-maintenance`);
  await hydrated(page);
  if (view) {
    await page
      .locator('[data-slot="maintenance-views"]')
      .getByRole("radio", { name: view })
      .click();
  }
}

async function openTable(
  page: Page,
  locale: "en" | "fr" = "en",
  view?: string,
) {
  await openModule(page, locale, view);
  await expect(page.getByRole("table")).toBeVisible();
  expect(
    await rowCount(page),
    "the table drew no rows, so nothing below is measuring anything",
  ).toBeGreaterThan(0);
}

/*
 * The eight lines: two tables, two widths, two languages.
 *
 * Measured before any cap was chosen. The visits table carries **two** columns
 * over fifty characters — the asset's name and the plan's, 47 and 44 in English
 * against 57 and 58 in French — where the assets register overflowed at nine
 * columns with one. The plans table carries one.
 *
 * The caps in both screens are written as placeholders until these numbers say
 * what they should be, which is the WA-12 lesson: a cap chosen first and
 * measured afterwards is a cap nobody has checked.
 */
for (const locale of ["en", "fr"] as const) {
  for (const [label, viewport] of [
    ["1024", VIEWPORTS.tablet],
    ["1440", VIEWPORTS.desktop],
  ] as const) {
    test(`at ${label} in ${locale} the planned visits fit their container`, async ({
      context,
      page,
    }) => {
      await useRole(context, "maintenanceCoordinator");
      await page.setViewportSize(viewport);
      await openTable(page, locale);

      expectTableFits(
        await measureTableFit(page),
        `visits at ${label} in ${locale}`,
      );
    });

    test(`at ${label} in ${locale} the plans register fits its container`, async ({
      context,
      page,
    }) => {
      await useRole(context, "maintenanceCoordinator");
      await page.setViewportSize(viewport);
      const views = locale === "en" ? en.maintenanceViews : fr.maintenanceViews;
      await openTable(page, locale, views.plans);

      expectTableFits(
        await measureTableFit(page),
        `plans at ${label} in ${locale}`,
      );
    });
  }
}

test.describe("the planned visits", () => {
  test("draws a skeleton rather than an empty table before the records are read", async ({
    context,
    page,
  }) => {
    // Three states, never two: no records and no answer is not the same as no
    // planned maintenance.
    await useRole(context, "maintenanceCoordinator");
    await openModule(page);
    await expect(page.locator('[data-slot="data-table"]')).toBeVisible();
    await expect(page.locator('[data-slot="data-table-skeleton"]')).toHaveCount(
      0,
    );
  });

  test("says how many visits could not be read, and says nothing when none", async ({
    context,
    page,
  }) => {
    /*
     * The positive half. The seed resolves every visit, so this line must be
     * **absent** — a screen that always announced a count would be reassuring
     * about a number it never checked. The negative half lives in the
     * selector's unit tests, which plant a missing plan and a missing asset;
     * planting one through the browser would mean writing to the store from a
     * test, which is the shape this product keeps out of its specs.
     */
    await useRole(context, "maintenanceCoordinator");
    await openTable(page);

    await expect(
      page.locator('[data-slot="schedules-unreadable"]'),
    ).toHaveCount(0);
  });

  test("search narrows to the matching visits", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await openTable(page);

    const before = await rowCount(page);
    // The tag the screen is actually showing, read from the DOM — never one
    // named in advance, which makes the test depend on pagination.
    const first = (
      await page
        .locator('[data-slot="data-table"] tbody tr td:first-child')
        .first()
        .innerText()
    ).trim();
    expect(first, "no asset tag in the first row").not.toBe("");

    await page
      .getByRole("searchbox", { name: en.maintenanceTable.searchLabel })
      .fill(first);

    await expect.poll(async () => rowCount(page)).toBeLessThan(before);
    const tags = await page
      .locator('[data-slot="data-table"] tbody tr td:first-child')
      .allInnerTexts();
    expect(tags.length).toBeGreaterThan(0);
    expect(tags.every((tag) => tag.includes(first))).toBe(true);
  });

  test("the site facet narrows to one laboratory", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await openTable(page);

    const total = page.locator('[data-slot="data-table-rows"]');
    const before = (await total.textContent())?.trim() ?? "";
    expect(before, "the row total is not on the screen").not.toBe("");

    // Scoped to the toolbar: the column header carries a sort button with the
    // same label, and a locator matching two controls is worse than none.
    await page
      .locator('[data-slot="data-table-toolbar"]')
      .getByRole("button", { name: en.maintenanceTable.columns.site })
      .click();
    const options = page.getByRole("menuitemcheckbox");
    await expect(options.first()).toBeVisible();
    expect(
      await options.count(),
      "the site facet offered no options",
    ).toBeGreaterThan(1);
    await options.first().click();
    await page.keyboard.press("Escape");

    // The rendered total, not the page size — this table paginates.
    await expect
      .poll(async () => {
        const text = (await total.textContent()) ?? "";
        return Number(/(\d+)/.exec(text)?.[1]);
      })
      .toBeLessThan(Number(/(\d+)/.exec(before)?.[1]));
  });

  test("running the due visits raises one order for every one of them", async ({
    context,
    page,
  }) => {
    /*
     * **The feature's main action, which eighteen specs never pressed.**
     *
     * Review clicked it on a clean build and the count went 13 to 12, then 12
     * to 11: one order per click, twelve silently not raised, nothing on
     * screen. The repository context in the browser was a snapshot of one
     * render, React does not re-render inside a click handler, so every
     * iteration after the first read the pre-sweep records and took the same
     * work order number. The second raise threw on the duplicate id, the
     * exception left `runDue` and the click handler, and the remaining twelve
     * were never attempted — so nothing was shown about them. They were not
     * refused: a refusal is named on screen, and the toast path is not broken.
     *
     * The unit test for the sweep could not see it: its harness hands the
     * repository a live getter, which the browser does not — `useRepositories`
     * still hands a snapshot of one render, which is WA-76 and is Platform's,
     * untouched by this branch. So the
     * assertion that matters here is the **count**, not that an order appeared.
     * One appearing is exactly what the defect produced.
     */
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);

    // The queue first: `ordersInQueue` navigates, so counting after opening
    // the module would leave the button on a page we are no longer on — which
    // is how the first version of this test failed, on its own sequencing
    // rather than on the feature.
    await openModule(page);
    const before = await ordersInQueue(page);

    await openTable(page);
    const runName = new RegExp(
      `^${en.maintenanceTable.actions.runDue.split("{")[0]}`,
    );
    const run = page.getByRole("button", { name: runName });
    await expect(run).toBeVisible();

    // How many the button says it will raise, read from the button itself.
    const due = Number(/(\d+)/.exec(await run.innerText())?.[1]);
    expect(due, "the button names no count").toBeGreaterThan(1);

    await run.click();

    /*
     * Waited for the screen the store draws, before anything navigates. The
     * button disappears because nothing is due once the orders exist, so this
     * is the store's own answer that the sweep finished — not a sleep, and not
     * a toast that appears before the writes land.
     */
    await expect(page.getByRole("button", { name: runName })).toHaveCount(0);

    // The confirmation names the count rather than saying "done".
    await expect(
      page.getByText(String(due), { exact: false }).first(),
    ).toBeVisible();

    // And the queue really holds that many more orders than it did. This is
    // the assertion the defect would have failed: it raised exactly one.
    expect(await ordersInQueue(page)).toBe(before + due);

    // Nothing is due any more, so the button is gone — the sweep did not leave
    // the other twelve behind for a second press.
    await expect(page.getByRole("button", { name: runName })).toHaveCount(0);
  });

  test("becomes cards on a phone, with nothing overflowing", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.phone);
    await openModule(page);

    await expect(page.locator('[data-slot="data-table-cards"]')).toBeVisible();
    await expect(page.locator('[data-slot="data-table"]')).toHaveCount(0);

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(
      overflow,
      `the page is ${overflow}px wider than the phone`,
    ).toBeLessThanOrEqual(1);
  });
});

test.describe("the month", () => {
  test("shows exactly the visits the seed puts in this month", async ({
    context,
    page,
  }) => {
    const watcher = watchConsole(page);
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await openModule(page, "en", en.maintenanceViews.month);

    await expect(page.locator('[data-slot="month-label"]')).not.toBeEmpty();

    /*
     * The seed's own answer, computed rather than described.
     *
     * `buildSeed` dates every visit as an offset from the day it is given —
     * `nextDueOn = today + random.int(-21, period)` — so the current month
     * always holds a known set, measured at 9 to 12 visits across 8 to 11 days
     * for every day tried, including month and year boundaries.
     *
     * An earlier version asserted "weeks if the seed has any, the empty line
     * otherwise". That could only go red when the view failed to render at all,
     * and would have passed a month showing the **wrong** visits — which is the
     * failure worth catching, since grouping by week is exactly where a
     * date lands in the wrong place.
     */
    const month = new Date().toISOString().slice(0, 7);
    const dueThisMonth = seed.maintenanceSchedules.filter((one) =>
      one.nextDueOn.startsWith(month),
    );
    const distinctDays = new Set(dueThisMonth.map((one) => one.nextDueOn));

    // The floor. If the seed ever stops filling the current month, this test
    // must fail rather than quietly assert nothing.
    expect(
      distinctDays.size,
      "the seed puts no visits in the current month, so nothing below measures anything",
    ).toBeGreaterThan(0);

    // One row per day that has visits, and no rows for days that do not.
    await expect(page.locator('[data-slot="month-day"]')).toHaveCount(
      distinctDays.size,
    );

    /*
     * And the right visits, not merely the right number. A named asset the seed
     * puts in this month must be on the screen — read from the seed rather than
     * hardcoded, so it cannot rot when the generator changes.
     */
    const expected = dueThisMonth[0]!;
    const asset = seed.assets.find((one) => one.id === expected.assetId)!;
    await expect(
      page
        .locator('[data-slot="month-weeks"]')
        .getByText(asset.assetTag, { exact: true })
        .first(),
    ).toBeVisible();

    expect(watcher.errors).toEqual([]);
  });

  test("moves month to month and comes back", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await openModule(page, "en", en.maintenanceViews.month);

    const label = page.locator('[data-slot="month-label"]');
    const start = (await label.textContent())?.trim() ?? "";
    expect(start, "the month is not named").not.toBe("");

    await page.getByRole("button", { name: en.maintenanceMonth.next }).click();
    await expect(label).not.toHaveText(start);

    await page
      .getByRole("button", { name: en.maintenanceMonth.previous })
      .click();
    await expect(label).toHaveText(start);
  });

  test("fits a phone without scrolling sideways", async ({ context, page }) => {
    // Not a table, so it gets its own check rather than a fit line: the month
    // is cards and headings all the way down.
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.phone);
    await openModule(page, "en", en.maintenanceViews.month);

    await expect(page.locator('[data-slot="month-label"]')).toBeVisible();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(
      overflow,
      `the month is ${overflow}px wider than the phone`,
    ).toBeLessThanOrEqual(1);
  });
});

test.describe("the plans", () => {
  /**
   * A column header by its label, anchored.
   *
   * Two things make the obvious locator wrong here. The header's accessible
   * name carries the sort button's text as well as the label — "Équipement
   * Trier selon cette colonne" — so an exact match on the label finds nothing.
   * And a substring match on "Équipement" also matches "Type d'équipement", so
   * it finds two and Playwright refuses.
   *
   * Anchoring only at the **start** is not enough either, which cost a picture
   * in the screenshot spec: English has "Equipment" and "Equipment type", and
   * `^Equipment` matches both. Both ends anchored, with the sort text optional
   * for headers that are not sortable.
   */
  const header = (label: string) => {
    const esc = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`^${esc(label)}(?: ${esc(fr.dataTable.sortBy)})?$`);
  };

  test("reads as French, with the frequency in words", async ({
    context,
    page,
  }) => {
    const watcher = watchConsole(page);
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await openTable(page, "fr", fr.maintenanceViews.plans);

    await expect(
      page.getByRole("columnheader", {
        name: header(fr.plansTable.columns.name),
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", {
        name: header(fr.plansTable.columns.onPlan),
      }),
    ).toBeVisible();

    /*
     * And the frequency the title of this test promises, which the first
     * version never checked — a name that claims more than the body performs
     * hides an untested path better than no test would.
     *
     * In words rather than a code: the seed uses quarterly plans, and "Chaque
     * trimestre" is the thing a French reader should see where an untranslated
     * screen would show "quarterly".
     */
    await expect(
      page.getByRole("columnheader", {
        name: header(fr.plansTable.columns.frequency),
      }),
    ).toBeVisible();
    await expect(
      page
        .locator('[data-slot="data-table"] tbody')
        .getByText(fr.scheduleFrequency.quarterly, { exact: true })
        .first(),
    ).toBeVisible();

    expect(watcher.errors).toEqual([]);
  });

  test("says no equipment rather than a nought", async ({ context, page }) => {
    /*
     * The positive half of the claim the plans table exists to make. Every
     * seeded plan has equipment, so the sentence must be **absent** — and the
     * count column must be showing real numbers rather than the word for all
     * of them, which is what a cell stuck on the empty branch would look like.
     */
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await openTable(page, "en", en.maintenanceViews.plans);

    await expect(
      page
        .locator('[data-slot="data-table"] tbody')
        .getByText(en.plansTable.noEquipment, { exact: true }),
    ).toHaveCount(0);

    // And the column is drawing counts, so the absence above means something.
    const counts = await page
      .locator('[data-slot="data-table"] tbody tr td')
      .allInnerTexts();
    expect(counts.some((text) => /^\d+$/.test(text.trim()))).toBe(true);
  });
});
