import { expect, test, type Page } from "@playwright/test";
import { floorMapView } from "@/data/selectors/floor-map";
import { buildSeed } from "@/data/seed";
import { toIsoDate } from "@/data/seed/dates";
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
 * The pictures for WA-121: the floor as a drawing rather than a photograph.
 *
 * These are the only evidence for the half of this ticket no assertion reaches.
 * A test can prove the SVG has no raster in it, that every footprint is inside
 * its room and that all eight are hittable — and every one of those can pass on
 * a drawing that is unreadable. Whether the line work reads as a plan, whether
 * the state fills are legible against it, and whether a tag fits inside the
 * shape it belongs to are questions only a picture answers.
 */
const OUT = screenshotDir("WA-121");

const seed = buildSeed(PINNED_DAY);
const drawn = seed.floorPlans.find((plan) => plan.image !== null)!;
const drawnFloor = seed.locations.find((one) => one.id === drawn.floorId)!;
const view = floorMapView(seed, drawn.floorId, toIsoDate(PINNED_DAY));
/** The smallest shapes on the plan: the two declared device symbols. */
const symbols = ["RPM-MCT-11", "ALI-MCT-11"];

async function drawingPainted(page: Page) {
  const image = page.locator("img[data-slot='floor-plan-image']");
  await expect(image).toBeVisible();
  await image.evaluate((element: HTMLImageElement) =>
    element.decode().catch(() => undefined),
  );
  await expect
    .poll(() => image.evaluate((element: HTMLImageElement) => element.complete))
    .toBe(true);
  // A broken image is `complete` too. The natural size is what says the SVG
  // parsed, and a picture of a missing drawing is worse than no picture.
  await expect
    .poll(() =>
      image.evaluate((element: HTMLImageElement) => element.naturalWidth),
    )
    .toBeGreaterThan(0);
}

async function openMap(page: Page, locale: "en" | "fr") {
  await page.goto(`/${locale}/facilities/map/${drawnFloor.code}`);
  await hydrated(page);
  await drawingPainted(page);
  await settled(page);
}

test.describe("WA-121 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  for (const [label, viewport] of [
    ["1440", VIEWPORTS.desktop],
    ["1024", VIEWPORTS.tablet],
  ] as const) {
    test(`the drawn floor at ${label}`, async ({ context, page }) => {
      await useRole(context, "facilityManager");
      await page.setViewportSize(viewport);
      await openMap(page, "en");

      // The whole point of the ticket in one frame: walls with thickness,
      // doors with swings, and eight machines drawn as what they are.
      await page.screenshot({ path: `${OUT}/plan-${label}.png` });
    });
  }

  test("the drawn floor in French", async ({ context, page }) => {
    await useRole(context, "facilityManager");
    await page.setViewportSize(VIEWPORTS.desktop);
    await openMap(page, "fr");

    // The drawing carries room numbers and nothing else, so it is the same
    // picture in both languages — which is the claim this checks by showing it.
    await page.screenshot({ path: `${OUT}/plan-1440-fr.png` });
  });

  test("a device symbol, selected", async ({ context, page }) => {
    await useRole(context, "facilityManager");
    await page.setViewportSize(VIEWPORTS.desktop);
    await openMap(page, "en");

    /*
     * The two smallest shapes are the ones the ticket's argument rests on: the
     * machines that used to be an icon with no room for a label. This shows one
     * selected, so the picture carries both the symbol on the plan and the
     * panel naming it.
     */
    const tag = symbols[0]!;
    const shape = page.getByRole("button", { name: new RegExp(`^${tag},`) });
    await expect(shape).toBeVisible();
    await shape.click();
    await settled(page);

    await page.screenshot({ path: `${OUT}/device-symbol-selected-1440.png` });
  });

  test("the plan carries every state it can draw", async ({
    context,
    page,
  }) => {
    await useRole(context, "facilityManager");
    /*
     * **At 1024, and `fullPage` there means something.**
     *
     * This was taken at 1440 with `fullPage: true`, where the page fits inside
     * the viewport — so the flag changed nothing and the file came out **byte
     * for byte identical** to `plan-1440.png`. Two names, one picture, and the
     * name of the copy claimed something the other did not show. Caught by
     * hashing the set rather than by looking at it, which is the only way a
     * duplicate announces itself.
     *
     * 1024 is where it earns the flag: WA-121 moved the stacking breakpoint, so
     * the plan is full width with the rooms below it and the page is taller
     * than the viewport. This is the only shot of that layout, which is a
     * change this branch made and had no picture of.
     */
    await page.setViewportSize(VIEWPORTS.tablet);
    await openMap(page, "en");

    /*
     * The floor under the pictures above. They are evidence about legibility,
     * and legibility of a colour nothing draws is not a question — so this
     * fails rather than photographs a plan that happens to show one state.
     */
    const states = new Set(view.placed.map((one) => one.state));
    expect(
      states.size,
      "the plan draws fewer states than it has colours for",
    ).toBeGreaterThanOrEqual(4);

    await page.screenshot({
      path: `${OUT}/plan-every-state-1024.png`,
      fullPage: true,
    });
  });
});
