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
 * The pictures for WA-105: the plan reached from the switch, and what the
 * switch answers with on a phone.
 *
 * Built from `buildSeed(PINNED_DAY)` rather than from today, because the run
 * fixes the clock and the outline states are dated facts.
 */
const OUT = screenshotDir("WA-105");

const seed = buildSeed(PINNED_DAY);
const drawn = seed.floorPlans.find((plan) => plan.image !== null)!;
const view = floorMapView(seed, drawn.floorId, toIsoDate(PINNED_DAY));
const busiest =
  view.placed.find((one) => (one.openCount ?? 0) > 0) ?? view.placed[0]!;

/** The drawing, actually painted — `settled` waits for skeletons and fonts. */
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

async function chooseMap(page: Page) {
  await page
    .locator('[data-slot="facilities-views"]')
    .getByRole("radio", { name: en.facilities.viewMap })
    .click();
}

test.describe("WA-105 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  test("the plan, reached from the switch, with a machine selected", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/en/facilities");
    await hydrated(page);
    await chooseMap(page);

    const marker = page.getByRole("button", {
      name: `${busiest.asset!.assetTag}, ${en.floorMap[busiest.state]}`,
    });
    await expect(marker).toBeVisible();
    await marker.click();
    await expect(
      page.getByRole("region", { name: en.floorMap.selectedTitle }),
    ).toBeVisible();

    await settled(page);
    await drawingPainted(page);
    await page.screenshot({
      path: `${OUT}/facilities-map-1440.png`,
      animations: "disabled",
    });
  });

  test("what the switch answers with on a phone", async ({ context, page }) => {
    await useRole(context, "facilityManager");
    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto("/en/facilities");
    await hydrated(page);
    await chooseMap(page);

    await expect(page.getByText(en.floorMap.onPhoneTitle)).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/facilities-map-390.png`,
      animations: "disabled",
      fullPage: true,
    });
  });
});
