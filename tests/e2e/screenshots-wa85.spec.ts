import { expect, test } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import {
  hydrated,
  useRole,
  VIEWPORTS,
  withoutServiceWorker,
} from "../fixtures/shell";
import { failWritesFromNow, installSlowWrites } from "../fixtures/storage";
import { pinTheDay, screenshotDir, settled } from "../fixtures/screenshots";

/**
 * The picture for WA-85. Skipped unless WA_SCREENSHOTS=1.
 *
 * **Staged, and the pull request says so.** The write is forced to fail, which
 * is the only way to photograph a browser that has stopped keeping changes
 * while it is still showing everything else correctly.
 *
 * It is the state this ticket makes reachable at all. Before it, the notice
 * could only appear when the *boot* already knew — a private window, site data
 * blocked — and `docs/screenshots/WA-67/en-not-saving-1440.png` photographs
 * that one. This is the other case, and the one the notice was written for: a
 * person working normally, a change that did not stick, and a message that
 * stays on the screen rather than four seconds of toast.
 */
const OUT = screenshotDir("WA-85");

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

test.describe("WA-85 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  for (const { prefix, words } of [
    { prefix: "en", words: en },
    { prefix: "fr", words: fr },
  ] as const) {
    test(`the notice over a working screen, after a change did not stick (${prefix})`, async ({
      context,
      page,
    }) => {
      await pinTheDay(page);
      await page.setViewportSize(VIEWPORTS.desktop);
      await installSlowWrites(page);
      await useRole(context, "maintenanceCoordinator");
      await page.goto(`/${prefix}/work-orders`);
      await hydrated(page);

      await failWritesFromNow(page);
      await page
        .getByLabel(words.workOrderForm.fields.asset)
        .selectOption({ index: 1 });
      await page
        .getByLabel(words.workOrderForm.fields.title)
        .fill(
          prefix === "en"
            ? "Replace the supply fan belt"
            : "Remplacer la courroie du ventilateur",
        );
      await page
        .getByLabel(words.workOrderForm.fields.description)
        .fill(
          prefix === "en"
            ? "Belt is glazed and slipping under load."
            : "La courroie est lustrée et patine en charge.",
        );
      await page
        .getByRole("button", { name: words.workOrderForm.submit })
        .click();

      /*
       * Waited for, not timed. The notice is the subject of the picture, so a
       * shot taken before it arrives is a picture of the screen before the
       * ticket — which is exactly what an earlier WA-67 picture turned out to
       * be when it waited for the wrong thing.
       */
      const notice = page.locator('[data-slot="not-saving-banner"]');
      await expect(notice).toBeVisible({ timeout: 15_000 });

      /*
       * Back to the top, and this is the whole reason to look at a picture
       * rather than trust the assertion above it.
       *
       * The first version of this shot asserted the notice was visible and
       * photographed a screen without it. Both are true at once: the notice is
       * at the top of the page, `toBeVisible` does not care where the viewport
       * is, and the form had scrolled itself down because WA-67 restores focus
       * to the field a person was in. A correct assertion over a useless
       * picture.
       */
      // Both messages, before anything is photographed: the standing notice
      // and the per-change toast are the two halves of what this ticket does,
      // and a picture of one of them is half the evidence.
      await expect(
        page.getByText(words.states.saving.failedTitle),
      ).toBeVisible();
      await settled(page);

      /*
       * Then wait for the screen to stop moving, and only then scroll.
       *
       * Two measured reasons, in this order. The toast slides in, so a shot
       * taken while it is arriving catches it part-way — three runs gave two
       * hashes, and the odd one out was the toast a few pixels short.
       * `getAnimations()` is the browser's own answer to "is anything still
       * moving", rather than a timeout picked to look long enough.
       *
       * **That fixed what a reader can see, and not the hash.** Measured over
       * seven runs after this wait was in place: the English shot still lands
       * on two different hashes, 4 and 3, differing in twelve bytes of 3.9 MB
       * — a handful of pixels, each one colour level apart. Nobody looking at
       * the two files can tell them apart, and the state photographed is the
       * one the test claims.
       *
       * So the picture is trustworthy and **its hash is not an identity for
       * it**. Nothing should gate on hashing this file: a byte comparison
       * would go red for a difference no person could see or act on, which is
       * the kind of check somebody eventually silences rather than reads. An
       * earlier version of this branch's pull request said "three runs, one
       * hash" — three runs was too small a sample to say it.
       *
       * And the scroll has to come *after* settling, not before. WA-67 puts
       * focus back in the field a person was typing in when the save finishes,
       * which scrolls the form into view — so a scroll issued first is undone
       * a moment later, and the first version of this test asserted a notice
       * that had left the viewport again by the time the shutter opened.
       */
      await page.waitForFunction(() =>
        document
          .getAnimations()
          .every((animation) => animation.playState !== "running"),
      );
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(
        notice,
        "the notice is on the page but not in the picture",
      ).toBeInViewport();
      await page.screenshot({ path: `${OUT}/${prefix}-not-saving-1440.png` });
    });
  }
});
