import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
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
 * Every machine on the drawn floor is on the plan, and every one is reachable.
 *
 * The owner's finding was that the map marked two machines out of a site's
 * estate. The unit suite counts the markers against the records; this is the
 * half it cannot see — that each marker is drawn where a person can hit it,
 * that the one underneath a neighbour is still clickable, and that a keyboard
 * reaches all of them.
 *
 * Nothing here names a machine this file chose: the floor, its markers and
 * their states come out of the seed through the screen's own selector.
 */

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

const seed = buildSeed(new Date());
const today = toIsoDate(new Date());
const drawn = seed.floorPlans.find((plan) => plan.image !== null)!;
const drawnFloor = seed.locations.find((one) => one.id === drawn.floorId)!;
const view = floorMapView(seed, drawn.floorId, today);
const placed = view.placed;

function marker(page: Page, tag: string, state: string) {
  return page.getByRole("button", { name: `${tag}, ${state}` });
}

async function openMap(page: Page, locale: "en" | "fr") {
  await page.goto(`/${locale}/facilities/map/${drawnFloor.code}`);
  await hydrated(page);
}

for (const locale of ["en", "fr"] as const)
  for (const [label, viewport] of [
    ["1440", VIEWPORTS.desktop],
    ["1024", VIEWPORTS.tablet],
  ] as const) {
    test(`every machine on the floor is marked and hittable at ${label} in ${locale}`, async ({
      context,
      page,
    }) => {
      const strings = locale === "en" ? en : fr;
      await useRole(context, "facilityManager");
      const watcher = watchConsole(page);
      await page.setViewportSize(viewport);
      await openMap(page, locale);

      // The floor under it: this is about a floor with machines on it, and
      // two was the defect.
      expect(placed.length).toBeGreaterThanOrEqual(6);

      for (const one of placed) {
        const tag = one.asset!.assetTag;
        const found = marker(page, tag, strings.floorMap[one.state]);
        await expect(found, `${tag} has no marker`).toBeVisible();

        /*
         * Hittable, not merely present. Two markers can overlap on a plan —
         * the machines they stand for are next to each other — and a box drawn
         * under its neighbour is a machine a person cannot open. Playwright's
         * click fails when another element would take the hit, so this asserts
         * reachability rather than looking at coordinates.
         */
        await found.click();
        await expect(
          page.getByRole("region", { name: strings.floorMap.selectedTitle }),
        ).toContainText(tag);
      }

      expect(await hasHorizontalOverflow(page)).toBe(false);
      expect(watcher.errors).toEqual([]);
    });
  }

test("a marker names itself on hover and on focus, without saying it twice", async ({
  context,
  page,
}) => {
  /*
   * The tooltip exists for one reader: somebody with a pointer looking at a
   * marker too small to print its tag. Three of this floor's eight are that.
   *
   * **Both halves are pinned, because the division between them is the whole
   * design.** Radix wires its content as `aria-describedby`, so the accessible
   * name and the accessible description are two sentences a screen reader
   * reads one after the other. The name carries "tag, state"; the tooltip
   * carries the tag alone. Writing the sentence in both would have it read
   * twice, and nothing in the DOM would look wrong.
   */
  await useRole(context, "facilityManager");
  await page.setViewportSize(VIEWPORTS.desktop);
  await openMap(page, "en");

  const one = placed[0]!;
  const tag = one.asset!.assetTag;
  const found = marker(page, tag, en.floorMap[one.state]);
  await expect(found).toBeVisible();

  // Hover: the tooltip appears, in the DOM, where it can be read.
  await found.hover();
  const tip = page.getByRole("tooltip");
  await expect(tip).toBeVisible();
  await expect(tip).toHaveText(tag);

  // The two sentences, asserted apart.
  const described = await found.evaluate((node) => {
    const id = node.getAttribute("aria-describedby");
    const target = id ? document.getElementById(id) : null;
    return {
      name: node.getAttribute("aria-label"),
      describedby: id,
      description: target?.textContent ?? null,
    };
  });
  expect(described.name).toBe(`${tag}, ${en.floorMap[one.state]}`);
  /*
   * **The tag is announced once.** Radix wires its content as
   * `aria-describedby`, which had this button carrying the name "tag, state"
   * and a description resolving to the tag — the tag, the state, then the tag
   * again. The tooltip is drawn for a sighted reader who cannot read the box;
   * for a reader who cannot see the plan at all it is repetition, and the
   * division between name and tooltip existed to prevent exactly that.
   */
  expect(
    described.describedby,
    "the tooltip is wired into the announcement, so the tag is said twice",
  ).toBeNull();
  expect(described.description).toBeNull();
});

test("a marker names itself on focus, with no pointer involved", async ({
  context,
  page,
}) => {
  /*
   * Its own case, on a fresh page, because a keyboard user never hovers first.
   *
   * The first version asserted this at the end of the hover test: hover, read,
   * press Escape, move the pointer away, focus. It passed alone and failed
   * under the full suite, which is the shape of a race rather than a defect —
   * Radix treats Escape as a dismissal for the trigger that is still under the
   * pointer, so re-opening it depended on the order and timing of three
   * unrelated actions. Arriving the way the reader arrives removes the
   * interaction rather than waiting it out.
   */
  await useRole(context, "facilityManager");
  await page.setViewportSize(VIEWPORTS.desktop);
  await openMap(page, "en");

  const one = placed[0]!;
  const found = marker(page, one.asset!.assetTag, en.floorMap[one.state]);
  await expect(found).toBeVisible();

  await found.focus();
  const tip = page.getByRole("tooltip");
  await expect(tip).toBeVisible();
  await expect(tip).toHaveText(one.asset!.assetTag);

  // Same on focus as on hover: drawn, not announced.
  const described = await found.evaluate((node) => ({
    name: node.getAttribute("aria-label"),
    describedby: node.getAttribute("aria-describedby"),
  }));
  expect(described.name).toBe(
    `${one.asset!.assetTag}, ${en.floorMap[one.state]}`,
  );
  expect(described.describedby).toBeNull();
});

test("the map scans clean with a tooltip open", async ({ context, page }) => {
  /*
   * Its own scan, because a scan at rest cannot see this: the tooltip is
   * portalled and only exists while a marker is hovered or focused. A screen
   * scanned only as it loads is a screen scanned in one of its states — the
   * rule WA-49 was found by and the reason this is a separate case rather than
   * a line in the one that scans the plan.
   */
  await useRole(context, "facilityManager");
  await page.setViewportSize(VIEWPORTS.desktop);
  await openMap(page, "en");

  const one = placed[0]!;
  const found = marker(page, one.asset!.assetTag, en.floorMap[one.state]);
  await expect(found).toBeVisible();
  await found.hover();
  await expect(page.getByRole("tooltip")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations.map((one) => `${one.id}: ${one.impact}`)).toEqual(
    [],
  );
});

test("a keyboard reaches every marker, in the order the plan lists them", async ({
  context,
  page,
}) => {
  /*
   * The markers are a list of buttons, so tabbing through the plan should
   * arrive at each one once, in document order. A person who cannot use a
   * pointer has no other way onto the drawing.
   */
  await useRole(context, "facilityManager");
  await page.setViewportSize(VIEWPORTS.desktop);
  await openMap(page, "en");

  const first = marker(
    page,
    placed[0]!.asset!.assetTag,
    en.floorMap[placed[0]!.state],
  );
  await expect(first).toBeVisible();
  await first.focus();

  const reached: string[] = [];
  for (let index = 0; index < placed.length; index += 1) {
    const label = await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-label"),
    );
    if (label) reached.push(label.split(",")[0]!);
    await page.keyboard.press("Tab");
  }

  expect(reached).toEqual(placed.map((one) => one.asset!.assetTag));
});

/**
 * How big the footprints actually are, measured rather than remembered.
 *
 * **The comment this replaces was a number from a drawing that no longer
 * exists.** `floor-map.spec.ts` carried "the narrowest measured 24×48 at 1024"
 * as a reason for trusting the tap targets, written against WA-114's markers.
 * WA-121 re-traced every shape, so the sentence became a claim about a drawing
 * nobody has and no test could tell.
 *
 * So the number is taken here, at the widths the plan is drawn at, and the
 * criterion is asserted instead of recited. **WCAG 2.2 SC 2.5.8 Target Size
 * (Minimum) is 24×24 CSS pixels, AA.** The failure this catches is a footprint
 * that renders below it because the drawing scaled down further than the shape
 * can afford — which is a property of the plan's width on screen and cannot be
 * computed from metres alone.
 */
/**
 * **The criterion is 24; what ships is 26.**
 *
 * A figure clearing the bar by less than a pixel is not a pass in any durable
 * sense: browser rounding, a device pixel ratio, a zoom level or a font metric
 * nudging a container all move it, and the next person to touch this layout
 * would be standing on nine tenths of a pixel without knowing it. Not a
 * stricter reading of SC 2.5.8 — the criterion plus enough room that rounding
 * cannot decide the answer.
 *
 * Earned it: at 1280 side by side the smallest measured 24.8, over the
 * criterion and under this, which is what moved the stacking breakpoint.
 */
const FLOOR = 26;

for (const [label, viewport] of [
  ["1440", VIEWPORTS.desktop],
  // 1280 is where the plan and the room list sit side by side and the plan is
  // at its narrowest: the layout stacks below it, so this is the worst case for
  // a shape's rendered size and the width most likely to fail first.
  ["1280", { width: 1280, height: 900 }],
  ["1024", VIEWPORTS.tablet],
] as const) {
  test(`every footprint clears the AA target size at ${label}`, async ({
    context,
    page,
  }) => {
    await useRole(context, "facilityManager");
    await page.setViewportSize(viewport);
    await openMap(page, "en");

    const measured: string[] = [];
    const small: string[] = [];

    for (const one of placed) {
      const tag = one.asset!.assetTag;
      const shape = marker(page, tag, en.floorMap[one.state]);
      await expect(shape).toBeVisible();

      const box = (await shape.boundingBox())!;
      measured.push(
        `${tag} ${Math.round(box.width)}×${Math.round(box.height)}`,
      );
      if (box.width < FLOOR || box.height < FLOOR) small.push(measured.at(-1)!);
    }

    expect(
      small,
      `below ${FLOOR}×${FLOOR} at ${label}: ${small.join(", ")} — all: ${measured.join(", ")}`,
    ).toEqual([]);
  });
}

/**
 * The plan is a drawing, and the browser is where that stops being a claim.
 *
 * The unit suite asserts the committed SVG has no raster in it. That is the
 * file. This is the screen: the drawing has to actually load and paint, and an
 * SVG that fails to parse renders as nothing at all while every other assertion
 * on this page — markers, panels, names — goes on passing, because the markers
 * are drawn by the application and not by the picture.
 */
test("the drawing itself loads and has a size", async ({ context, page }) => {
  await useRole(context, "facilityManager");
  await page.setViewportSize(VIEWPORTS.desktop);
  await openMap(page, "en");

  const drawing = page.locator('[data-slot="floor-plan-image"]');
  await expect(drawing).toBeVisible();
  await expect(drawing).toHaveAttribute("src", /\.svg$/);

  /*
   * WAITED FOR, NOT SAMPLED. `toBeVisible` is true of an `img` element the
   * moment it is laid out, which is before the file has been fetched and
   * decoded — so reading `complete` straight afterwards asks a question the
   * browser has not finished answering. It passes alone and fails in a full
   * parallel run, which is the shape of a race rather than of a broken asset:
   * observed exactly that way here, red in the suite and green on its own.
   *
   * A test that reddens on how busy the machine is, rather than on whether
   * the drawing loads, costs more than it proves — somebody eventually deletes
   * it, and it was the only thing watching this.
   */
  await expect
    .poll(() => drawing.evaluate((node) => (node as HTMLImageElement).complete))
    .toBe(true);

  const painted = await drawing.evaluate((node) => {
    const image = node as HTMLImageElement;
    return {
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    };
  });

  // `complete` alone is true for a broken image, which is the trap: a 404 and a
  // drawing both finish loading. A natural size is what says something decoded.
  expect(painted.complete).toBe(true);
  /*
   * Against the record rather than a literal, on purpose. The claim here is
   * that the served asset is the drawing the records describe — a plan record
   * saying 1425 by 750 while the file is some other size puts every footprint
   * in the wrong place, and both halves would still look fine on their own.
   * The literal lives in `floor-drawing.test.ts`, where an unintended change to
   * the extent is the thing being caught. Two claims, neither redundant.
   */
  expect(painted.naturalWidth).toBe(drawn.image!.widthPx);
  expect(painted.naturalHeight).toBe(drawn.image!.heightPx);
});
