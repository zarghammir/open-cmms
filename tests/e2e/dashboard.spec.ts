import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { buildSeed } from "../../src/data/seed";
import { toIsoDate } from "../../src/data/seed/dates";
import { currentUserIdForRole } from "../../src/data/seed/people";
import {
  exceptionRows,
  myAssignments,
} from "../../src/data/selectors/dashboard";
import { dashboardKpis } from "../../src/data/selectors/kpi";
import {
  VIEWPORTS,
  hasHorizontalOverflow,
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
 * The dashboard, in a real browser.
 *
 * The expected numbers are computed here from the same generator the browser
 * seeds itself with, rather than written down: a figure typed into a test is a
 * figure that agrees with itself, and what this needs to prove is that the
 * screen agrees with the records. `buildSeed` is pure and takes the day as an
 * argument, so both sides are looking at the same thing.
 */

const now = new Date();
const today = toIsoDate(now);
const seed = buildSeed(now);

async function readNumber(page: Page, testId: string): Promise<number> {
  const text = await page.getByTestId(testId).innerText();
  return Number.parseInt(text.replace(/\D/g, ""), 10);
}

test.describe("the dashboard", () => {
  test("opens on the worst thing in the organisation", async ({
    context,
    page,
  }) => {
    // The demonstration's first beat: an evaluator sees an overdue critical
    // work order at a named site without scrolling and without choosing a
    // filter. The seed guarantees such an order exists; this proves the screen
    // puts it where a person will actually see it.
    await useRole(context, "maintenanceCoordinator");
    const watcher = watchConsole(page);
    await page.goto("/en/dashboard");

    const rows = page.getByTestId("exception-rows").getByRole("listitem");
    await expect(rows.first()).toBeVisible();

    const firstThree = await rows.all();
    const opening = firstThree.slice(0, 3);
    expect(opening.length).toBeGreaterThan(0);

    const texts = await Promise.all(opening.map((row) => row.innerText()));
    const critical = texts.filter((text) =>
      text.includes(en.priority.critical),
    );
    expect(
      critical.length,
      "no critical work order in the first three rows of the exceptions list",
    ).toBeGreaterThan(0);
    // Overdue, and at a site with a name — the row says both.
    expect(critical.some((text) => /\d+ days? late/.test(text))).toBe(true);
    expect(
      critical.some((text) =>
        seed.facilities.some((facility) => text.includes(facility.name.en)),
      ),
    ).toBe(true);

    // And it is above the fold at the width the demonstration is recorded at.
    const box = await rows.first().boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeLessThan(VIEWPORTS.desktop.height);

    expect(watcher.errors).toEqual([]);
  });

  test("shows the numbers the records hold, not numbers of its own", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.goto("/en/dashboard");
    await expect(page.getByTestId("kpi-open")).toBeVisible();

    const expected = dashboardKpis(seed, today);

    expect(await readNumber(page, "kpi-open")).toBe(expected.openWorkOrders);
    expect(await readNumber(page, "kpi-overdue")).toBe(expected.overdue);
    expect(await readNumber(page, "kpi-critical")).toBe(expected.criticalOpen);
    expect(await readNumber(page, "kpi-low-stock")).toBe(
      expected.partsBelowMinimum,
    );
    expect(await readNumber(page, "kpi-inspections")).toBe(
      expected.inspectionsScheduled,
    );
    // The control: a screen showing zeros everywhere would satisfy an equality
    // against a seed that happened to be empty.
    expect(expected.openWorkOrders).toBeGreaterThan(0);
  });

  test("one filter narrows every panel on the screen together", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    const watcher = watchConsole(page);
    await page.goto("/en/dashboard");
    await hydrated(page);
    await expect(page.getByTestId("kpi-open")).toBeVisible();

    const site = seed.facilities[1]!;
    await page.getByRole("button", { name: en.dashboard.filter.label }).click();
    await page.getByRole("menuitemradio", { name: site.name.en }).click();

    // The choice lives in the address, so the screen survives a reload and a
    // reviewer can send the link.
    await expect(page).toHaveURL(new RegExp(`facility=${site.id}`));

    const narrowed = dashboardKpis(seed, today, site.id);
    await expect(page.getByTestId("kpi-open")).toHaveText(
      String(narrowed.openWorkOrders),
    );

    // Cards and lists narrowed to the same site, which is the whole point of
    // there being one control rather than one per panel.
    const rows = page.getByTestId("exception-rows").getByRole("listitem");
    const expectedRows = exceptionRows(seed, today, site.id);
    await expect(rows).toHaveCount(expectedRows.length);
    for (const text of await rows.allInnerTexts()) {
      expect(text).toContain(site.name.en);
    }

    await page.reload();
    await expect(page.getByTestId("kpi-open")).toHaveText(
      String(narrowed.openWorkOrders),
    );
    expect(watcher.errors).toEqual([]);
  });

  test("counts come back after the demonstration is reset", async ({
    context,
    page,
  }) => {
    await useRole(context, "administrator");
    await page.goto("/en/dashboard");
    await expect(page.getByTestId("kpi-open")).toBeVisible();
    const before = await readNumber(page, "kpi-open");

    await page.goto("/en/settings");
    await hydrated(page);
    await page.getByRole("button", { name: en.demo.reset }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: en.demo.confirmAction })
      .click();

    await expect(page).toHaveURL(/\/en\/dashboard$/);
    await expect(page.getByTestId("kpi-open")).toHaveText(String(before));
  });

  test("reads as French, dates and all", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");
    const watcher = watchConsole(page);
    await page.goto("/fr/dashboard");

    await expect(
      page.getByText(fr.dashboard.exceptions.title, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(fr.dashboard.activity.title, { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("kpi-open")).toBeVisible();
    // Not the English screen with a French URL.
    await expect(
      page.getByText(en.dashboard.exceptions.title, { exact: true }),
    ).toHaveCount(0);
    expect(watcher.errors).toEqual([]);
  });

  test("never scrolls sideways", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");

    for (const size of Object.values(VIEWPORTS)) {
      await page.setViewportSize(size);
      await page.goto("/en/dashboard");
      await expect(page.getByTestId("kpi-open")).toBeVisible();
      expect(
        await hasHorizontalOverflow(page),
        `sideways scroll at ${size.width}`,
      ).toBe(false);
    }
  });
});

test.describe("the field home", () => {
  test("puts this technician's most urgent work first, on a phone", async ({
    context,
    page,
  }) => {
    const technician = currentUserIdForRole("technician");
    const mine = myAssignments(seed, today, technician);

    // Stated rather than assumed: with nothing assigned to this person the
    // assertions below would pass against an empty screen.
    expect(
      mine.length,
      "the seed assigns no open work to the technician the role switcher uses",
    ).toBeGreaterThan(0);

    await useRole(context, "technician");
    await page.setViewportSize(VIEWPORTS.phone);
    expect(page.viewportSize()).toEqual(VIEWPORTS.phone);

    const watcher = watchConsole(page);
    await page.goto("/en/my-work");

    const rows = page.getByTestId("my-work-rows").getByRole("listitem");
    await expect(rows).toHaveCount(mine.length);
    await expect(rows.first()).toContainText(mine[0]!.number);

    // A gloved thumb needs a target, so the row is at least 44px tall.
    const box = await rows.first().boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    // A layout guard, and only that: the whole of the first row fits inside the
    // phone viewport. It is NOT the ordering guard — measured at 390x844 all
    // five of this technician's rows end above the fold (the first at 377, the
    // last at 818), so this passes whatever order the list is in. Ordering is
    // carried by the `toContainText(mine[0].number)` assertion above, which is
    // the discriminating one. What this catches is a regression that pushes the
    // first row down the page, and it takes a big one: 467px of headroom.
    //
    // If you measure any of this again, wait for the rows first. Read the page
    // before the store has loaded and you are measuring the skeleton: zero rows
    // and a scroll height exactly equal to the viewport, which reads as a page
    // that does not scroll at all.
    expect(box!.y + box!.height).toBeLessThanOrEqual(VIEWPORTS.phone.height);

    expect(watcher.errors).toEqual([]);
  });

  test("shows the overdue work it has, at the top", async ({
    context,
    page,
  }) => {
    const technician = currentUserIdForRole("technician");
    const mine = myAssignments(seed, today, technician);
    const late = mine.filter((row) => row.daysLate !== null);

    await useRole(context, "technician");
    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto("/en/my-work");

    const rows = page.getByTestId("my-work-rows").getByRole("listitem");
    await expect(rows.first()).toBeVisible();

    // Whatever is late is above whatever is not: the first rows on the screen
    // are exactly the late ones, in the selector's order.
    for (const [index, row] of late.entries()) {
      await expect(rows.nth(index)).toContainText(row.number);
    }
  });
});
