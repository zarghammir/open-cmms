import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { withoutServiceWorker } from "../fixtures/shell";
import { walkPrimaryFlow } from "../fixtures/primary-flow";
import { pinTheDay, screenshotDir, settled } from "../fixtures/screenshots";

/**
 * The flow, photographed at the three moments that carry the argument.
 *
 * These are not staged. The walk is the same function `primary-flow.spec.ts`
 * asserts against, called with a camera: the dashboard before the story, the
 * order's own trail once it is finished, and the dashboard after. A picture of
 * a flow that is not the tested flow would be a picture of nothing, and the
 * temptation to write a shorter second version for the camera is exactly how
 * that happens.
 *
 * Only the English run is photographed. The French half of the flow is proved
 * by the spec; a second set of pictures would double the cost of every future
 * change to the story for no extra evidence.
 */

const OUT = screenshotDir("WA-13");

test.beforeEach(async ({ page }) => {
  await pinTheDay(page);
  await withoutServiceWorker(page);
});

test.describe("screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  test("the primary flow, before and after", async ({ context, page }) => {
    test.slow();

    /*
     * A pair that agrees is a red, not a commit.
     *
     * `walkPrimaryFlow` already refuses the arithmetic: it asserts the open
     * count fell by exactly one and the low-stock count rose by exactly one,
     * and it does that before the "after" shutter, so a story that changed
     * nothing never reaches the second picture. This is the other half, and it
     * is the half numbers cannot answer — whether the two files differ at all.
     * Two identical dashboard photographs are a picture of the same screen
     * taken twice, which looks like proof of a property and is the opposite,
     * and it stays possible while the counts are right: a wrong route, a stale
     * paint, a camera pointed at the same moment twice.
     */
    const taken = new Map<string, string>();

    await walkPrimaryFlow(
      page,
      context,
      "en",
      async (name) => {
        /*
         * Let the toast go before the shutter.
         *
         * The first trail picture had "WO-… completed, 120 min recorded." lying
         * across the attachments panel — correct behaviour, and a blemish in a
         * picture meant to show the record. The DOM could not have told me: every
         * assertion was green. Looking at the picture is the only thing that
         * catches it.
         */
        await expect
          .poll(
            async () => page.locator("[data-sonner-toast]:visible").count(),
            {
              timeout: 20_000,
              message: "a toast was still on screen when the shutter opened",
            },
          )
          .toBe(0);
        await settled(page);
        const path = `${OUT}/${name}-1440.png`;
        await page.screenshot({
          path,
          fullPage: true,
          animations: "disabled",
        });
        taken.set(
          name,
          createHash("sha256").update(readFileSync(path)).digest("hex"),
        );
      },
      // See the note on the parameter: the waiting this run does makes the
      // browser's font-preload warning reachable, and it is reported rather
      // than filtered.
      false,
    );

    expect(
      [...taken.keys()],
      "the walk did not take the three pictures this spec is named for",
    ).toEqual([
      "dashboard-before",
      "trail-after-completion",
      "dashboard-after",
    ]);

    expect(
      taken.get("dashboard-after"),
      "dashboard-before and dashboard-after are byte-identical: the pair shows the same screen twice, so it proves nothing",
    ).not.toBe(taken.get("dashboard-before"));
  });
});
