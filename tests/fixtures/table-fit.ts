import { expect, type Page } from "@playwright/test";

/**
 * Whether a data table fits the box that clips it, and by how much.
 *
 * Shared because it was written twice — once for the work-order queue, once for
 * the assets register — and a guard in two copies is a guard that will disagree
 * with itself. `scripts/free-e2e-port.mjs` makes the same argument about the
 * port: the repository's own rule is one definition, read from both places.
 */

/**
 * How much room a table must have spare, as a share of its container.
 *
 * A floor chosen so this machine fails **before** a wider-rendering one does,
 * and a share rather than a count because the effect is proportional.
 *
 * The calibration, from continuous integration's own two numbers on the
 * work-order queue:
 *
 *   k = 729 / 717 = 1.0167          the runner needed 729 where this machine
 *                                   needed 717: 1.67% wider
 *   the runner still fits while  k x (width - slack) <= width
 *   so the promise holds while    slack >= width x (1 - 1/k)
 *                                 = 11.8 px at 718, 18.7 px at 1134
 *
 * WA-50 shipped this as a flat 12 and then a flat 20, both measured at 1024.
 * Neither travels: the same 1.67% costs 11.8 px in a 718 px container and
 * 18.7 px in a 1134 px one, so an absolute floor set at tablet width lets the
 * runner overflow at desktop while this machine stays green — the very failure
 * the floor exists to prevent, reintroduced by using a count for a proportion.
 * Twelve was worse again: it cleared its own boundary by a fifth of a pixel, so
 * it held only while the widening stayed under 1.70% against an observed 1.674%.
 *
 * A floor of p times the container keeps its promise for every widening up to
 * `k = 1 / (1 - p)`, at every width. At 2.5% that is 2.56%.
 */
/**
 * **The floor guarantees a fit on a wider runner. It does not guarantee the
 * floor itself there, and the difference has now cost a red.**
 *
 * The derivation above shows that local slack of `p x width` keeps the table
 * *fitting* for any widening up to `k = 1 / (1 - p)`. But this test does not
 * assert fitting on the runner — it asserts the **floor** on the runner, and
 * the floor applies again over there. So the local requirement compounds:
 *
 *   to pass on the runner   minContent_local x k <= width - floor
 *   so                      minContent_local <= (width - floor) / k
 *   equivalently            local headroom >= floor + (k - 1) x minContent
 *
 * WA-19 measured that on the runner rather than deriving it: the planned-visits
 * table needed 1090 px here and **1110** on the runner, 1.8% wider, and a line
 * with +44 of local headroom against a 28 px floor came out at +24 there and
 * failed — twice, so not intermittent.
 *
 * **So the number to design a cap against is not the floor.** At 1440 it is
 * about `28 + 0.018 x 1090`, near **47 px** of local headroom; at 1024, about
 * `18 + 0.018 x 700`, near **31**. Every table's fit test should be read that
 * way, not only this one's. A table that clears the floor by a few
 * pixels here is a table that fails there, and the floor is what tells you so
 * — which is the whole point of it being a floor and not a limit.
 */
export const SLACK_SHARE = 0.025;

export function minimumSlack(containerWidth: number): number {
  return Math.round(containerWidth * SLACK_SHARE);
}

export interface TableFit {
  /** What the squeeze achieved. Anything but 1 means the numbers are the container's. */
  squeezedTo: number;
  /** The width the table refuses to go below. */
  minContent: number;
  innerClientWidth: number;
  innerRight: number;
  tableRight: number;
}

/**
 * Measures the table inside `[data-slot="data-table"]` on the current page.
 *
 * There are **two** nested `overflow-x-auto` boxes: the outer one this
 * repository draws, and shadcn's `[data-slot="table-container"]` that `<Table>`
 * renders around the `<table>`. The inner one is the box that actually clips —
 * it is `w-full`, so it measures the same whatever the table does, which is
 * exactly why the outer wrapper read `scrollWidth === clientWidth` in both the
 * broken and the fixed state and the first version of this assertion could not
 * fail. A quantity that is the same when the defect is present and when it is
 * gone is not a measurement.
 *
 * The true minimum is not readable directly: `scrollWidth` is clamped to
 * `clientWidth` while the content fits, so it reads "exactly full" whether
 * there are sixty pixels spare or one. Squeeze the container, read what the
 * table refuses to go below, put it back.
 */
export const DATA_TABLE_ROOT = '[data-slot="data-table"]';

export async function measureTableFit(
  page: Page,
  /**
   * Where to start looking, for the screens that do not use `DataTable`.
   *
   * Reports draws a bare shadcn `<Table>`, so `[data-slot="data-table"]` does
   * not exist on it — the register was unmeasurable rather than measured-and-
   * passing, which is the failure this ticket is about wearing a different
   * coat. Passing the container itself is allowed: if the root already is the
   * `table-container`, it is used as the clipping box.
   */
  root: string = DATA_TABLE_ROOT,
): Promise<TableFit> {
  return page.evaluate((rootSelector) => {
    const wrapper = document.querySelector<HTMLElement>(rootSelector);
    // Explicit, because `!` on a missing element throws "Cannot read
    // properties of null" three lines later and sends the reader after a
    // layout bug rather than a selector that matched nothing. A surface this
    // cannot see must say so.
    if (!wrapper) {
      throw new Error(
        `table-fit: nothing matched ${rootSelector} on this page, so no table was measured`,
      );
    }

    const inner = wrapper.matches('[data-slot="table-container"]')
      ? wrapper
      : wrapper.querySelector<HTMLElement>('[data-slot="table-container"]');
    if (!inner) {
      throw new Error(
        `table-fit: ${rootSelector} holds no [data-slot="table-container"], so there is no box that clips`,
      );
    }

    const table = inner.querySelector<HTMLElement>("table");
    if (!table) {
      throw new Error(
        `table-fit: the container under ${rootSelector} holds no <table> — at 390 the register draws cards, and cards are not measured here`,
      );
    }

    const had = inner.style.width;
    inner.style.width = "1px";
    const squeezedTo = inner.clientWidth;
    const minContent = table.scrollWidth;
    inner.style.width = had;

    return {
      squeezedTo,
      minContent,
      innerClientWidth: inner.clientWidth,
      innerRight: inner.getBoundingClientRect().right,
      tableRight: table.getBoundingClientRect().right,
    };
  }, root);
}

/**
 * Asserts the table fits with room to spare, and says by how much when it does
 * not.
 *
 * The squeeze is checked **before any width is believed**. A squeeze that did
 * not take yields a minimum equal to the container and reads as zero slack —
 * red, but for a reason that would send the next reader after a layout bug that
 * is not there.
 *
 * `expect.soft` on the two edges, so a red reports every margin rather than
 * stopping at the first.
 */
export function expectTableFits(fit: TableFit, where: string): void {
  expect(
    fit.squeezedTo,
    `${where}: the container did not squeeze — it stayed ${fit.squeezedTo}px, so the minimum below is the container's width and not the table's`,
  ).toBe(1);

  const slack = fit.innerClientWidth - fit.minContent;
  const floor = minimumSlack(fit.innerClientWidth);

  expect
    .soft(
      slack,
      `${where}: ${slack}px of slack, under the ${floor}px floor — it needs ${fit.minContent} and has ${fit.innerClientWidth}`,
    )
    .toBeGreaterThanOrEqual(floor);

  expect
    .soft(
      fit.tableRight,
      `${where}: the table runs past its container — table right ${fit.tableRight}, container right ${fit.innerRight}`,
    )
    .toBeLessThanOrEqual(fit.innerRight + 1);
}
