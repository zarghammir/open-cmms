import { expect, test, type Locator, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import {
  VIEWPORTS,
  hydrated,
  useRole,
  withoutServiceWorker,
} from "../fixtures/shell";
import { pinTheDay, screenshotDir, settled } from "../fixtures/screenshots";

test.beforeEach(async ({ page }) => {
  await pinTheDay(page);
  await withoutServiceWorker(page);
});

/**
 * WA-113's own evidence: the pressed state, before and after.
 *
 * Two of the five call sites, at the width the recording uses, in both
 * languages — the language switch because it is in the header of every screen,
 * and the reports selector because it is the one where "which of these four am
 * I looking at" is the whole question.
 *
 * **The phase is an argument, not a second spec.** `WA_SHOT_PHASE=before` with
 * the tint restored and `after` with the fill produces two sets from one file,
 * so the pair cannot drift apart in the way two copies of a capture do.
 *
 * Deliberately narrow. This change repaints the switch in roughly half the
 * tracked pictures, and regenerating them belongs in one pass after the owner
 * rules between the fill and a border-plus-check — the pull request names them
 * as stale rather than moving them twice.
 */
const OUT = screenshotDir("WA-113");
const PHASE = process.env.WA_SHOT_PHASE === "before" ? "before" : "after";

/** The vendored group, picked by its accessible name so the shot is the control. */
function toggleGroup(page: Page, name: string): Locator {
  return page.locator('[data-slot="toggle-group"]').filter({
    has: page.locator(`[aria-label="${name}"], :scope[aria-label="${name}"]`),
  });
}

async function shoot(target: Locator, file: string) {
  await expect(target).toBeVisible();
  await target.screenshot({
    path: `${OUT}/${PHASE}-${file}`,
    animations: "disabled",
  });
}

test.describe("WA-113 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  for (const locale of ["en", "fr"] as const) {
    test(`the language switch at 1440, in ${locale}`, async ({
      context,
      page,
    }) => {
      const strings = locale === "en" ? en : fr;
      await useRole(context, "facilityManager");
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.goto(`/${locale}/dashboard`);
      await hydrated(page);
      await settled(page);

      // By its own role and label: the switcher sets `role="radiogroup"`
      // explicitly, which is what makes it addressable this way.
      const switcher = page.getByRole("radiogroup", {
        name: strings.shell.language.label,
      });
      await shoot(switcher, `language-switch-${locale}-1440.png`);
    });

    test(`the reports selector at 1440, in ${locale}`, async ({
      context,
      page,
    }) => {
      const strings = locale === "en" ? en : fr;
      await useRole(context, "facilityManager");
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.goto(`/${locale}/reports`);
      await hydrated(page);
      await settled(page);

      await shoot(
        toggleGroup(page, strings.reports.choose),
        `reports-selector-${locale}-1440.png`,
      );
    });
  }
});
