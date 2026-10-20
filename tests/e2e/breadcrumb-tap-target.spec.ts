import { expect, test } from "@playwright/test";
import {
  hydrated,
  useRole,
  VIEWPORTS,
  withoutServiceWorker,
} from "../fixtures/shell";

/**
 * The breadcrumb is big enough to press with a thumb.
 *
 * Twenty-four pixels, measured at the phone width, on every screen a
 * breadcrumb appears on and in both languages. Found by the WA-23 responsive
 * pass: of 534 controls measured at 390, this one was 19.5 px tall on twelve
 * screens — the one small target a person meets on *every* screen.
 *
 * **What this is not.** The tender names WCAG 2.1 AA, which has no target-size
 * criterion: 2.5.5 is AAA at 44 px and the 24 px floor is WCAG 2.2's 2.5.8. So
 * nothing here is a failure of the named standard, and the number is not
 * pretending to be one. It is a thumb, in a plant room, on a control that is
 * always there.
 *
 * The other small targets that pass explain themselves and are deliberately
 * not covered: the skip link is off-screen until focused, the file inputs are
 * hidden by design, and an order number inside a card is a second way into a
 * row that is itself 44 px.
 */

const FLOOR = 24;

/**
 * Screens a breadcrumb appears on.
 *
 * The desk shell only. `FieldShell` has no breadcrumb at all — its header is
 * the navigation sheet, the wordmark and the session controls — so a field
 * screen in this list would have measured nothing and quietly lowered the
 * floor below. Checked rather than assumed: `grep -c Breadcrumb` is 2 in
 * `app-header.tsx` and 0 in `field-shell.tsx`.
 */
const SCREENS = ["work-orders", "assets", "inventory", "documents"] as const;

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

for (const locale of ["en", "fr"] as const) {
  test(`every breadcrumb link is at least ${FLOOR}px tall at 390 (${locale})`, async ({
    context,
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.phone);
    // Asserted rather than assumed: a measurement that silently ran at the
    // project's default width would be a desk measurement with a phone's name.
    expect(page.viewportSize()).toEqual(VIEWPORTS.phone);

    /*
     * The role is set once, outside the loop, and not only because the lint
     * rule for React hooks fires on a helper whose name begins with "use".
     * Every screen below belongs to the desk shell and one role opens all of
     * them, so setting it per screen was describing a variation that does not
     * exist.
     */
    await useRole(context, "maintenanceCoordinator");
    let measured = 0;

    for (const path of SCREENS) {
      await page.goto(`/${locale}/${path}`);
      await hydrated(page);

      const links = page.locator(
        '[data-slot="breadcrumb-link"], [data-slot="breadcrumb-page"]',
      );
      const count = await links.count();

      for (let index = 0; index < count; index += 1) {
        const box = await links.nth(index).boundingBox();
        if (!box) continue;
        measured += 1;
        expect(
          box.height,
          `${locale}/${path}: a breadcrumb target is ${box.height}px tall`,
        ).toBeGreaterThanOrEqual(FLOOR);
      }
    }

    /*
     * The floor for the test itself, and it is the assertion that makes the
     * rest mean anything: a selector that matched nothing, a shell that
     * stopped drawing breadcrumbs, or five screens that all 404'd would leave
     * every assertion above unexecuted and this test green.
     *
     * Two per screen — the home link and the current page — across four desk
     * screens, minus the home link on any screen that does not show one.
     */
    expect(
      measured,
      "no breadcrumb target was measured at all",
    ).toBeGreaterThan(5);
  });
}
