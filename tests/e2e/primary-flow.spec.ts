import { test } from "@playwright/test";
import { withoutServiceWorker } from "../fixtures/shell";
import { walkPrimaryFlow } from "../fixtures/primary-flow";

/**
 * One completion, moving every screen that should move.
 *
 * The walk itself lives in `tests/fixtures/primary-flow.ts` so that the
 * screenshot spec photographs the same story rather than a second one written
 * to look like it. A picture of a flow that is not the tested flow is worse
 * than no picture.
 */

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

test.describe("the primary flow", () => {
  test("one completion moves every screen that owns a part of it", async ({
    context,
    page,
  }) => {
    test.slow();
    await walkPrimaryFlow(page, context, "en");
  });

  test("the same flow in French moves the same numbers", async ({
    context,
    page,
  }) => {
    test.slow();
    await walkPrimaryFlow(page, context, "fr");
  });
});
