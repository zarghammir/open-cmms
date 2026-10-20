import { expect, test, type Page } from "@playwright/test";
import { buildSeed } from "@/data/seed";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import {
  VIEWPORTS,
  hydrated,
  useRole,
  watchConsole,
  withoutServiceWorker,
} from "../fixtures/shell";

/**
 * The map of the place, used the way a person uses it.
 *
 * Every wait here is on **something this screen draws** — a site code, a room's
 * equipment — never on the shell's own marker. The shell is present before the
 * store has answered, so a test that waits for it and then clicks is waiting
 * for markup and acting on a handler that does not exist yet.
 */

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

const seed = buildSeed(new Date());
const FIRST_SITE = [...seed.facilities].sort((a, b) =>
  a.code.localeCompare(b.code),
)[0]!;

async function openFacilities(page: Page, locale: "en" | "fr" = "en") {
  await page.goto(`/${locale}/facilities`);
  await hydrated(page);
  // The screen's own content: a site code the tree drew.
  await expect(
    page.getByText(FIRST_SITE.code, { exact: false }).first(),
  ).toBeVisible();
}

for (const locale of ["en", "fr"] as const)
  for (const [label, viewport] of [
    ["1440", VIEWPORTS.desktop],
    ["1024", VIEWPORTS.tablet],
  ] as const) {
    test(`the tree opens down to a room's equipment at ${label} in ${locale}`, async ({
      context,
      page,
    }) => {
      await useRole(context, "maintenanceCoordinator");
      const watcher = watchConsole(page);
      await page.setViewportSize(viewport);
      await openFacilities(page, locale);

      // Every site is a closed disclosure until somebody opens it.
      const summaries = page.locator("summary");
      expect(await summaries.count()).toBeGreaterThanOrEqual(5);

      // Open the first site, then the first building, then the first floor,
      // then the first room: four levels, which is the whole claim.
      for (let depth = 0; depth < 4; depth += 1) {
        const next = page.locator("details:not([open]) > summary").first();
        await expect(next).toBeVisible();
        await next.click();
      }

      // A room that holds equipment shows a link to the asset register; one
      // that holds none says so in words rather than showing an empty list.
      const strings = locale === "en" ? en : fr;
      const openedRoomHasContent =
        (await page.getByText(strings.facilities.roomEmptyTitle).count()) > 0 ||
        (await page.locator('a[href*="/assets/"]').count()) > 0;
      expect(
        openedRoomHasContent,
        "a room opened to neither equipment nor the named empty state",
      ).toBe(true);

      expect(watcher.errors).toEqual([]);
    });
  }

test.describe("the facilities tree", () => {
  test("shows the count the records support, not a zero", async ({
    context,
    page,
  }) => {
    /*
     * The number that makes a site row worth reading, checked against the seed
     * rather than against itself. Equipment is filed against rooms, so a site
     * counting only what is filed directly on it reads zero everywhere — and a
     * zero that is always a zero looks like data rather than like a bug.
     *
     * The expected figure is computed here from the same records the browser
     * seeded itself with, which is what makes this a check on the screen and
     * not a check that the screen agrees with the screen.
     */
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await openFacilities(page);

    const rooms = new Set(
      seed.locations
        .filter((one) => one.facilityId === FIRST_SITE.id)
        .map((one) => one.id),
    );
    const expected = seed.assets.filter((asset) =>
      rooms.has(asset.locationId),
    ).length;
    expect(
      expected,
      "the first site holds no equipment in this seed",
    ).toBeGreaterThan(0);

    /*
     * The equipment badge, not the whole row. Asserting the number appears
     * anywhere in the summary would pass with an equipment count of 0 beside
     * an open-work count that happened to equal the expected figure — the row
     * carries both numbers, and only one of them is this assertion's business.
     */
    await expect(
      page.locator('summary [data-slot="badge"]').first(),
    ).toContainText(String(expected));
  });

  test("opens and closes by keyboard, and the focus is visible", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await openFacilities(page);

    const first = page.locator("summary").first();
    await first.focus();
    await expect(first).toBeFocused();

    const outline = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      if (!active) return null;
      const style = getComputedStyle(active);
      return `${style.outlineStyle}|${style.outlineWidth}|${style.boxShadow}`;
    });
    expect(outline).not.toBeNull();
    expect(outline === "none|0px|none").toBe(false);

    // Enter opens a disclosure, Enter closes it. Asserted on the element's own
    // state rather than on what appeared, because what appears depends on the
    // seed and the state does not.
    const details = page.locator("details").first();
    expect(
      await details.evaluate((node) => (node as HTMLDetailsElement).open),
    ).toBe(false);
    await page.keyboard.press("Enter");
    expect(
      await details.evaluate((node) => (node as HTMLDetailsElement).open),
    ).toBe(true);
    await page.keyboard.press("Enter");
    expect(
      await details.evaluate((node) => (node as HTMLDetailsElement).open),
    ).toBe(false);
  });
});
