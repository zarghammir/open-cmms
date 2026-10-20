import { expect, test, type Page } from "@playwright/test";
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
 * The pictures for WA-114: a floor with its whole estate on it, and the
 * machine the recording needs for shot 39.
 */
const OUT = screenshotDir("WA-114");

const seed = buildSeed(PINNED_DAY);
const drawn = seed.floorPlans.find((plan) => plan.image !== null)!;
const drawnFloor = seed.locations.find((one) => one.id === drawn.floorId)!;
const view = floorMapView(seed, drawn.floorId, toIsoDate(PINNED_DAY));
/** The machine whose only trouble is its spares — the shot QA asked for. */
const lowOnly = view.placed.find((one) => one.state === "lowStock")!;

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

test.describe("WA-114 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  test("the floor with every machine on it", async ({ context, page }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(`/en/facilities/map/${drawnFloor.code}`);
    await hydrated(page);
    await expect(
      page.getByRole("button", {
        name: `${view.placed[0]!.asset!.assetTag}, ${en.floorMap[view.placed[0]!.state]}`,
      }),
    ).toBeVisible();

    await settled(page);
    await drawingPainted(page);
    await page.screenshot({
      path: `${OUT}/floor-every-machine-1440.png`,
      animations: "disabled",
    });
  });

  test("a small marker naming itself", async ({ context, page }) => {
    /*
     * The truncation question, answered with a picture rather than an
     * expectation: the tooltip is portalled, so it is not clipped by the
     * plan's `overflow-hidden`, and it is drawn on one of the markers whose
     * own box is too small to print a tag.
     */
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(`/en/facilities/map/${drawnFloor.code}`);
    await hydrated(page);

    const small = view.placed.find(
      (one) => one.placement.width <= 0.06 && one.asset !== null,
    )!;
    const marker = page.getByRole("button", {
      name: `${small.asset!.assetTag}, ${en.floorMap[small.state]}`,
    });
    await expect(marker).toBeVisible();
    await marker.hover();
    await expect(page.getByRole("tooltip")).toBeVisible();

    await settled(page);
    await drawingPainted(page);
    await page.screenshot({
      path: `${OUT}/small-marker-tooltip-1440.png`,
      animations: "disabled",
    });
  });

  test("the machine whose only trouble is its spares", async ({
    context,
    page,
  }) => {
    /*
     * Shot 39 of the recording plan. The subject is read from the records
     * rather than named here: if a seed change moves the state to another
     * machine the picture follows it, and if no machine carries it the unit
     * suite reds before this runs.
     */
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(`/en/facilities/map/${drawnFloor.code}`);
    await hydrated(page);

    const marker = page.getByRole("button", {
      name: `${lowOnly.asset!.assetTag}, ${en.floorMap.lowStock}`,
    });
    await expect(marker).toBeVisible();
    await marker.click();

    const panel = page.getByRole("region", { name: en.floorMap.selectedTitle });
    await expect(panel).toContainText(lowOnly.asset!.assetTag);

    await settled(page);
    await drawingPainted(page);
    await page.screenshot({
      path: `${OUT}/low-spare-only-1440.png`,
      animations: "disabled",
    });
  });
});
