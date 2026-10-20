import { expect, test } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { VIEWPORTS, hydrated, useRole, watchConsole } from "../fixtures/shell";
import { pinTheDay, screenshotDir, settled } from "../fixtures/screenshots";

/**
 * The pictures for WA-38 part 1, and the click-through that produces them.
 * Skipped unless WA_SCREENSHOTS=1.
 */
// Every picture is dated, so a run on a different day regenerates every file
// for no reason anybody can read in a diff. The clock is fixed before anything
// loads, because the records are built during the boot that follows.
test.beforeEach(async ({ page }) => {
  await pinTheDay(page);
});

const OUT = screenshotDir("WA-38");

test.describe("WA-38 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  test("the queue at three widths, both languages", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    const watcher = watchConsole(page);

    for (const locale of ["en", "fr"]) {
      for (const size of Object.values(VIEWPORTS)) {
        await page.setViewportSize(size);
        await page.goto(`/${locale}/work-orders`);
        await expect(
          page.getByRole("searchbox", {
            name:
              locale === "fr"
                ? fr.workOrderQueue.searchLabel
                : en.workOrderQueue.searchLabel,
          }),
        ).toBeVisible();
        await settled(page);
        await page.screenshot({
          path: `${OUT}/${locale}-queue-${size.width}.png`,
          animations: "disabled",
        });
      }
    }

    expect(watcher.errors).toEqual([]);
  });

  test("a facet open, a narrowed queue, and a search that finds nothing", async ({
    context,
    page,
  }) => {
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);

    await page.goto("/en/work-orders");
    await hydrated(page);
    await page
      .getByRole("button", {
        name: en.workOrderQueue.facets.filterBy.replace(
          "{facet}",
          en.workOrderQueue.columns.status,
        ),
      })
      .click();
    await expect(page.getByRole("menuitemcheckbox").first()).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/queue-facet-open-1440.png`,
      animations: "disabled",
    });
    await page.keyboard.press("Escape");

    await page.goto("/en/work-orders?status=open,assigned&priority=critical");
    await expect(page.getByRole("table")).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/queue-narrowed-1440.png`,
      animations: "disabled",
    });

    // The state that was showing the module placeholder until this ticket.
    await page.goto("/en/work-orders?q=zzzz-no-such-thing");
    await expect(page.getByText(en.states.noResults.title)).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/queue-no-matches-1440.png`,
      animations: "disabled",
    });

    // The crew-code-only rows, which is the three-state distinction on screen.
    await page.goto("/en/work-orders?assignee=crew");
    await expect(page.getByText("CONT01").first()).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${OUT}/queue-crew-1440.png`,
      animations: "disabled",
    });
  });
});
