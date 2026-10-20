import { expect, test } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import {
  hydrated,
  useRole,
  VIEWPORTS,
  withoutServiceWorker,
} from "../fixtures/shell";
import {
  holdWritesOpen,
  installSlowWrites,
  withoutStorage,
} from "../fixtures/storage";
import { pinTheDay, screenshotDir } from "../fixtures/screenshots";

/**
 * The pictures for WA-67. Skipped unless WA_SCREENSHOTS=1.
 *
 * **Both of these are staged, and the pull request says so under each one.**
 * They photograph states the application works hard to make rare: "Saving…"
 * lasts milliseconds on a healthy machine, and the standing notice appears only
 * when the browser has actually refused to keep something. Neither could be
 * photographed by waiting for it.
 *
 * So the instruments produce them — the write held back three seconds, the read
 * forced to fail — and the picture is true about the *state* while saying
 * nothing about how long a person would see it. A caption carries that, because
 * an uncaptioned picture of a three-second button would tell a reader the
 * application is slow, which is the opposite of what this ticket did.
 *
 * `settled()` is deliberately not used here: it waits for no skeleton and for
 * fonts, and one of these screens is mid-write by construction. These two wait
 * for the exact element they are about instead.
 */
const OUT = screenshotDir("WA-67");

/** The catalogue a locale reads from. */
const words = (locale: "en" | "fr") => (locale === "en" ? en : fr);

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

test.describe("WA-67 screenshots", () => {
  test.skip(!process.env.WA_SCREENSHOTS, "set WA_SCREENSHOTS=1 to capture");

  /*
   * Both languages, and the French one is not a formality here.
   *
   * The review found five of the eight controls dead but looking live — the
   * vendored `Input` carried disabled styling and this project's own `Select`
   * and `Textarea` carried none. That is a *styling* defect, so it is exactly
   * the kind a single-language picture hides: the French screen renders the
   * same components with longer labels, and "it looked right in English" is
   * not evidence about it.
   */
  for (const locale of ["en", "fr"] as const) {
    test(`the button says it is saving, and means it (${locale})`, async ({
      context,
      page,
    }) => {
      /*
       * Raising an order rather than cancelling a named one.
       *
       * The first draft cancelled an order it had looked up in the seed by name,
       * before the browser was open — and AGENTS.md says not to: a browser test
       * picks what the screen shows. It bit exactly as written down. On the
       * second run that order was already cancelled and the control was not
       * offered at all. A form needs no existing record, which removes the
       * question rather than answering it.
       */
      await page.setViewportSize(VIEWPORTS.desktop);
      await installSlowWrites(page);
      await useRole(context, "maintenanceCoordinator");
      await page.goto(`/${locale}/work-orders`);
      await hydrated(page);

      await page
        .getByLabel(words(locale).workOrderForm.fields.asset)
        .selectOption({ index: 1 });
      await page
        .getByLabel(words(locale).workOrderForm.fields.title)
        .fill(
          locale === "en"
            ? "Replace the supply fan belt"
            : "Remplacer la courroie du ventilateur",
        );
      await page
        .getByLabel(words(locale).workOrderForm.fields.description)
        /*
         * Typed in the reader's language, and only because this is a picture.
         *
         * The application is right to keep a person's words in the language they
         * wrote them — AGENTS.md is explicit that typed content is never
         * translated — so English text on a French form is correct behaviour.
         * It is also indistinguishable, in a still image, from a screen that
         * failed to translate. The picture is for someone who will not read this
         * comment.
         */
        .fill(
          locale === "en"
            ? "Belt is glazed and slipping under load."
            : "La courroie est lustrée et patine en charge.",
        );

      // Held from here, so the only write in flight is the one photographed.
      // Held rather than delayed on a timer: measured, a timer is defeated by the
      // pinned clock a screenshot run installs — `held: 0` with the pin, `held: 1`
      // without it. This spec therefore does not pin, and the body says the two
      // pictures are not date-stable for that reason.
      await holdWritesOpen(page);
      await page
        .getByRole("button", { name: words(locale).workOrderForm.submit })
        .click();

      const submitting = page.getByRole("button", {
        name: words(locale).states.saving.label,
      });
      await expect(submitting).toBeVisible();
      await page.screenshot({ path: `${OUT}/${locale}-saving-1440.png` });
    });
  }

  test("the standing notice when this device stopped keeping things", async ({
    context,
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await useRole(context, "maintenanceCoordinator");

    /*
     * Re-staged by WA-66, and the reason is worth the paragraph.
     *
     * This picture used to be taken by forcing the boot **read** to fail and
     * reloading. That produced the notice, and underneath it a screen of
     * skeletons — WA-66's defect, named in the caption at the time. WA-66 then
     * fixed that defect by replacing the page with a named refusal whenever
     * the records cannot be read, and the notice lives *inside* the passing
     * branch, deliberately: two notices about the same browser, side by side,
     * would be worse than one. So the old staging stopped producing this
     * picture at all — the test failed on a quiet machine, deterministically,
     * and only CI's screenshot step ran it, because the suite skips this file.
     *
     * The state now staged is the one the notice actually exists for and the
     * only one in which it can be photographed over a **working** application:
     * a browser that stores nothing at all. A private window, or site data
     * blocked for this site. Every screen works, the records are seeded into
     * memory, and none of it will be here next time — which is exactly what
     * the words in the picture say.
     *
     * It is not a failed write after a healthy boot, which is what a reader
     * might assume from the wording. That state is measured on WA-66's pull
     * request and it does **not** raise this notice: `durable` is copied into
     * the store once, at rehydration, and a later write failure never reaches
     * it. A defect in the notice, recorded there, and not something a picture
     * can be staged on until it is fixed.
     */
    /*
     * And the day is pinned for this one, which it could not be before.
     *
     * The spec as a whole does not pin, because `page.clock.setFixedTime`
     * defeated the timer the saving pictures were staged with — measured,
     * `held: 0` pinned against `held: 1` unpinned. That reason never applied
     * here: this case holds nothing. It simply inherited the decision.
     *
     * It matters more now than it did. The old staging photographed a screen
     * of skeletons, which carries no dates; this one photographs a working
     * dashboard, with five counts and a list of overdue work, every one of
     * which moves with the day the seed is built from.
     *
     * **It does not pin the date line above the heading, and nothing can.**
     * `ModuleScreen` is an async server component and renders `showToday` from
     * `new Date()` on the server, where Playwright's clock does not reach. So
     * this picture, like every other pinned picture of a home screen, carries
     * the day it was last regenerated above records built for the pinned day —
     * `docs/screenshots/WA-9/desk-dashboard-1440.png` says Monday 14 September
     * over records dated the 15th, and has for as long as it has been tracked.
     * That is a real gap and it is recorded on WA-66's pull request rather than
     * widened here: `pinned-day.spec.ts` asserts the pin reaches the records,
     * which it does, and nothing asserts the one thing it cannot reach.
     *
     * Pinning is still the right half to have. Unpinned, every count and every
     * "35 days late" moves too, and one drifting line is a diff a reader can
     * still read.
     */
    await pinTheDay(page);
    await withoutStorage(page);
    await page.goto("/en/dashboard");
    await hydrated(page);

    const notice = page.locator('[data-slot="not-saving-banner"]');
    await expect(notice).toBeVisible({ timeout: 15_000 });

    /*
     * And then wait for the page beneath it, which is a separate arrival.
     *
     * Measured, not anticipated. Retaking this picture on a commit that cannot
     * touch the dashboard produced a visibly different one: the first had the
     * page — heading, date, the five tiles, the panels — with skeletons inside
     * it; the second had the notice sitting above six bare grey bars, because
     * the shot fired before the dashboard's own frame had rendered. The banner
     * lives in the shell and arrives first, so waiting for it says nothing
     * about what is under it, and the picture was being chosen by whichever
     * render the machine happened to reach.
     *
     * The heading is the anchor because it is the page itself rather than its
     * contents. Kept through the re-staging: the reason it exists — the shell
     * arrives before the page under it — is a property of the shell, not of
     * whichever state is being photographed, and the three-runs-one-hash proof
     * is what says it still holds.
     */
    await expect(
      page.getByRole("heading", { level: 1 }),
      "the dashboard's own frame never arrived, so the picture would show the shell alone",
    ).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `${OUT}/en-not-saving-1440.png` });
  });
});
