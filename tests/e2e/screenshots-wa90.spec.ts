import { expect, test } from "@playwright/test";
import { floorMapView } from "@/data/selectors/floor-map";
import { buildSeed } from "@/data/seed";
import { toIsoDate } from "@/data/seed/dates";
import en from "../../messages/en.json";
import {
  VIEWPORTS,
  hydrated,
  useRole,
  withoutServiceWorker,
} from "../fixtures/shell";
import type { Page } from "@playwright/test";
import {
  PINNED_DAY,
  pinTheDay,
  screenshotDir,
  settled,
} from "../fixtures/screenshots";

test.beforeEach(async ({ page }) => {
  await pinTheDay(page);
  await withoutServiceWorker(page);
});

/**
 * The pictures for WA-90: the plan, the rooms beside it, and the panel for the
 * machine somebody has pointed at.
 *
 * Built from `buildSeed(PINNED_DAY)` rather than from today, because the run
 * fixes the clock and the states on the plan — late, open, clear — are dated
 * facts. Reading them from the real day would name a machine that is clear now
 * and outlined in the picture.
 */
const OUT = screenshotDir("WA-90");

/**
 * The drawing, actually painted.
 *
 * `settled` waits for skeletons and for fonts; an image is neither, and the
 * first run of this spec caught it — the plan was photographed with the top
 * eighty pixels of the JPEG decoded and the rest blank, differently in each of
 * three runs, so the same unchanged screen produced three different files. A
 * picture of a screen half way through loading is not a picture of the screen.
 */
async function drawingPainted(page: Page) {
  const image = page.locator("img[data-slot='floor-plan-image']");
  await expect(image).toBeVisible();
  await image.evaluate((element: HTMLImageElement) =>
    element.decode().catch(() => undefined),
  );
  await expect
    .poll(() => image.evaluate((element: HTMLImageElement) => element.complete))
    .toBe(true);
}

const seed = buildSeed(PINNED_DAY);
const drawn = seed.floorPlans.find((plan) => plan.image !== null)!;
const drawnFloor = seed.locations.find((one) => one.id === drawn.floorId)!;
const view = floorMapView(seed, drawn.floorId, toIsoDate(PINNED_DAY));
const selectable = view.placed[0]!;

test.describe("WA-90 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  test("the plan, with every machine on the floor outlined", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(`/en/facilities/map/${drawnFloor.code}`);
    await hydrated(page);

    // The screen's own content, drawn from the store: a marker carries an
    // asset tag, which the server-rendered HTML does not.
    await expect(
      page.getByRole("button", {
        name: `${selectable.asset!.assetTag}, ${en.floorMap[selectable.state]}`,
      }),
    ).toBeVisible();

    await settled(page);
    await drawingPainted(page);
    await page.screenshot({
      path: `${OUT}/floor-map-1440.png`,
      animations: "disabled",
    });
  });

  test("the rooms beside the plan, and the panel for one machine", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(`/en/facilities/map/${drawnFloor.code}`);
    await hydrated(page);

    const marker = page.getByRole("button", {
      name: `${selectable.asset!.assetTag}, ${en.floorMap[selectable.state]}`,
    });
    await expect(marker).toBeVisible();
    await marker.click();

    const panel = page.getByRole("region", {
      name: en.floorMap.selectedTitle,
    });
    await expect(panel).toBeVisible();
    await settled(page);
    await drawingPainted(page);
    await panel.screenshot({
      path: `${OUT}/asset-panel-1440.png`,
      animations: "disabled",
    });

    const rooms = page.getByRole("region", { name: en.floorMap.roomsTitle });
    await expect(rooms).toBeVisible();
    await rooms.screenshot({
      path: `${OUT}/room-panel-1440.png`,
      animations: "disabled",
    });
  });

  test("the plan on a phone", async ({ context, page }) => {
    /*
     * A desk role, because the map is a facilities screen and the facilities
     * module is desk-only. Photographing it as a technician photographed the
     * permission panel — which is a real answer to a real question, and not
     * the picture this case is named for.
     */
    await useRole(context, "facilityManager");
    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto(`/en/facilities/map/${drawnFloor.code}`);
    await hydrated(page);
    await expect(
      page.getByRole("button", {
        name: `${selectable.asset!.assetTag}, ${en.floorMap[selectable.state]}`,
      }),
    ).toBeVisible();

    await settled(page);
    await drawingPainted(page);
    await page.screenshot({
      path: `${OUT}/floor-map-390.png`,
      animations: "disabled",
      fullPage: true,
    });
  });
});
