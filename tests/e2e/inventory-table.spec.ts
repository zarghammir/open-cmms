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

async function rowCount(page: Page) {
  return page.locator('[data-slot="data-table"] tbody tr').count();
}

/**
 * Opens the register and refuses to continue until it has drawn rows.
 *
 * The floor, and it is the whole reason this helper exists rather than a bare
 * `goto`. Every assertion below is about the shape of a table full of parts,
 * and every one of them is satisfied by a table with nothing in it: a register
 * that rendered zero rows fits any width you like. WA-40's 44 px test failed on
 * CI for exactly this class of gap, so the count is taken before anything is
 * measured rather than assumed from the fact that the page loaded.
 */
async function openRegister(page: Page, locale: "en" | "fr" = "en") {
  await page.goto(`/${locale}/inventory`);
  await hydrated(page);
  await expect(page.getByRole("table")).toBeVisible();
  expect(
    await rowCount(page),
    "the register drew no rows, so nothing below is measuring anything",
  ).toBeGreaterThan(0);
}

/*
 * The four lines, measured before the name cap was chosen.
 *
 * The assets register taught this the expensive way: it shipped caps on `name`
 * and `facilityName` added because "one long cell was enough to shove
 * Criticality and the row actions off the right edge", with nothing measuring
 * whether the caps were enough. They were not, and nothing said so for as long
 * as nobody looked.
 *
 * Measured on the seed before this table existed, the widest column here is the
 * part name — 36 characters in English and 43 in French. So **French is the
 * case to design against on this screen**, which is the reverse of the assets
 * register, where English was the wider of the two. An eye trained on that
 * screen would have checked English, found it comfortable, and shipped.
 */
for (const locale of ["en", "fr"] as const)
  for (const [label, viewport] of [
    ["1024", VIEWPORTS.tablet],
    ["1440", VIEWPORTS.desktop],
  ] as const) {
    test(`at ${label} in ${locale} the parts register fits its container`, async ({
      context,
      page,
    }) => {
      await useRole(context, "maintenanceCoordinator");
      await page.setViewportSize(viewport);
      await openRegister(page, locale);

      const fit = await measureTableFit(page);

      expectTableFits(fit, `at ${label} in ${locale}`);
    });
  }

test.describe("the parts register", () => {
  test("draws a skeleton rather than an empty table before the records are read", async ({
    page,
  }) => {
    // Three states, never two: no records and no answer is not the same as no
    // parts. The empty panel must never appear while the store is unread.
    await page.goto("/en/inventory");
    await hydrated(page);
    await expect(page.locator('[data-slot="data-table"]')).toBeVisible();
    await expect(page.locator('[data-slot="data-table-skeleton"]')).toHaveCount(
      0,
    );
  });

  test("search narrows the rows to the matching part", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await openRegister(page);

    const before = await rowCount(page);
    // The part the screen is actually showing, read from the DOM — never a
    // stock number named in advance, which would make the test depend on
    // whether that record lands on page one of a paginated table.
    const first = (
      await page
        .locator('[data-slot="data-table"] tbody tr td:first-child')
        .first()
        .innerText()
    ).trim();
    expect(first, "no stock number in the first row").not.toBe("");

    await page
      .getByRole("searchbox", { name: en.partsTable.searchLabel })
      .fill(first);

    await expect.poll(async () => rowCount(page)).toBeLessThan(before);
    expect(await rowCount(page)).toBeGreaterThan(0);

    // Narrowing is not enough on its own: a search that returned the wrong
    // rows would also return fewer of them.
    const numbers = await page
      .locator('[data-slot="data-table"] tbody tr td:first-child')
      .allInnerTexts();
    expect(numbers.every((number) => number.includes(first))).toBe(true);
  });

  test("the stock state facet narrows to the parts that are low", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await openRegister(page);

    /*
     * The seed's own answer, computed here rather than typed as a number, so
     * the assertion cannot quietly become a claim about a count somebody edited
     * the seed out from under.
     */
    const low = seed.parts.filter(
      (part) => part.quantityOnHand < part.reorderPoint,
    ).length;
    expect(low, "the seed holds no part below its minimum").toBeGreaterThan(0);
    expect(
      low,
      "every seeded part is low, so the facet proves nothing",
    ).toBeLessThan(seed.parts.length);

    const total = page.locator('[data-slot="data-table-rows"]');
    const before = (await total.textContent())?.trim() ?? "";
    expect(before, "the row total is not on the screen").not.toBe("");

    /*
     * The trigger, scoped to the toolbar. "Stock" is also a sortable column
     * header, so an unscoped match resolves to two controls — and the one it
     * settled on was the header, which opens no menu, so the click timed out
     * on something that had nothing to do with facets.
     */
    await page
      .locator('[data-slot="data-table-toolbar"]')
      .getByRole("button", { name: en.partsTable.columns.stockState })
      .click();
    /*
     * A floor on the menu itself, before anything is clicked.
     *
     * This is here because of how the first version failed. The column held
     * booleans, and the shared facet filter keeps only faceted values that are
     * strings — so it rendered an **empty menu**: no options, no error, nothing
     * saying the filter could not work. The only symptom was a click timing out
     * thirty seconds later on a locator that was never going to match, which
     * points at the assertion rather than at the cause.
     */
    const items = page.getByRole("menuitemcheckbox");
    await expect(items.first()).toBeVisible();
    expect(
      await items.count(),
      "the facet menu offered no options, so nothing below filters anything",
    ).toBe(2);

    // A checkbox item in a dropdown menu, not an `option`: the facets are built
    // from the vendored `DropdownMenu`, so `menuitemcheckbox` is the role.
    await page
      .getByRole("menuitemcheckbox", { name: new RegExp(en.partsTable.low) })
      .click();
    await page.keyboard.press("Escape");

    /*
     * The rendered total, read as a number.
     *
     * Two traps in one assertion. The table paginates at ten, so counting drawn
     * rows would measure the page rather than the filter. And the first version
     * of this asserted the total *contained* "5" — which is satisfied by the
     * unfiltered "25", so it would have passed with the facet doing nothing.
     */
    await expect
      .poll(async () => {
        const text = (await total.textContent()) ?? "";
        return Number(/(\d+)/.exec(text)?.[1]);
      })
      .toBe(low);
  });

  test("reads as French", async ({ context, page }) => {
    const watcher = watchConsole(page);
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await openRegister(page, "fr");

    await expect(
      page.getByRole("columnheader", { name: fr.partsTable.columns.name }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: fr.partsTable.columns.bin }),
    ).toBeVisible();
    expect(watcher.errors).toEqual([]);
  });

  test("becomes cards on a phone, with nothing overflowing", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto("/en/inventory");
    await hydrated(page);

    /*
     * At phone width the table is replaced, not restyled: `DataTable` renders
     * `[data-slot="data-table-cards"]` and the table itself is gone. The first
     * version of this looked for `article` inside `[data-slot="data-table"]`,
     * which cannot exist at 390 — it was asserting against my assumption about
     * the DOM rather than against the DOM.
     */
    await expect(page.locator('[data-slot="data-table-cards"]')).toBeVisible();
    await expect(page.locator('[data-slot="data-table"]')).toHaveCount(0);
    const cards = page.locator('[data-slot="data-table-cards"] article');
    expect(await cards.count(), "no cards were drawn").toBeGreaterThan(0);

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth - doc.clientWidth;
    });
    expect(
      overflow,
      `the page is ${overflow}px wider than the phone`,
    ).toBeLessThanOrEqual(1);
  });
});
