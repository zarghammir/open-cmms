import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { buildSeed } from "@/data/seed";
import { toIsoDate } from "@/data/seed/dates";
import {
  VIEWPORTS,
  hasHorizontalOverflow,
  hydrated,
  useRole,
  watchConsole,
} from "../fixtures/shell";

/**
 * The asset page, in a real browser.
 *
 * The expected records are computed here from the same generator the browser
 * seeds itself with, rather than written down: a figure typed into a test is a
 * figure that agrees with itself, and what this proves is that the screen
 * agrees with the records.
 */

const now = new Date();
const today = toIsoDate(now);
const seed = buildSeed(now);

/** An asset with work against it, so the tabs are not all empty states. */
const busiest = seed.assets.find(
  (asset) =>
    seed.workOrders.filter((order) => order.assetId === asset.id).length > 1,
)!;

/**
 * Equipment that has both a past and a present: more than one job against it,
 * and one of them still running so the walk below can finish it.
 *
 * Not `busiest`. That is chosen only for having more than one job, and under
 * the seed this was written against both of its jobs are already finished —
 * the first run of this test threw "The seed holds no in-progress order on
 * EWS-KGN-11", which is the fixture doing its job rather than the test
 * quietly proving nothing.
 *
 * Narrowing `busiest` itself would have left the whole file resting on the
 * single asset that satisfies both conditions today. This is a second fixture
 * for the one assertion that needs live work, and it throws by name too.
 */
const WITH_LIVE_WORK = (() => {
  for (const asset of seed.assets) {
    const orders = seed.workOrders.filter(
      (order) => order.assetId === asset.id,
    );
    const live = orders.find((order) => order.status === "inProgress");
    if (orders.length > 1 && live) return { asset, live };
  }
  throw new Error("The seed holds no asset with both finished and live work");
})();

async function openAsset(page: Page, tag: string, locale = "en") {
  await page.goto(`/${locale}/assets/${tag}`);
  await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
}

test.describe("the asset page", () => {
  test("opens on a real asset, at a room the records actually hold", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    const watcher = watchConsole(page);
    await openAsset(page, busiest.assetTag);

    await expect(page.getByText(busiest.assetTag).first()).toBeVisible();

    // The breadcrumb resolves to seeded places rather than to ids, and it is
    // the breadcrumb that is asserted rather than "this text appears somewhere":
    // the room name also sits in the Overview, so a loose match would pass on
    // the wrong element.
    const room = seed.locations.find(
      (location) => location.id === busiest.locationId,
    )!;
    const facility = seed.facilities.find(
      (candidate) => candidate.id === busiest.facilityId,
    )!;
    const place = page.getByTestId("asset-place");
    await expect(place).toContainText(facility.name.en);
    await expect(place).toContainText(room.name.en);

    // Stated, not assumed: a room whose code is not in the seed would make the
    // assertion above pass against any text at all.
    expect(room.code).toMatch(/^[A-Z]{3}-B\d{2}-\d{3}$/);

    expect(watcher.errors).toEqual([]);
  });

  test("names the tag back when it holds no such asset", async ({
    context,
    page,
  }) => {
    // Somebody is standing in front of a machine with a label in their hand.
    // An empty asset page would be a worse answer than saying it is not here.
    await useRole(context, "maintenanceCoordinator");
    await page.goto("/en/assets/AHU-KGN-99");

    await expect(page.getByText(en.records.missingTitle)).toBeVisible();
    // It names the identifier back, because the first thing anyone does is
    // check they read the label right.
    await expect(
      page.getByText(
        en.records.missingBody.replace("{identifier}", "AHU-KGN-99"),
      ),
    ).toBeVisible();
    expect(seed.assets.some((asset) => asset.assetTag === "AHU-KGN-99")).toBe(
      false,
    );
  });

  test("every section is a link, reachable by keyboard, and says which is current", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await openAsset(page, busiest.assetTag);

    const sections = page.getByRole("navigation", {
      name: en.assetDetail.sections,
    });
    await expect(sections.getByRole("link")).toHaveCount(8);
    await expect(
      sections.getByRole("link", { name: en.assetDetail.tabs.overview }),
    ).toHaveAttribute("aria-current", "page");

    const history = sections.getByRole("link", {
      name: en.assetDetail.tabs.history,
    });
    await history.focus();
    await expect(history).toBeFocused();
    await page.keyboard.press("Enter");

    // The section lives in the address, so it survives a reload and a link.
    await expect(page).toHaveURL(/tab=history/);
    await expect(history).toHaveAttribute("aria-current", "page");
    await page.reload();
    await expect(
      sections.getByRole("link", { name: en.assetDetail.tabs.history }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("shows every work order the records hold against the asset", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await openAsset(page, busiest.assetTag);

    await page.goto(`/en/assets/${busiest.assetTag}?tab=workOrders`);
    const expectedOrders = seed.workOrders.filter(
      (order) => order.assetId === busiest.id,
    );
    expect(expectedOrders.length).toBeGreaterThan(1);
    await expect(
      page.getByTestId("asset-work-orders").getByRole("listitem"),
    ).toHaveCount(expectedOrders.length);
  });

  /**
   * The equipment's history, asserted as an outcome rather than sampled.
   */
  test("a finished job appears in the equipment's history, newest first", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    /*
     * The history, asserted as an outcome rather than as a coincidence.
     *
     * What stood here computed the newest entry from the selector, and then
     * only looked for it **if that entry happened to be a work order**:
     *
     *     const firstText = first.kind === "workOrder" ? first.order.number : undefined;
     *     if (firstText) { await expect(...).toBeVisible(); }
     *
     * On a seed whose newest entry was an inspection or a movement the whole
     * assertion was skipped and the test passed having checked nothing — under
     * a name promising the history is newest first. It also only asked whether
     * the number appeared **anywhere on the page**, which the work-orders tab
     * above had already put there.
     *
     * So this finishes a job and watches it arrive: the number, the status
     * beside it, in the history list, at the top. Completing sets
     * `completedAt`, and `workOrderMoment` prefers it, so the job this test
     * just finished is by construction the newest thing that has happened to
     * this equipment — which is what makes "newest first" assertable at all
     * rather than a claim in a test name.
     */
    await page.goto(`/en/assets/${WITH_LIVE_WORK.asset.assetTag}?tab=history`);
    await hydrated(page);
    const rows = page.getByTestId("asset-history").getByRole("listitem");
    await expect(rows.first()).toBeVisible();
    const before = await rows.allInnerTexts();

    /*
     * The floor. Two halves, because each catches a different lie.
     *
     * A non-empty history means "it grew" is a statement about a list that
     * exists. And keeping the rows themselves lets the assertion after the
     * walk be "a row that was not here before", rather than "a row is here" —
     * which was already true of this order before it was completed, when its
     * row read In progress.
     */
    expect(before.length).toBeGreaterThan(1);
    expect(
      before.some((row) => row.includes(WITH_LIVE_WORK.live.number)),
      "the order about to be completed is already listed, as live work",
    ).toBe(true);

    // Finish it.
    await page.goto(`/en/work-orders/${WITH_LIVE_WORK.live.number}`);
    await hydrated(page);
    await page
      .getByRole("button", { name: en.workOrderDetail.write.actions.complete })
      .click();
    await page.getByLabel(en.workOrderDetail.write.complete.minutes).fill("45");
    await page
      .getByLabel(en.workOrderDetail.write.complete.note)
      .fill("Checked and closed while proving the history.");
    await page
      .getByRole("button", { name: en.workOrderDetail.write.complete.submit })
      .click();
    /*
     * The dialog closing is the durability signal, and it is what this
     * assertion is for.
     *
     * `CompleteDialog` only closes after `save()` reports `stored`, so a shut
     * dialog means the write reached the device. The status chip does not mean
     * that: it is the screen already showing the new world, and navigating on
     * the strength of it tears the document down with the write still in
     * flight — WA-67's shape.
     *
     * Measured rather than reasoned: without this the third cold run of this
     * test found the equipment's history still reading "In progress", twenty-
     * four polls steady, while runs one and two passed. A race, not the
     * instrument, and the same one WA-88's assign helper hit an hour earlier.
     */
    await expect(
      page.getByRole("dialog"),
      "the completion reached the device, so the dialog closed",
    ).toHaveCount(0);
    await expect(
      page.getByText(en.workOrderStatus.completed).first(),
    ).toBeVisible();

    // And read the equipment's own history again.
    await page.goto(`/en/assets/${WITH_LIVE_WORK.asset.assetTag}?tab=history`);
    await hydrated(page);
    await expect(rows.first()).toBeVisible();

    const completedRow = rows.filter({ hasText: WITH_LIVE_WORK.live.number });
    await expect(
      completedRow,
      "the finished job is in the equipment's history, exactly once",
    ).toHaveCount(1);
    await expect(
      completedRow,
      "and it is listed with the status it now has",
    ).toContainText(en.workOrderStatus.completed);

    // Newest first, which is the other half of this test's name: the job that
    // was finished a moment ago is the newest thing on this equipment.
    await expect(rows.first()).toContainText(WITH_LIVE_WORK.live.number);

    // The floor, paid: this row did not exist before the walk.
    const after = await rows.allInnerTexts();
    const fresh = after.filter((row) => !before.includes(row));
    expect(
      fresh.length,
      "at least one row on this screen is new since the walk began",
    ).toBeGreaterThan(0);
    expect(
      fresh.some((row) => row.includes(WITH_LIVE_WORK.live.number)),
      "and the new row is the job this test finished",
    ).toBe(true);
  });

  test("an edit reaches the history without a reload", async ({
    context,
    page,
  }) => {
    /*
     * The ticket asks for a work order to be completed elsewhere and the tabs
     * to follow. There is no completion UI yet — that is WA-11 — so the change
     * driven here is the one this ticket does own: the asset's criticality.
     * What it proves is the same thing, which is that the page reads from the
     * store rather than from a snapshot taken at load: a mutation made in one
     * part of the screen reaches a panel in another without a navigation.
     * WA-11 adds the completion variant.
     */
    await useRole(context, "administrator");
    const watcher = watchConsole(page);
    await openAsset(page, busiest.assetTag);

    const target =
      busiest.criticality === "critical" ? "low" : ("critical" as const);

    await page
      .getByRole("button", { name: en.assetDetail.edit.action })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("radio", { name: en.criticality[target] }).click();
    await dialog
      .getByRole("button", { name: en.assetDetail.edit.save })
      .click();

    await expect(dialog).toBeHidden();
    await expect(
      page.getByText(en.criticality[target], { exact: true }).first(),
    ).toBeVisible();

    // Same page, no navigation: the trail already knows.
    await page.getByRole("link", { name: en.assetDetail.tabs.history }).click();
    await expect(
      page.getByText(en.audit.assetUpdated.replace("{tag}", busiest.assetTag)),
    ).toBeVisible();

    expect(watcher.errors).toEqual([]);
  });

  test("an unchanged edit writes nothing and says so", async ({
    context,
    page,
  }) => {
    // An audit entry recording that an asset was updated, listing no change, is
    // a record of something that did not happen.
    await useRole(context, "administrator");
    await openAsset(page, busiest.assetTag);

    await page
      .getByRole("button", { name: en.assetDetail.edit.action })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: en.assetDetail.edit.save })
      .click();

    await expect(
      page.getByText(en.assetDetail.edit.nothingChanged),
    ).toBeVisible();
  });

  test("reads as French", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");
    const watcher = watchConsole(page);
    await openAsset(page, busiest.assetTag, "fr");

    await expect(
      page.getByRole("link", { name: fr.assetDetail.tabs.history }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: en.assetDetail.tabs.history }),
    ).toHaveCount(0);
    expect(watcher.errors).toEqual([]);
  });

  test("never scrolls sideways", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");

    for (const size of Object.values(VIEWPORTS)) {
      await page.setViewportSize(size);
      await openAsset(page, busiest.assetTag);
      expect(
        await hasHorizontalOverflow(page),
        `sideways scroll at ${size.width}`,
      ).toBe(false);
    }
  });

  test("a role that cannot change an asset is told why, not left guessing", async ({
    context,
    page,
  }) => {
    await useRole(context, "auditor");
    await openAsset(page, busiest.assetTag);

    const action = page.getByRole("button", {
      name: en.assetDetail.edit.action,
    });
    await expect(action).toBeDisabled();
  });
});

test.describe("the asset page reckons dates correctly", () => {
  test("shows an installation date on the day it happened", async ({
    context,
    page,
  }) => {
    // The whole reason `calendarDate` exists: a stored day parsed naively
    // prints as the day before in America/Toronto.
    await useRole(context, "maintenanceCoordinator");
    await openAsset(page, busiest.assetTag);

    const [year, month, day] = busiest.installedAt.split("-");
    const expected = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(`${busiest.installedAt}T12:00:00.000Z`));

    expect(expected).toContain(String(Number(day)));
    expect(expected).toContain(year);
    expect(month).toMatch(/^\d{2}$/);
    await expect(page.getByText(expected)).toBeVisible();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

test.describe("the label", () => {
  test("reads the same on the tab as on the address a scan lands at", async ({
    context,
    page,
  }) => {
    /*
     * The Label tab mounts WA-16's component; `/assets/<tag>/label` is the
     * address a printed sticker resolves to and stays a route of its own. This
     * is the assertion that they are one thing: if someone later folds the
     * route into the tab, or grows a second way of drawing a label, the two
     * stop agreeing here rather than in a technician's hand.
     */
    await useRole(context, "maintenanceCoordinator");
    const room = seed.locations.find(
      (location) => location.id === busiest.locationId,
    )!;

    const readLabel = async (path: string) => {
      await page.goto(path);
      const region = page.locator("[data-print-region]");
      await expect(region).toBeVisible();
      return region.innerText();
    };

    const onTab = await readLabel(`/en/assets/${busiest.assetTag}?tab=label`);
    const onRoute = await readLabel(`/en/assets/${busiest.assetTag}/label`);

    expect(onTab).toContain(busiest.assetTag);
    expect(onTab).toContain(room.code);
    expect(onTab).toBe(onRoute);

    // Stated rather than assumed: comparing two empty strings would pass.
    expect(onTab.trim().length).toBeGreaterThan(0);
  });
});

test.describe("from the table", () => {
  test("opens an asset by clicking its tag, at both widths", async ({
    context,
    page,
  }) => {
    /*
     * QA step 1: from the assets table, open an asset. The tag is the link in
     * both views — the table at desk width and the card at phone width — so
     * this drives both rather than trusting that the card carries what the
     * table does.
     */
    await useRole(context, "maintenanceCoordinator");

    for (const size of [VIEWPORTS.desktop, VIEWPORTS.phone]) {
      await page.setViewportSize(size);
      await page.goto("/en/assets");
      await hydrated(page);

      /*
       * Whichever asset the table is showing, rather than one chosen here. The
       * table paginates, so naming an asset in advance means the test passes or
       * fails on whether that asset happens to land on the first page — which
       * has nothing to do with whether the link works.
       */
      const first = page.locator("a[href^='/en/assets/']").first();
      await expect(first).toBeVisible();
      const tag = (await first.innerText()).trim();
      expect(tag).toMatch(/^[A-Z]{2,4}-[A-Z]{3}-\d{2}$/);

      await first.click();
      await expect(page).toHaveURL(new RegExp(`/en/assets/${tag}$`));
      await expect(
        page.getByRole("heading", { level: 1, name: tag }),
      ).toBeVisible();
      await expect(page.getByTestId("asset-place")).toBeVisible();
    }
  });

  test("carries the tag in the address, not an id", async ({
    context,
    page,
  }) => {
    // The address a printed label resolves to and the address the table links
    // to are the same address. An id here would work until someone pressed
    // Reset, and would then resolve to nothing.
    await useRole(context, "maintenanceCoordinator");
    await page.goto("/en/assets");

    const first = page.locator("a[href^='/en/assets/']").first();
    const href = await first.getAttribute("href");
    const tag = (await first.innerText()).trim();

    expect(href).toBe(`/en/assets/${tag}`);
    // And the tag is a tag, not an opaque id that happens to be in the text.
    expect(tag).toMatch(/^[A-Z]{2,4}-[A-Z]{3}-\d{2}$/);
    expect(seed.assets.some((asset) => asset.assetTag === tag)).toBe(true);
    expect(href).not.toMatch(/ast-/);
  });
});
