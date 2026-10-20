import { expect, test } from "@playwright/test";
import { VIEWPORTS, useRole } from "../fixtures/shell";
import { pinTheDay, screenshotDir, settled } from "../fixtures/screenshots";

/**
 * The three screens that used to carry the foundation placeholders, after the
 * placeholders are gone. Skipped unless WA_SCREENSHOTS=1.
 *
 * A deletion cannot be proved by a typecheck — nothing imported these, so
 * removing them could not break a compile — and it cannot be proved by the
 * unit count staying the same, which only says no test referenced them. It is
 * proved by the screens still rendering, which is what these are.
 */
// Every picture is dated, so a run on a different day regenerates every file
// for no reason anybody can read in a diff. The clock is fixed before anything
// loads, because the records are built during the boot that follows.
test.beforeEach(async ({ page }) => {
  await pinTheDay(page);
});

const OUT = screenshotDir("WA-31");

const SCREENS = [
  { name: "dashboard", path: "/dashboard", role: "administrator" },
  { name: "field-home", path: "/my-work", role: "technician" },
  { name: "settings", path: "/settings", role: "administrator" },
];

test.describe("WA-31 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  for (const screen of SCREENS) {
    for (const locale of ["en", "fr"]) {
      test(`${screen.name} in ${locale}`, async ({ context, page }) => {
        await useRole(context, screen.role);

        for (const size of [VIEWPORTS.desktop, VIEWPORTS.phone]) {
          await page.setViewportSize(size);
          await page.goto(`/${locale}${screen.path}`);
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          await page.waitForTimeout(400);
          await settled(page);
          await page.screenshot({
            path: `${OUT}/${locale}-${screen.name}-${size.width}.png`,
            fullPage: true,
            animations: "disabled",
          });
        }
      });
    }
  }
});
