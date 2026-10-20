import { expect, test } from "@playwright/test";
import { hydrated, useRole, VIEWPORTS } from "../fixtures/shell";
import { expectTableFits, measureTableFit } from "../fixtures/table-fit";

/**
 * Whether the reports tables fit the box that clips them.
 *
 * WA-107. Reports was on the ticket's list of registers and was the one that
 * could not be measured at all: it draws a bare shadcn `<Table>` rather than
 * going through `DataTable`, so `[data-slot="data-table"]` does not exist on
 * the screen and the shared measurement had nothing to find. That is the same
 * defect as the Users register in a different coat — a surface nobody measured
 * reads exactly like a surface that passed.
 *
 * All four reports, because they are four different column sets over the same
 * frame and a fit is a property of the columns. The report lives in the address
 * (`?report=`), so each one is a navigation rather than a click.
 *
 * At 390 the screen draws a list of cards instead of a table, which is the
 * house rule; there is nothing to measure there and the measurement says so
 * rather than passing.
 */

const REPORTS = ["aging", "completion", "inventory", "inspections"] as const;

for (const locale of ["en", "fr"] as const) {
  for (const [label, viewport] of [
    ["1024", VIEWPORTS.tablet],
    ["1440", VIEWPORTS.desktop],
  ] as const) {
    for (const report of REPORTS) {
      test(`at ${label} in ${locale} the ${report} report fits its container`, async ({
        context,
        page,
      }) => {
        await useRole(context, "facilityManager");
        await page.setViewportSize(viewport);
        // Asserted rather than assumed: a fit measured at the wrong width
        // passes while testing a layout nobody uses.
        expect(page.viewportSize()).toEqual(viewport);

        await page.goto(`/${locale}/reports?report=${report}`);
        await hydrated(page);

        // The table is what this measures, so wait for the table — not for the
        // heading, which the server sends before the records are read.
        await expect(
          page.locator('[data-slot="table-container"] table'),
        ).toBeVisible();

        const fit = await measureTableFit(
          page,
          '[data-slot="table-container"]',
        );
        expectTableFits(fit, `the ${report} report at ${label} in ${locale}`);
      });
    }
  }
}
