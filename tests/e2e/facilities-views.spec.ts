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
 * Facilities read two ways, from the one switch.
 *
 * The tree and the plan are two views of one set of records, so the thing to
 * test is that the switch really lands on each of them and that each is usable
 * at the width it is meant for. Nothing here names a record this file chose:
 * the floor and the machine come out of the seed through the screen's own
 * selector.
 *
 * The switch is located by its `data-slot`, not by a group role with its
 * label: Radix renders a single-choice ToggleGroup as a `radiogroup` whose
 * items are radios, so `getByRole("group", { name })` matches nothing at all.
 * The maintenance module's spec had already learnt this; this one repeated the
 * guess and spent a window's first seven reds on it.
 */

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

const seed = buildSeed(new Date());
const today = toIsoDate(new Date());
const drawn = seed.floorPlans.find((plan) => plan.image !== null)!;
const drawnFloor = seed.locations.find((one) => one.id === drawn.floorId)!;
const view = floorMapView(seed, drawn.floorId, today);
const aMachine = view.placed[0]!;

async function openFacilities(page: Page, locale: "en" | "fr") {
  await page.goto(`/${locale}/facilities`);
  await hydrated(page);
}

function marker(page: Page, tag: string, state: string) {
  return page.getByRole("button", { name: `${tag}, ${state}` });
}

for (const locale of ["en", "fr"] as const)
  for (const [label, viewport] of [
    ["1440", VIEWPORTS.desktop],
    ["1024", VIEWPORTS.tablet],
  ] as const) {
    test(`the switch reaches the plan at ${label} in ${locale}`, async ({
      context,
      page,
    }) => {
      const strings = locale === "en" ? en : fr;
      await useRole(context, "facilityManager");
      const watcher = watchConsole(page);
      await page.setViewportSize(viewport);
      await openFacilities(page, locale);

      /*
       * The List is what the module opens on: a site code the tree drew.
       *
       * `exact: true`, and that is not fussiness. A loose match is
       * case-insensitive and by substring, so "KGN" matches the French word
       * "Hotte" — in `Hotte de laboratoire sur paillasse` — inside a collapsed
       * `<details>`, and the assertion then waits ten seconds for a hidden
       * element it was never looking for. The English run passed throughout.
       */
      await expect(
        page.getByText(seed.facilities[0]!.code, { exact: true }).first(),
      ).toBeVisible();

      await page
        .locator('[data-slot="facilities-views"]')
        .getByRole("radio", { name: strings.facilities.viewMap })
        .click();

      // The plan itself, and a marker the store drew on it.
      await expect(
        page.getByAltText(
          strings.floorMap.planAlt.replace("{floor}", drawnFloor.code),
        ),
      ).toBeVisible();
      await expect(
        marker(
          page,
          aMachine.asset!.assetTag,
          strings.floorMap[aMachine.state],
        ),
      ).toBeVisible();

      /*
       * The picker is not drawn, and that is asserted as a count rather than
       * looked at: one drawing is on file, and a select offering a single
       * answer is a control nobody can use.
       */
      expect(
        seed.floorPlans.filter((plan) => plan.image !== null),
      ).toHaveLength(1);
      await expect(page.locator("#facilities-map-floor")).toHaveCount(0);

      expect(await hasHorizontalOverflow(page)).toBe(false);
      expect(watcher.errors).toEqual([]);
    });
  }

for (const locale of ["en", "fr"] as const) {
  test(`at 390 the switch answers with the rooms, in ${locale}`, async ({
    context,
    page,
  }) => {
    /*
     * The ticket's decision, seen rather than assumed: a plan at this width is
     * smaller than the machines on it, so Map draws the sentence saying which
     * width the plan starts at and the rooms underneath — an answer, not a
     * missing control.
     */
    const strings = locale === "en" ? en : fr;
    await useRole(context, "facilityManager");
    const watcher = watchConsole(page);
    await page.setViewportSize(VIEWPORTS.phone);
    await openFacilities(page, locale);

    await page
      .locator('[data-slot="facilities-views"]')
      .getByRole("radio", { name: strings.facilities.viewMap })
      .click();

    await expect(page.getByText(strings.floorMap.onPhoneTitle)).toBeVisible();
    await expect(
      page.getByAltText(
        strings.floorMap.planAlt.replace("{floor}", drawnFloor.code),
      ),
    ).toHaveCount(0);

    // The rooms are there instead, which is the whole point of the answer.
    // Exact, for the reason given above: "KGN" is inside "Hotte".
    await expect(
      page.getByText(seed.facilities[0]!.code, { exact: true }).first(),
    ).toBeVisible();

    expect(await hasHorizontalOverflow(page)).toBe(false);
    expect(watcher.errors).toEqual([]);
  });
}

test("the map reached through the switch scans clean with a machine selected", async ({
  context,
  page,
}) => {
  await useRole(context, "facilityManager");
  await page.setViewportSize(VIEWPORTS.desktop);
  await openFacilities(page, "en");

  await page
    .locator('[data-slot="facilities-views"]')
    .getByRole("radio", { name: en.facilities.viewMap })
    .click();

  const one = marker(
    page,
    aMachine.asset!.assetTag,
    en.floorMap[aMachine.state],
  );
  await expect(one).toBeVisible();
  await one.click();
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
