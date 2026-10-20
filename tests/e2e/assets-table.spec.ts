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

// WA-15 registers a service worker that caches HTML. Every spec but its
// own asserts against a fresh response, so the worker is removed first:
// a cached page would let a test quietly pass against a build that is no
// longer on disk.
test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

/**
 * The assets table, used the way a person uses it.
 *
 * Every test asserts what the table held before it acted, so none of them can
 * pass on an empty table: "filtering narrowed the rows" means nothing if there
 * were no rows.
 */

async function rowCount(page: Page) {
  return page.locator('[data-slot="data-table"] tbody tr').count();
}

async function openAssets(page: Page) {
  await page.goto("/en/assets");
  await expect(page.locator('[data-slot="data-table"]')).toBeVisible();
  expect(await rowCount(page)).toBeGreaterThan(0);
}

/*
 * THIS BLOCK IS RED UNTIL WA-65'S LEVERS LAND, ON PURPOSE.
 *
 * Measured on `main` before any of them, the register does not fit at either
 * width in either language:
 *
 *              minContent   client   headroom
 *   en @1024       812        718       -94
 *   fr @1024       782        718       -64
 *   en @1440      1179       1134       -45
 *   fr @1440      1151       1134       -17
 *
 * The test is written first deliberately. A fix whose test arrives afterwards
 * is a fix nobody has watched fail, and this table has already been fixed once
 * for exactly this — `name` and `facilityName` carry caps added because "one
 * long cell was enough to shove Criticality and the row actions off the right
 * edge at 1440" — without anything measuring whether the caps were enough.
 * They were not, and nothing said so for as long as nobody looked.
 *
 * English is the worse language here, which is the reverse of the queue. An eye
 * trained on that screen would check French and find the mildest of the four.
 */
for (const locale of ["en", "fr"] as const)
  for (const [label, viewport] of [
    ["1024", VIEWPORTS.tablet],
    ["1440", VIEWPORTS.desktop],
  ] as const) {
    test(`at ${label} in ${locale} the assets register fits its container`, async ({
      context,
      page,
    }) => {
      await useRole(context, "maintenanceCoordinator");
      await page.setViewportSize(viewport);
      await page.goto(`/${locale}/assets`);
      await expect(page.getByRole("table")).toBeVisible();
      await hydrated(page);

      const fit = await measureTableFit(page);

      expectTableFits(fit, `at ${label} in ${locale}`);
    });
  }

test.describe("assets table", () => {
  test("draws a skeleton before the records have been read", async ({
    page,
  }) => {
    // The records are read in the browser, so there is always a first moment
    // where the answer is not yet known. It must not look like an empty table.
    await page.route("**/*", (route) => route.continue());
    await page.goto("/en/assets");
    await hydrated(page);
    const skeleton = page.locator('[data-slot="data-table-skeleton"]');
    // It may already be gone by the time we look, which is fine — what must
    // never appear is the "no assets yet" panel while the store is unread.
    await expect(page.locator('[data-slot="data-table"]')).toBeVisible();
    await expect(skeleton).toHaveCount(0);
  });

  test("search narrows the rows to the matching equipment", async ({
    page,
  }) => {
    const watcher = watchConsole(page);
    await openAssets(page);
    const before = await rowCount(page);

    await page
      .getByRole("searchbox", { name: en.assetsTable.searchLabel })
      .fill("GEN-");

    await expect.poll(async () => rowCount(page)).toBeLessThan(before);
    expect(await rowCount(page)).toBeGreaterThan(0);

    const tags = await page
      .locator('[data-slot="data-table"] tbody tr td:first-child')
      .allInnerTexts();
    expect(tags.every((tag) => tag.includes("GEN-"))).toBe(true);
    expect(watcher.errors).toEqual([]);
  });

  test("a facet filter narrows the rows, and clearing restores them", async ({
    page,
  }) => {
    /*
     * Asserted on the total the toolbar renders, not on the rows on screen.
     *
     * `rowCount` counts visible `tbody` rows and the table paginates at ten, so
     * before is 10 and filtering sixty assets down to fifty-one is still 10.
     * The previous version compared those two numbers with
     * `toBeLessThanOrEqual` and then `toBe` — both hold whether the facet
     * narrows anything or not, so a test named for narrowing measured nothing
     * about it.
     *
     * It was not vacuous only by luck: with `matchesFacet` broken the run still
     * reddened, but at the missing "Clear filters" button, which appears only
     * once something is filtered. A failure two steps away from the claim.
     *
     * The total moves — 60, then 51 of 60, then 60 — so it is what gets
     * asserted.
     */
    await openAssets(page);
    const total = page.locator('[data-slot="data-table-rows"]');
    const before = (await total.textContent())?.trim() ?? "";
    expect(before, "the row total is not on the screen").not.toBe("");

    // Scoped to the toolbar: "Status" is also a sortable column header, and a
    // locator matching two controls is a worse instrument than none.
    await page
      .locator('[data-slot="data-table-toolbar"]')
      .getByRole("button", { name: en.assetsTable.columns.status })
      .click();
    await page
      .getByRole("menuitemcheckbox", {
        name: new RegExp(en.assetStatus.active),
      })
      .click();
    await page.keyboard.press("Escape");

    // Narrowed: the toolbar says how many of how many, and it is fewer.
    await expect(total).toHaveText(/\d+/);
    const filtered = (await total.textContent())?.trim() ?? "";
    expect(
      filtered,
      `the total did not change when the facet was applied: still "${before}"`,
    ).not.toBe(before);
    const shown = Number(/(\d+)/.exec(filtered)?.[1]);
    const all = Number(/(\d+)/.exec(before)?.[1]);
    expect(Number.isFinite(shown) && Number.isFinite(all)).toBe(true);
    expect(shown, `${filtered} is not fewer than ${before}`).toBeLessThan(all);

    await page.getByRole("button", { name: en.dataTable.clearFilters }).click();
    await expect(total).toHaveText(before);
  });

  for (const locale of ["en", "fr"] as const) {
    test(`the site facet offers the cities, ${locale}`, async ({
      context,
      page,
    }) => {
      /*
       * The behaviour WA-65 changed, and nothing was asserting it.
       *
       * The facet test above uses Status, so the site facet — the one this
       * ticket moved from full site names to cities — had no test at all. A
       * change nobody asserts is a change the next person is free to undo.
       *
       * The options are read from the screen and checked against the seed's
       * cities rather than a list written here: a written list asserts the
       * fixture, and the question is what the control offers.
       */
      const messages = locale === "fr" ? fr : en;
      await useRole(context, "maintenanceCoordinator");
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.goto(`/${locale}/assets`);
      await expect(page.getByRole("table")).toBeVisible();
      await hydrated(page);

      const total = page.locator('[data-slot="data-table-rows"]');
      const before = (await total.textContent())?.trim() ?? "";

      await page
        .locator('[data-slot="data-table-toolbar"]')
        .getByRole("button", {
          name: messages.assetsTable.columns.facility,
          exact: true,
        })
        .click();

      const options = await page.getByRole("menuitemcheckbox").allInnerTexts();
      const offered = options.map((text) => text.trim()).filter(Boolean);

      const cities = [
        ...new Set(
          buildSeed(new Date()).facilities.map((facility) =>
            locale === "fr" ? facility.city.fr : facility.city.en,
          ),
        ),
      ];
      expect(cities.length, "the seed has no cities to offer").toBeGreaterThan(
        1,
      );

      for (const city of cities) {
        expect(
          offered.some((option) => option.includes(city)),
          `the site facet does not offer ${city}; it offers ${offered.join(", ")}`,
        ).toBe(true);
      }
      // And it offers the city rather than the site name it used to: the name
      // contains the city, so "offers the city" alone would pass on either.
      const aName = buildSeed(new Date()).facilities[0]!;
      const fullName = locale === "fr" ? aName.name.fr : aName.name.en;
      expect(
        offered.some((option) => option.includes(fullName)),
        `the site facet still offers the full name ${fullName}`,
      ).toBe(false);

      // Choosing one narrows the register.
      await page
        .getByRole("menuitemcheckbox", { name: new RegExp(cities[0]!) })
        .first()
        .click();
      await page.keyboard.press("Escape");
      await expect(total).not.toHaveText(before);
    });
  }

  test("sorting a column reorders the rows and says so", async ({ page }) => {
    await openAssets(page);
    const first = await page
      .locator('[data-slot="data-table"] tbody tr td:first-child')
      .first()
      .innerText();

    const header = page.getByRole("columnheader", {
      name: new RegExp(en.assetsTable.columns.assetTag),
    });
    await header.getByRole("button").click();

    await expect(header).toHaveAttribute("aria-sort", "ascending");
    await expect
      .poll(async () =>
        page
          .locator('[data-slot="data-table"] tbody tr td:first-child')
          .first()
          .innerText(),
      )
      .not.toBe(first);
  });

  test("the French table sorts in French, not in code points", async ({
    page,
  }) => {
    // The unit test proves the comparator. This proves it is reached: a
    // comparator nothing is wired to is a comparator that sorts nothing.
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/fr/assets");
    await hydrated(page);
    await expect(page.locator('[data-slot="data-table"]')).toBeVisible();

    await page
      .getByRole("columnheader", { name: /Équipement/ })
      .getByRole("button")
      .click();

    // Every page, not the first one. The accented words that tell French order
    // from code-point order are in the middle of the alphabet, and a single
    // page of A-to-C names cannot distinguish the two — the first version of
    // this test said so, which is what the guard below is for.
    const shown: string[] = [];
    const next = page.getByRole("button", { name: fr.dataTable.nextPage });

    for (let guard = 0; guard < 20; guard += 1) {
      shown.push(
        ...(
          await page
            .locator('[data-slot="data-table"] tbody tr td:nth-child(2)')
            .allInnerTexts()
        ).map((text) => text.trim()),
      );
      if (!(await next.isEnabled())) break;
      await next.click();
    }

    expect(shown.length).toBeGreaterThan(30);

    const french = [...shown].sort(new Intl.Collator("fr-CA").compare);
    const codePoints = [...shown].sort();

    // The guard that stops this passing on rows that cannot tell the two
    // apart: if French order and code-point order agree here, the assertion
    // below proves nothing.
    expect(
      french,
      "these rows cannot distinguish French order from code-point order",
    ).not.toEqual(codePoints);

    expect(shown).toEqual(french);
  });

  test("hiding a column removes it from every row", async ({ page }) => {
    await openAssets(page);
    const header = page.getByRole("columnheader", {
      name: new RegExp(en.assetsTable.columns.type),
    });
    await expect(header).toBeVisible();

    await page
      .locator('[data-slot="data-table-toolbar"]')
      .getByRole("button", { name: en.dataTable.columns })
      .click();
    await page
      .getByRole("menuitemcheckbox", {
        name: new RegExp(en.assetsTable.columns.type),
      })
      .click();
    await page.keyboard.press("Escape");

    await expect(header).toHaveCount(0);
  });

  test("pagination moves to a different set of rows", async ({ page }) => {
    await openAssets(page);
    const firstPage = await page
      .locator('[data-slot="data-table"] tbody tr td:first-child')
      .allInnerTexts();

    await page.getByRole("button", { name: en.dataTable.nextPage }).click();

    const secondPage = await page
      .locator('[data-slot="data-table"] tbody tr td:first-child')
      .allInnerTexts();

    expect(firstPage.length).toBeGreaterThan(0);
    expect(secondPage).not.toEqual(firstPage);
  });

  test("the table fits the width it is given at 1440", async ({ page }) => {
    // Looking at a screenshot caught this once; an assertion catches it every
    // time. A table wider than its container hides its right-hand columns —
    // criticality and the row actions — behind a scrollbar nobody looks for.
    await page.setViewportSize(VIEWPORTS.desktop);
    await openAssets(page);

    const overflow = await page
      .locator('[data-slot="data-table"]')
      .evaluate((element) => element.scrollWidth - element.clientWidth);

    expect(
      overflow,
      "the assets table overflows its container",
    ).toBeLessThanOrEqual(1);
  });

  test("the table becomes cards on a phone, with nothing overflowing", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto("/en/assets");

    await expect(page.locator('[data-slot="data-table-cards"]')).toBeVisible();
    await expect(page.locator('[data-slot="data-table"]')).toHaveCount(0);

    const overflows = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
    );
    expect(overflows).toBe(false);
  });

  test("a row action reaches the work-order form with the asset chosen", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await openAssets(page);

    const tag = await page
      .locator('[data-slot="data-table"] tbody tr td:first-child')
      .first()
      .innerText();

    await page
      .getByRole("button", { name: `Actions for ${tag.trim()}` })
      .click();
    await page
      .getByRole("menuitem", { name: en.assetsTable.actions.newWorkOrder })
      .click();

    await expect(page).toHaveURL(new RegExp(`asset=${tag.trim()}`));
    await expect(page.getByLabel(en.workOrderForm.fields.asset)).toContainText(
      tag.trim(),
    );
  });
});

/**
 * The second screen for WA-78.
 *
 * `CapabilityAction` is shared — seven call sites across six files — and the
 * defect it carries is the component's, not the work-order page's. One check
 * on a screen in another module is what makes that a measurement rather than
 * an assumption: the register's "add asset" button is gated by the same
 * component, and if the reason were reachable on one screen only, the fix
 * would be a call site's and not the component's.
 *
 * Deliberately not a copy of the full two-route test. That one belongs beside
 * the controls it covers in `work-order-write.spec.ts`; this asks the one
 * question that has to hold everywhere the component is used.
 */
test("the reason a control is unavailable is reachable by pointer on the assets register too", async ({
  context,
  page,
}) => {
  await useRole(context, "auditor");
  await openAssets(page);

  const add = page.getByRole("button", { name: en.actions.addAsset });
  await expect(add).toBeDisabled();

  const wrapper = page
    .locator('[data-slot="capability-action"]')
    .filter({ has: add });
  await wrapper.hover();

  await expect(page.getByRole("tooltip")).toHaveText(
    en.permissions.actionDenied.replace("{role}", en.roles.auditor.name),
  );
});
