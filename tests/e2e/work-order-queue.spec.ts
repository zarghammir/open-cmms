import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { buildSeed } from "@/data/seed";
import { expectTableFits, measureTableFit } from "../fixtures/table-fit";
import { toIsoDate } from "@/data/seed/dates";
import {
  filterWorkOrderRows,
  workOrderRows,
} from "@/data/selectors/work-order-queue";
import { EMPTY_QUEUE_FILTER } from "@/components/work-orders/queue-params";
import { hasHorizontalOverflow, useRole, VIEWPORTS } from "../fixtures/shell";

/**
 * The work-order queue, in a real browser.
 *
 * Expected counts are computed from the same generator the browser seeds itself
 * with rather than typed in, so what is proved is that the screen agrees with
 * the records rather than that two numbers were written down together.
 */

const now = new Date();
const today = toIsoDate(now);
const seed = buildSeed(now);
const allRows = workOrderRows(seed, today, "en-CA");

async function openQueue(page: Page, query = "", locale = "en") {
  await page.goto(`/${locale}/work-orders${query}`);
  // The search box, not the table: a queue whose filters match nothing shows
  // the no-results panel and has no table at all, which is the case two of
  // these tests are about.
  await expect(
    page.getByRole("searchbox", {
      name:
        locale === "fr"
          ? fr.workOrderQueue.searchLabel
          : en.workOrderQueue.searchLabel,
    }),
  ).toBeVisible();
}

test.describe("the work-order queue", () => {
  test("opens on every order, with nothing narrowed", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await openQueue(page);

    // An untouched filter means no opinion, not "nothing matches".
    await expect(page.getByRole("row")).not.toHaveCount(1);
    expect(allRows.length).toBeGreaterThan(10);
    await expect(
      page.getByText(
        en.workOrderQueue.showing
          .replace("{shown}", String(allRows.length))
          .replace("{total}", String(allRows.length)),
      ),
    ).toBeVisible();
  });

  test("one facet narrows, and the address carries it", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await openQueue(page);

    await page
      .getByRole("button", {
        name: en.workOrderQueue.facets.filterBy.replace(
          "{facet}",
          en.workOrderQueue.columns.status,
        ),
      })
      .click();
    await page
      .getByRole("menuitemcheckbox", { name: en.workOrderStatus.open })
      .click();
    await page.keyboard.press("Escape");

    await expect(page).toHaveURL(/status=open/);

    const expected = filterWorkOrderRows(
      allRows,
      { ...EMPTY_QUEUE_FILTER, status: ["open"] },
      today,
    );
    expect(expected.length).toBeGreaterThan(0);
    expect(expected.length).toBeLessThan(allRows.length);
    await expect(
      page.getByText(
        en.workOrderQueue.showing
          .replace("{shown}", String(expected.length))
          .replace("{total}", String(allRows.length)),
      ),
    ).toBeVisible();
  });

  test("two facets compose, and survive a reload", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await openQueue(page, "?status=open,assigned&priority=critical");

    const expected = filterWorkOrderRows(
      allRows,
      {
        ...EMPTY_QUEUE_FILTER,
        status: ["open", "assigned"],
        priority: ["critical"],
      },
      today,
    );

    const showing = en.workOrderQueue.showing
      .replace("{shown}", String(expected.length))
      .replace("{total}", String(allRows.length));
    await expect(page.getByText(showing)).toBeVisible();

    await page.reload();
    await expect(page.getByText(showing)).toBeVisible();
  });

  test("an address nobody could have meant is dropped, not obeyed", async ({
    context,
    page,
  }) => {
    /*
     * The case the parser exists for. Someone edits an address by hand, or a
     * link outlives a rename: "no work orders match" and "that word is not a
     * status" are different answers, and an empty queue gives the wrong one.
     */
    await useRole(context, "maintenanceCoordinator");
    await openQueue(page, "?status=nonsense&due=someday&facility=fac-nowhere");

    await expect(
      page.getByText(
        en.workOrderQueue.showing
          .replace("{shown}", String(allRows.length))
          .replace("{total}", String(allRows.length)),
      ),
    ).toBeVisible();
  });

  test("a crew with nobody behind it is not shown as unassigned", async ({
    context,
    page,
  }) => {
    // Three answers, and the two that are easy to confuse are the ones checked.
    await useRole(context, "maintenanceCoordinator");
    await openQueue(page, "?assignee=crew");

    const crew = filterWorkOrderRows(
      allRows,
      { ...EMPTY_QUEUE_FILTER, assignee: "crew" },
      today,
    );
    expect(crew.length).toBeGreaterThan(0);

    await expect(
      page.getByText(
        en.workOrderQueue.showing
          .replace("{shown}", String(crew.length))
          .replace("{total}", String(allRows.length)),
      ),
    ).toBeVisible();
    // The code itself is on screen, not the word "Unassigned".
    await expect(page.getByText("CONT01").first()).toBeVisible();
    await expect(
      page.getByRole("cell", { name: en.workOrderQueue.unassigned }),
    ).toHaveCount(0);
  });

  test("overdue in the queue is the dashboard's overdue", async ({
    context,
    page,
  }) => {
    /*
     * Both come from `isOverdue`. If these two numbers ever differ, one screen
     * is lying to a reviewer and this is the line that says so.
     */
    await useRole(context, "maintenanceCoordinator");
    await page.goto("/en/dashboard");
    const onDashboard = Number.parseInt(
      (await page.getByTestId("kpi-overdue").innerText()).replace(/\D/g, ""),
      10,
    );

    await openQueue(page, "?due=overdue");
    const overdue = filterWorkOrderRows(
      allRows,
      { ...EMPTY_QUEUE_FILTER, due: "overdue" },
      today,
    );

    expect(overdue).toHaveLength(onDashboard);
    expect(onDashboard).toBeGreaterThan(0);
  });

  test("searches the number, the title and the tag, and not the description", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    const target = allRows[0]!;

    await openQueue(page, `?q=${encodeURIComponent(target.number)}`);
    await expect(
      page.getByText(
        en.workOrderQueue.showing
          .replace("{shown}", "1")
          .replace("{total}", String(allRows.length)),
      ),
    ).toBeVisible();

    /*
     * The deliberate exclusion, asserted rather than assumed — and the word
     * has to be absent from EVERY row, not just this one.
     *
     * This picked a word missing from the target's own title, which is not the
     * same claim: the queue searches every row's number, title and asset tag,
     * so a word that is absent here and present two rows down still returns a
     * match, and the test then fails while the product is behaving. WA-87's
     * new equipment made that collision real.
     *
     * Chosen from the target's description so the claim stays "this text is in
     * the description and the search does not reach it", and filtered against
     * the whole searchable surface so the claim is testable.
     */
    const order = seed.workOrders.find(
      (candidate) => candidate.id === target.id,
    )!;
    const searchable = allRows
      .map((row) => `${row.number} ${row.title} ${row.assetTag}`.toLowerCase())
      .join(" ");
    const bodyWord = order.description.en
      .split(/\s+/)
      .map((word) => word.replace(/[^\p{L}\p{N}-]/gu, ""))
      .find(
        (word) => word.length > 6 && !searchable.includes(word.toLowerCase()),
      );
    expect(
      bodyWord,
      "this order's description holds no word long enough to be unique to it; " +
        "the exclusion below cannot be tested with this record",
    ).toBeDefined();
    await openQueue(page, `?q=${encodeURIComponent(bodyWord!)}`);
    await expect(page.getByText(en.states.noResults.title)).toBeVisible();
  });

  test("clearing the filters empties the address", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await openQueue(page, "?status=open&priority=critical");

    await page
      .getByRole("button", { name: en.workOrderQueue.clearAll })
      .first()
      .click();

    await expect(page).toHaveURL(/\/en\/work-orders$/);
  });

  test("reads as French", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");
    await openQueue(page, "", "fr");

    await expect(
      page.getByRole("button", {
        name: fr.workOrderQueue.facets.filterBy.replace(
          "{facet}",
          fr.workOrderQueue.columns.status,
        ),
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: en.workOrderQueue.facets.filterBy.replace(
          "{facet}",
          en.workOrderQueue.columns.assignee,
        ),
      }),
    ).toHaveCount(0);
  });

  /*
   * One test per language, not one test looping both.
   *
   * Looped, the first failure ends the case and the second language is never
   * measured — so a run that reddens on English says nothing at all about
   * French, and the report reads as one failure when it may be two. That is
   * exactly what happened the first time this control was run. Two tests cost
   * one extra navigation and report independently.
   */
  for (const locale of ["en", "fr"] as const)
    for (const [label, viewport] of [
      ["1024", VIEWPORTS.tablet],
      ["1440", VIEWPORTS.desktop],
    ] as const) {
      test(`at ${label} in ${locale} the queue fits, rather than running off the screen`, async ({
        context,
        page,
      }) => {
        /*
         * What this measures, and why three obvious things do not work.
         *
         * There is not one box here, there is a chain of them. The page itself
         * never scrolls sideways, so `hasHorizontalOverflow` on the document
         * cannot see this at all. Inside it are **two** nested `overflow-x-auto`
         * containers: the outer `[data-slot="data-table"]`, which this file's own
         * border and radius belong to, and shadcn's `[data-slot="table-container"]`
         * which `<Table>` renders around the `<table>` itself.
         *
         * The inner one is the box that actually clips. It is `w-full`, so it
         * measures 718 whatever the table does — which is exactly why the outer
         * wrapper read `scrollWidth === clientWidth === 718` in **both** states
         * and the first version of this test could not fail. A quantity that is
         * the same when the defect is present and when it is gone is not a
         * measurement, however precise it looks.
         *
         * So: the table's right edge against the box that is supposed to contain
         * it, and the inner container's own overflow. Not the viewport — the Due
         * column is clipped at the container's edge near 1000, and clearing 1024
         * by a single pixel of shell padding is a coincidence that a two-pixel
         * change to that padding would turn green with the bug fully present.
         * `window.innerWidth` is worse still: in Chromium it includes the
         * vertical scrollbar, so it hands the assertion about fifteen pixels of
         * slack, always in the direction of a false pass.
         *
         * Both languages, because French is the longer of the two almost
         * everywhere — "Laboratoire régional de Moncton" against "Moncton
         * Regional Laboratory" — so a width that fits in English is not evidence
         * about the demonstration an evaluator may read in French.
         */
        await useRole(context, "maintenanceCoordinator");
        await page.setViewportSize(viewport);
        await openQueue(page, "", locale);
        await expect(page.getByRole("table")).toBeVisible();

        const messages = locale === "fr" ? fr : en;
        const due = page.getByRole("columnheader", {
          name: new RegExp(messages.workOrderQueue.columns.due),
        });
        // Beside the edges, not instead of them: "nothing overflows" is
        // satisfied perfectly by a table with no columns in it.
        await expect(due).toBeVisible();

        const fit = await measureTableFit(page);
        // The one thing the shared measurement does not cover: the last
        // column's own edge. "The table fits" is about the table; this is the
        // complaint in the words a person would use — the due date runs off
        // the screen — and it is measured against the box that clips it rather
        // than the viewport, so the margin is the distance the defect creates
        // and not a pixel of shell padding.
        const dueRight = await due.evaluate(
          (header) => header.getBoundingClientRect().right,
        );

        expectTableFits(fit, `at ${label} in ${locale}`);

        expect
          .soft(
            dueRight,
            `at ${label} in ${locale} the due column is clipped: its right edge is ${dueRight}, its container ends at ${fit.innerRight}`,
          )
          .toBeLessThanOrEqual(fit.innerRight + 1);
      });
    }

  test("sorts the site column by what it shows, in French", async ({
    context,
    page,
  }) => {
    /*
     * The column shows the city and used to sort by the site name. English
     * hides that — every English name begins with its city — so this is
     * asserted in **French**, where four names are "Laboratoire régional de …"
     * and one is "Laboratoire central d'Kingston": sorted by name the column read
     * Kingston, Regina, Kamloops, Sudbury, Moncton, which is sorted
     * and indistinguishable from unsorted to the person reading it.
     *
     * Read from the screen rather than compared against a list written here: a
     * list would assert the seed, and what is in question is the order of what
     * is drawn.
     */
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await openQueue(page, "", "fr");
    // The button inside the header, not the header. The header is a `th` that
    // contains the sort control; clicking the cell itself does nothing, which
    // is how the first version of this test read an unsorted column and called
    // it sorted order.
    await page
      .getByRole("columnheader", {
        name: new RegExp(fr.workOrderQueue.columns.facility),
      })
      .getByRole("button")
      .click();

    const shown = await page
      .locator("tbody tr td:nth-last-child(1)")
      .allInnerTexts();
    const cities = shown.map((text) => text.trim()).filter(Boolean);
    expect(cities.length, "no site cells were read").toBeGreaterThan(2);

    /*
     * The first city on the page, not the shape of the page.
     *
     * Comparing the column against its own sorted copy is not enough, and the
     * control proved it: sorting by *name* groups the rows by name, so the
     * first page can hold a single city — and one city repeated ten times is
     * alphabetical whatever produced it. This test passed with the fix fully
     * reverted until this assertion was added.
     *
     * Ordering by city puts Regina first; ordering by name puts Kingston first,
     * because "Laboratoire central d'Kingston" precedes four "Laboratoire
     * régional de …". So the first cell tells the two apart in a single value,
     * whichever page the table happens to be showing.
     */
    const everyCity = [
      ...new Set(buildSeed(new Date()).facilities.map((f) => f.city.fr)),
    ].sort((a, b) => a.localeCompare(b, "fr-CA"));
    expect(
      cities[0],
      `the site column starts at ${cities[0]} and reads ${cities.join(", ")}`,
    ).toBe(everyCity[0]);

    const sorted = [...cities].sort((a, b) => a.localeCompare(b, "fr-CA"));
    expect(cities, `the site column reads ${cities.join(", ")}`).toEqual(
      sorted,
    );
  });

  for (const locale of ["en", "fr"] as const) {
    test(`the site cell still announces the whole site name, ${locale}`, async ({
      context,
      page,
    }) => {
      /*
       * The column shows the city; a screen reader has to get the site. The
       * first version used `title`, which name-from-content overrides, so the
       * accessible name was the city and the site name was announced nowhere —
       * a change that *removed* what the cell used to carry.
       *
       * Asserted through the role, which is what an assistive technology reads,
       * rather than through the attribute, which is how it happens to be done.
       */
      await useRole(context, "maintenanceCoordinator");
      await page.setViewportSize(VIEWPORTS.desktop);
      await openQueue(page, "", locale);

      const seeded = buildSeed(new Date());
      const facility = seeded.facilities[0]!;
      const fullName = locale === "fr" ? facility.name.fr : facility.name.en;
      const city = locale === "fr" ? facility.city.fr : facility.city.en;

      // The two are genuinely different strings, or this test proves nothing.
      expect(fullName).not.toBe(city);

      await expect(
        page.getByRole("cell", { name: fullName, exact: true }).first(),
      ).toBeAttached();
      // And the screen still reads the short one.
      await expect(page.getByText(city, { exact: true }).first()).toBeVisible();
    });
  }

  test("becomes cards on a phone, with nothing overflowing", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto("/en/work-orders");

    await expect(page.getByRole("article").first()).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });
});
