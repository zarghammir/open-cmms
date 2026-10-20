import { describe, expect, it } from "vitest";
import { buildSeed } from "@/data/seed";
import { isOpenStatus } from "@/domain/constants/work-order-status";
import { dashboardKpis } from "./kpi";
import {
  agingReport,
  completionReport,
  inspectionsReport,
  inventoryReport,
  REPORTS,
} from "./reports";

/**
 * The reports say what the dashboard and the registers say.
 *
 * A report that disagrees with the screen a person just came from is worse than
 * no report: it does not read as a different question, it reads as one of the
 * two being broken, and nobody can tell which. So each of these compares a
 * report's own total against the number the rest of the application already
 * shows, rather than against a figure computed the same way twice.
 */

const TODAY = new Date("2026-09-12T00:00:00.000Z");
const DAY = "2026-09-12";

describe("the reports", () => {
  const data = buildSeed(TODAY);
  const site = data.facilities[1]!;

  it("all four produce rows, unfiltered and filtered", () => {
    /*
     * The floor under everything below. Every assertion in this file compares
     * sums, and a report returning no rows sums to zero — which would agree
     * with a dashboard reading zero and with nothing else in the world.
     */
    for (const [key, report] of Object.entries(REPORTS)) {
      expect(
        report(data, DAY).rows.length,
        `${key} unfiltered`,
      ).toBeGreaterThan(0);
      expect(
        report(data, DAY, site.id).rows.length,
        `${key} filtered to ${site.code}`,
      ).toBeGreaterThan(0);
    }
  });

  it("ages exactly the work the dashboard calls open", () => {
    const aged = agingReport(data, DAY).rows.reduce(
      (total, row) => total + Number(row.orders),
      0,
    );

    expect(aged).toBe(dashboardKpis(data, DAY).openWorkOrders);

    // And the same when narrowed, because a filter that dropped rows on one
    // screen and not the other is the drift this test exists to catch.
    const agedHere = agingReport(data, DAY, site.id).rows.reduce(
      (total, row) => total + Number(row.orders),
      0,
    );
    expect(agedHere).toBe(dashboardKpis(data, DAY, site.id).openWorkOrders);
  });

  it("buckets every open order exactly once", () => {
    // The control beside the sum: two buckets that overlapped would still add
    // up if a third lost the same rows.
    const open = data.workOrders.filter((order) => isOpenStatus(order.status));
    const rows = agingReport(data, DAY).rows;

    expect(rows.reduce((t, row) => t + Number(row.orders), 0)).toBe(
      open.length,
    );
    expect(rows.length).toBe(4);
    expect(open.length).toBeGreaterThan(0);
  });

  it("counts the completions the queue holds", () => {
    const completed = data.workOrders.filter(
      (order) => order.status === "completed",
    ).length;
    const reported = completionReport(data, DAY).rows.reduce(
      (total, row) => total + Number(row.completed),
      0,
    );

    expect(reported).toBe(completed);
    expect(completed).toBeGreaterThan(0);
  });

  it("finds the low stock the dashboard counts", () => {
    const low = inventoryReport(data, DAY).rows.filter(
      (row) => row.state === "low",
    ).length;

    expect(low).toBe(dashboardKpis(data, DAY).partsBelowMinimum);
    expect(low).toBeGreaterThan(0);
  });

  it("does not treat an inspection nobody has done yet as a failure", () => {
    /*
     * The judgement this report has to get right. Scheduled work sits outside
     * the rate rather than inside its denominator: a pass rate that fell every
     * time somebody scheduled an inspection would punish the thing the module
     * exists to encourage.
     */
    const rows = inspectionsReport(data, DAY).rows;
    const pending = rows.reduce((total, row) => total + Number(row.pending), 0);
    expect(pending).toBeGreaterThan(0);

    for (const row of rows) {
      const judged = Number(row.passed) + Number(row.failed);
      const expected =
        judged === 0 ? 0 : Math.round((Number(row.passed) / judged) * 100);
      expect(row.rate, `${row.site}`).toBe(expected);
      expect(Number(row.rate)).toBeLessThanOrEqual(100);
    }
  });

  it("accounts for every inspection at a site", () => {
    const assetSite = new Map(
      data.assets.map((one) => [one.id, one.facilityId]),
    );
    const rows = inspectionsReport(data, DAY).rows;

    for (const row of rows) {
      const facility = data.facilities.find((one) => one.code === row.site)!;
      const mine = data.inspections.filter(
        (one) => assetSite.get(one.assetId) === facility.id,
      );
      expect(
        Number(row.passed) + Number(row.failed) + Number(row.pending),
        `${row.site} loses inspections`,
      ).toBe(mine.length);
    }
  });
});
