import { expect, type Page } from "@playwright/test";
import { hydrated } from "./shell";

/**
 * Where a screenshot run writes.
 *
 * One place, read by all eight specs, because continuous integration has to be
 * able to run them without changing a tracked file. Before this, every spec
 * wrote its folder path out by hand, so the only way to run them in CI was to
 * let them write into `docs/screenshots` and then check nothing had changed —
 * which turns every legitimate regeneration into a red build.
 *
 * The default is the tracked folder, so running them by hand still refreshes
 * the pictures in the repository exactly as before. CI points the root at a
 * temporary directory it throws away, and what it gets out of the run is the
 * only thing it wanted: whether the spec passes.
 *
 * That was the whole gap. The specs are skipped unless `WA_SCREENSHOTS` is set
 * and nothing set it, so a green build on a pull request that changed only a
 * screenshot spec meant "CI did not look" — which is how WA-42's breakage sat
 * on main unnoticed.
 */
const ROOT = process.env.WA_SCREENSHOT_ROOT ?? "docs/screenshots";

/** The folder one ticket's pictures belong in, e.g. `screenshotDir("WA-25")`. */
export function screenshotDir(ticket: string): string {
  return `${ROOT}/${ticket}`;
}

/**
 * The day a screenshot run pretends it is.
 *
 * `buildSeed(today)` dates every record as an offset from the day it is given,
 * and the application gives it `new Date()`. So the same screen photographed on
 * two days produces two different pictures — not because anything changed, but
 * because every due date, every timestamp and every "3 days overdue" moved by
 * one. Regenerating the folder today moves 76 tracked PNGs, measured, almost
 * all of it dates.
 *
 * A diff nobody can read is a diff nobody reads. The point of keeping the
 * pictures in the repository is that a reviewer can see what a change did to a
 * screen, and that only works if a screen that did not change produces the
 * bytes it produced last time.
 *
 * So a screenshot run fixes the clock. `setFixedTime` makes `Date.now()` and
 * `new Date()` return this instant while leaving timers running, so hydration,
 * waits and animations behave exactly as they do in a real run — the
 * application is not modified, and the pictures still come from the build a
 * reviewer would run.
 *
 * Noon UTC, because the records are dated by calendar day and every screen
 * renders in America/Toronto: midnight UTC is the day before there, and the
 * whole seed would slide by a day depending on how the instant was written.
 *
 * Changing this date regenerates every picture once, which is the cost of
 * moving it and the reason it is written down here rather than passed in.
 */
export const PINNED_DAY = new Date("2026-09-15T12:00:00.000Z");

/**
 * Fixes the clock before anything loads.
 *
 * It has to happen before the first navigation: the seed is built during the
 * boot that follows, and a clock fixed afterwards would pin the timestamps a
 * screen renders while leaving the records themselves dated from the real day.
 * That is the shape of a half-pinned run — stable in the parts a test looks at
 * and moving in the parts a reviewer looks at.
 */
export async function pinTheDay(page: Page): Promise<void> {
  await page.clock.setFixedTime(PINNED_DAY);
}

/**
 * Waits until the screen has finished drawing, before it is photographed.
 *
 * A screenshot run is the one kind of test that cannot assert its way out of
 * this. An ordinary test waits for the thing it is about; a screenshot is about
 * everything on the screen at once, so anything still arriving lands in the
 * picture — or does not, depending on the machine.
 *
 * It is not hypothetical. docs/screenshots/WA-25/desk-assets-1440.png was taken
 * by a case that navigated and photographed in the next line, and a pinned run
 * on this machine produced the same screen as a grey skeleton. Two runs of the
 * same unchanged screen differed in nineteen files, three of them wholesale.
 *
 * Two conditions, and both are about things that arrive late rather than about
 * any one screen:
 *
 *   No skeleton anywhere. Every one of them means a component has been asked
 *   for something it has not been given yet, and a picture of one is a picture
 *   of the demonstration loading rather than of the demonstration.
 *
 *   Fonts loaded. A face that swaps in after the shot moves every glyph on the
 *   screen by a fraction, which is invisible to a reader and is most of what a
 *   byte-level comparison finds.
 */
export async function settled(
  page: Page,
  { store = true }: { store?: boolean } = {},
): Promise<void> {
  // Alive first, then finished drawing. WA-52's helper waits for the store to
  // have answered at all, which is what makes a click land; this waits for the
  // answer to have been drawn, which is what makes a picture worth keeping.
  // Two different questions, asked in the order the screen answers them.
  //
  // `store: false` is for the one page the application does not render: the
  // service worker's offline refusal, which is a document the worker builds
  // itself. There is no store there to answer, so waiting for one waits for
  // something that by design never arrives — which is exactly how this was
  // found, as a fifteen-second timeout on the WA-47 pictures.
  if (store) await hydrated(page);

  for (const slot of [
    "data-table-skeleton",
    "skeleton",
    "sidebar-menu-skeleton",
  ]) {
    await expect(page.locator(`[data-slot="${slot}"]`)).toHaveCount(0, {
      timeout: 15_000,
    });
  }

  await page.evaluate(() => document.fonts.ready);
}
