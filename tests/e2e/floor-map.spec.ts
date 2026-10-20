import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { floorMapView } from "@/data/selectors/floor-map";
import { buildSeed } from "@/data/seed";
import { toIsoDate } from "@/data/seed/dates";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import {
  VIEWPORTS,
  hasHorizontalOverflow,
  hydrated,
  useRole,
  watchConsole,
  withoutServiceWorker,
} from "../fixtures/shell";

/**
 * The floor plan, used the way a person uses it.
 *
 * **Nothing here names a record this file chose.** The floor, the machines on
 * it and which of them is clear are all read out of the seed through the
 * screen's own selector, so a change to the estate moves this test rather than
 * breaking it — and a machine that stops being clear cannot quietly turn the
 * raise-and-watch-it-change walk into a test of nothing.
 *
 * Every wait is on something the **store** draws — a marker carries an asset
 * tag, which the server-rendered HTML does not — never on the shell's marker or
 * on a heading the server already sent.
 */

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

const seed = buildSeed(new Date());
const today = toIsoDate(new Date());

const drawn = seed.floorPlans.find((plan) => plan.image !== null)!;
const drawnFloor = seed.locations.find((one) => one.id === drawn.floorId)!;
const view = floorMapView(seed, drawn.floorId, today);

/** A machine with nothing open against it, so raising one changes its outline. */
const clearOne = view.placed.find((one) => one.state === "clear")!;
/** A machine with late work, so the plan has more than one thing to say. */
const lateOne = view.placed.find((one) => one.state === "overdue")!;

const surveyed = seed.floorPlans.find((plan) => plan.image === null)!;
const surveyedFloor = seed.locations.find(
  (one) => one.id === surveyed.floorId,
)!;
const roomOnFloor = seed.locations.find(
  (one) => one.kind === "room" && one.parentId === drawnFloor.id,
)!;

function marker(page: Page, tag: string, state: string) {
  return page.getByRole("button", { name: `${tag}, ${state}` });
}

async function openMap(page: Page, code: string, locale: "en" | "fr" = "en") {
  await page.goto(`/${locale}/facilities/map/${code}`);
  await hydrated(page);
}

test("the plan draws every machine on the floor, and says what each one is", async ({
  context,
  page,
}) => {
  await useRole(context, "maintenanceCoordinator");
  const watcher = watchConsole(page);
  await page.setViewportSize(VIEWPORTS.desktop);
  await openMap(page, drawnFloor.code);

  // The floor under the whole file: the seed really does put both a clear
  // machine and a late one on this floor, and the screen draws both.
  expect(clearOne, "no clear machine on the drawn floor").toBeDefined();
  expect(lateOne, "no late machine on the drawn floor").toBeDefined();

  await expect(
    marker(page, clearOne.asset!.assetTag, en.floorMap.clear),
  ).toBeVisible();
  await expect(
    marker(page, lateOne.asset!.assetTag, en.floorMap.overdue),
  ).toBeVisible();

  // The drawing itself, not only the markers over it.
  await expect(
    page.getByAltText(en.floorMap.planAlt.replace("{floor}", drawnFloor.code)),
  ).toBeVisible();

  expect(await hasHorizontalOverflow(page)).toBe(false);
  expect(watcher.errors).toEqual([]);
});

test("raising work from the plan changes the outline, with no reload", async ({
  context,
  page,
}) => {
  await useRole(context, "maintenanceCoordinator");
  const watcher = watchConsole(page);
  await page.setViewportSize(VIEWPORTS.desktop);
  await openMap(page, drawnFloor.code);

  const tag = clearOne.asset!.assetTag;
  await marker(page, tag, en.floorMap.clear).click();

  // The panel agrees with the outline before anything is raised.
  await expect(page.getByText(en.floorMap.clear).first()).toBeVisible();

  /*
   * A mark on the window that a navigation would wipe. Asserting the outline
   * changed proves nothing on its own: a full reload would also show the new
   * state, and the claim being made is that it changes in place.
   */
  await page.evaluate(() => {
    (window as unknown as { __waNoReload?: number }).__waNoReload = 1;
  });

  await page
    .getByRole("button", { name: en.floorMap.raiseAction })
    .first()
    .click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // The asset is already chosen, which is the point of raising it from here.
  await expect(dialog.locator("#wo-asset")).toHaveValue(clearOne.asset!.id);

  await dialog.locator("#wo-title").fill("Vibration on the north side");
  await dialog
    .locator("#wo-description")
    .fill("Noticed from the floor plan during the walkthrough.");
  await dialog.getByRole("button", { name: en.workOrderForm.submit }).click();

  /*
   * The dialog closing is the durability signal: the form calls back on its
   * `stored` branch only. Waiting for the toast or for the outline instead
   * would be waiting for the screen to update, which is not the write landing.
   */
  await expect(dialog).toBeHidden();

  // The same marker, now carrying open work, and the page never reloaded.
  await expect(marker(page, tag, en.floorMap.open)).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { __waNoReload?: number }).__waNoReload,
    ),
    "the page reloaded, so this proves nothing about updating in place",
  ).toBe(1);

  expect(watcher.errors).toEqual([]);
});

test("an auditor sees the raise control, disabled, with the reason", async ({
  context,
  page,
}) => {
  await useRole(context, "auditor");
  await page.setViewportSize(VIEWPORTS.desktop);
  await openMap(page, drawnFloor.code);

  await marker(page, clearOne.asset!.assetTag, en.floorMap.clear).click();

  const denied = page
    .getByRole("button", { name: en.floorMap.raiseAction })
    .first();
  await expect(denied).toBeVisible();
  await expect(denied).toBeDisabled();

  // And it says why: the explanation is reachable by keyboard, because the
  // disabled button cannot take focus itself.
  await page.locator('[data-slot="capability-action"]').first().focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
});

test("a floor with no drawing on file says so, and still lists its rooms", async ({
  context,
  page,
}) => {
  await useRole(context, "maintenanceCoordinator");
  await page.setViewportSize(VIEWPORTS.desktop);
  await openMap(page, surveyedFloor.code);

  await expect(page.getByText(en.floorMap.noDrawingTitle)).toBeVisible();
  await expect(page.getByText(en.floorMap.roomsTitle).first()).toBeVisible();
});

test("a room code is answered as a room, not as a missing record", async ({
  context,
  page,
}) => {
  await useRole(context, "maintenanceCoordinator");
  await page.setViewportSize(VIEWPORTS.desktop);
  await openMap(page, roomOnFloor.code);

  await expect(
    page.getByText(
      en.floorMap.notAFloorTitle.replace("{code}", roomOnFloor.code),
    ),
  ).toBeVisible();
});

test("a code this system does not hold is named back", async ({
  context,
  page,
}) => {
  await useRole(context, "maintenanceCoordinator");
  await page.setViewportSize(VIEWPORTS.desktop);
  await openMap(page, "ZZZ-B99-F9");

  await expect(page.getByText(en.records.missingTitle)).toBeVisible();
});

for (const [label, viewport] of [
  ["1024", VIEWPORTS.tablet],
  ["390", VIEWPORTS.phone],
] as const) {
  test(`the plan and its panels fit at ${label}, in French`, async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    const watcher = watchConsole(page);
    await page.setViewportSize(viewport);
    await openMap(page, drawnFloor.code, "fr");

    await expect(
      marker(page, clearOne.asset!.assetTag, fr.floorMap.clear),
    ).toBeVisible();
    await marker(page, clearOne.asset!.assetTag, fr.floorMap.clear).click();
    await expect(page.getByText(fr.floorMap.clear).first()).toBeVisible();

    expect(await hasHorizontalOverflow(page)).toBe(false);
    expect(watcher.errors).toEqual([]);
  });
}

test("the map scans clean with a machine selected", async ({
  context,
  page,
}) => {
  await useRole(context, "maintenanceCoordinator");
  await page.setViewportSize(VIEWPORTS.desktop);
  await openMap(page, drawnFloor.code);

  // Scanned with a panel open rather than only at rest: a screen scanned as it
  // loads is a screen scanned in one of its states.
  await marker(page, clearOne.asset!.assetTag, en.floorMap.clear).click();
  await expect(
    page.getByRole("region", { name: en.floorMap.selectedTitle }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations.map((one) => `${one.id}: ${one.impact}`)).toEqual(
    [],
  );
});

/*
 * The boot matrix: every width, both languages, every role.
 *
 * Written as a test rather than performed by hand once, because "I opened it
 * and it looked right" is evidence that expires the moment anybody edits the
 * shell. Each case asserts what a person would check by eye — the plan drew,
 * nothing scrolls sideways, the console stayed quiet.
 */
for (const locale of ["en", "fr"] as const)
  for (const [label, viewport] of [
    ["1440", VIEWPORTS.desktop],
    ["1024", VIEWPORTS.tablet],
    ["390", VIEWPORTS.phone],
  ] as const) {
    test(`the plan draws and stays inside the page at ${label} in ${locale}`, async ({
      context,
      page,
    }) => {
      const strings = locale === "en" ? en : fr;
      await useRole(context, "facilityManager");
      const watcher = watchConsole(page);
      await page.setViewportSize(viewport);
      await openMap(page, drawnFloor.code, locale);

      await expect(
        marker(page, clearOne.asset!.assetTag, strings.floorMap.clear),
      ).toBeVisible();
      await expect(
        page.getByAltText(
          strings.floorMap.planAlt.replace("{floor}", drawnFloor.code),
        ),
      ).toBeVisible();

      expect(await hasHorizontalOverflow(page)).toBe(false);
      expect(watcher.errors).toEqual([]);
    });
  }

/*
 * Who may open it at all.
 *
 * The map is a facilities screen and the facilities module is desk-only, so a
 * technician gets the permission panel — the same answer the rest of that
 * module gives them. Asserted rather than assumed: a screenshot run as a
 * technician photographed that panel and not the plan, which is how this was
 * noticed. Whether a field role ought to reach a floor map is a product
 * question and not this ticket's to answer, but the current answer should at
 * least be the deliberate one.
 */
for (const role of [
  "administrator",
  "facilityManager",
  "maintenanceCoordinator",
  "auditor",
] as const) {
  test(`${role} can open the plan`, async ({ context, page }) => {
    await useRole(context, role);
    await page.setViewportSize(VIEWPORTS.desktop);
    await openMap(page, drawnFloor.code);
    await expect(
      marker(page, clearOne.asset!.assetTag, en.floorMap.clear),
    ).toBeVisible();
  });
}

for (const role of ["technician", "inspector"] as const) {
  test(`${role} is told the module is not theirs, rather than shown an empty floor`, async ({
    context,
    page,
  }) => {
    await useRole(context, role);
    await page.setViewportSize(VIEWPORTS.desktop);
    await openMap(page, drawnFloor.code);
    await expect(page.getByText(en.permissions.deniedTitle)).toBeVisible();
    await expect(
      marker(page, clearOne.asset!.assetTag, en.floorMap.clear),
    ).toHaveCount(0);
  });
}

test("the map with no drawing scans clean too", async ({ context, page }) => {
  /*
   * The second panel state, scanned in its own right. The first axe case looks
   * at the plan with a machine selected; this one is the floor that has no
   * plan, which draws different markup and is the state a reader is most
   * likely to meet on a floor nobody has surveyed.
   */
  await useRole(context, "maintenanceCoordinator");
  await page.setViewportSize(VIEWPORTS.desktop);
  await openMap(page, surveyedFloor.code);
  await expect(page.getByText(en.floorMap.noDrawingTitle)).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations.map((one) => `${one.id}: ${one.impact}`)).toEqual(
    [],
  );
});

test("the room list gives every machine a full-size tap target", async ({
  context,
  page,
}) => {
  /*
   * **The room list is 2.5.8's equivalent-control route, and at 390 it is the
   * whole of it.** The footprints clear SC 2.5.8 (24×24, AA) at the desk widths
   * and `floor-map-markers.spec.ts` measures them there rather than asserting
   * it from memory — this comment used to recite "the narrowest measured 24×48
   * at 1024", a number taken against WA-114's markers, which WA-121 re-traced
   * out of existence while the sentence stayed put.
   *
   * On a phone the plan is drawn small enough that the smallest shapes cannot
   * be relied on, which is why this test is at `phone` and why it pins the
   * list's height: the shapes follow the drawing, and a full-width row at least
   * 44 high is what carries the same selection when they are too small to hit.
   * SC 2.5.5 (44×44, AAA) is the list's, never the plan's.
   */
  await useRole(context, "facilityManager");
  await page.setViewportSize(VIEWPORTS.phone);
  await openMap(page, drawnFloor.code);

  /*
   * Wait for something the store drew before counting anything.
   *
   * `count()` does not wait: under the full suite this read zero and failed,
   * while it passed every time the spec ran alone. The shell's ready marker is
   * attached before the rooms are rendered, so waiting on it and then counting
   * is the repository's own "an enabled button is not a bound button" in its
   * counting form.
   */
  await expect(
    marker(page, clearOne.asset!.assetTag, en.floorMap.clear),
  ).toBeVisible();

  const rooms = page.getByRole("region", { name: en.floorMap.roomsTitle });
  const buttons = rooms.getByRole("button");
  await expect(buttons.first()).toBeVisible();
  const count = await buttons.count();
  expect(count, "no selectable machines in the room list").toBeGreaterThan(0);

  const small: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    const box = (await button.boundingBox())!;
    if (box.height < 44) {
      small.push(`${await button.textContent()}: ${Math.round(box.height)}px`);
    }
  }
  expect(small).toEqual([]);
});
