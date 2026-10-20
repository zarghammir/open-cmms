import type { DemoData } from "@/data/seed";
import { isBelowMinimum } from "@/domain/constants/part";
import { isOpenStatus } from "@/domain/constants/work-order-status";
import type { Id, IsoDate } from "@/domain/types";

/**
 * Four one-page reports, each a table of rows and nothing else.
 *
 * **Rows, not rendered cells.** The screen draws these rows and the export
 * writes these rows, so "the file matches what is on screen" is true by
 * construction rather than by two pieces of code agreeing to format the same
 * records the same way. A second pass that rebuilt the rows for the file is
 * exactly where a report and its export drift apart.
 *
 * Every report takes the dashboard's site filter, and takes it the same way the
 * dashboard does, so a reader who narrows to one site sees one organisation's
 * numbers rather than two screens' opinions.
 */

export type ReportKey = "aging" | "completion" | "inventory" | "inspections";

/** A value a cell can hold. Numbers stay numbers so a column can be summed. */
export type ReportCell = string | number;

export interface ReportTable {
  /** Column keys. Their labels live in the catalogues, not here. */
  columns: readonly string[];
  rows: readonly Record<string, ReportCell>[];
}

function inFacility<T extends { facilityId: Id }>(
  records: readonly T[],
  facilityId?: Id,
): T[] {
  return facilityId
    ? records.filter((record) => record.facilityId === facilityId)
    : [...records];
}

/** Whole days between two ISO dates, never negative. */
function daysSince(from: string, today: IsoDate): number {
  const start = new Date(from.slice(0, 10)).getTime();
  const end = new Date(today).getTime();
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

/**
 * How long the open work has been open.
 *
 * Buckets rather than one average: an average of eight days hides a job that
 * has been open since March, and the job open since March is the only row on
 * this report anybody acts on.
 */
export const AGING_BUCKETS = [
  { key: "week", upTo: 7 },
  { key: "month", upTo: 30 },
  { key: "quarter", upTo: 90 },
  { key: "older", upTo: Number.POSITIVE_INFINITY },
] as const;

export function agingReport(
  data: DemoData,
  today: IsoDate,
  facilityId?: Id,
): ReportTable {
  const open = inFacility(data.workOrders, facilityId).filter((order) =>
    isOpenStatus(order.status),
  );

  const rows = AGING_BUCKETS.map((bucket, index) => {
    // The buckets partition every age from 0 upwards with no gap and no
    // overlap, which is what lets the test assert that their counts sum to the
    // dashboard's open total. A gap would lose orders silently.
    const lower = index === 0 ? 0 : AGING_BUCKETS[index - 1]!.upTo + 1;
    const inBucket = open.filter((order) => {
      const age = daysSince(order.requestedAt, today);
      return age >= lower && age <= bucket.upTo;
    });

    return {
      bucket: bucket.key,
      orders: inBucket.length,
      oldest: inBucket.reduce(
        (worst, order) => Math.max(worst, daysSince(order.requestedAt, today)),
        0,
      ),
    };
  });

  return { columns: ["bucket", "orders", "oldest"], rows };
}

/** What each site raised and what it finished. */
export function completionReport(
  data: DemoData,
  _today: IsoDate,
  facilityId?: Id,
): ReportTable {
  const sites = facilityId
    ? data.facilities.filter((facility) => facility.id === facilityId)
    : data.facilities;

  const rows = sites.map((facility) => {
    const raised = data.workOrders.filter(
      (order) => order.facilityId === facility.id,
    );
    const completed = raised.filter((order) => order.status === "completed");

    return {
      site: facility.code,
      raised: raised.length,
      completed: completed.length,
      // Whole percent. A rate with no work behind it is 0, never a division by
      // zero dressed up as "—": a site that raised nothing completed nothing.
      rate:
        raised.length === 0
          ? 0
          : Math.round((completed.length / raised.length) * 100),
    };
  });

  return { columns: ["site", "raised", "completed", "rate"], rows };
}

/** What is on the shelf, and what is under its minimum. */
export function inventoryReport(
  data: DemoData,
  _today: IsoDate,
  facilityId?: Id,
): ReportTable {
  const rows = inFacility(data.parts, facilityId)
    .slice()
    .sort((a, b) => a.partNumber.localeCompare(b.partNumber))
    .map((part) => ({
      stockNumber: part.partNumber,
      category: part.category,
      onHand: part.quantityOnHand,
      minimum: part.reorderPoint,
      // Asked, not rewritten. The comment here used to claim exactly that
      // while the line below spelled the comparison out again — WA-69 removed
      // four such copies, which agreed only because all four happened to use a
      // strict `<`, and its gate test caught this one on the merge.
      state: isBelowMinimum(part) ? "low" : "ok",
    }));

  return {
    columns: ["stockNumber", "category", "onHand", "minimum", "state"],
    rows,
  };
}

/**
 * How many inspections passed.
 *
 * From the seeded figures, which is all there is until WA-20 records results
 * properly. Scheduled and in-progress inspections are counted separately rather
 * than folded into the denominator: an inspection nobody has done yet is not a
 * failure, and a rate that treats it as one falls every time work is scheduled.
 */
export function inspectionsReport(
  data: DemoData,
  _today: IsoDate,
  facilityId?: Id,
): ReportTable {
  const sites = facilityId
    ? data.facilities.filter((facility) => facility.id === facilityId)
    : data.facilities;

  const assetSite = new Map(
    data.assets.map((asset) => [asset.id, asset.facilityId]),
  );

  const rows = sites.map((facility) => {
    const mine = data.inspections.filter(
      (inspection) => assetSite.get(inspection.assetId) === facility.id,
    );
    const passed = mine.filter((one) => one.status === "passed").length;
    const failed = mine.filter((one) => one.status === "failed").length;
    const pending = mine.filter(
      (one) => one.status === "scheduled" || one.status === "inProgress",
    ).length;
    const judged = passed + failed;

    return {
      site: facility.code,
      passed,
      failed,
      pending,
      rate: judged === 0 ? 0 : Math.round((passed / judged) * 100),
    };
  });

  return { columns: ["site", "passed", "failed", "pending", "rate"], rows };
}

export const REPORTS: Record<
  ReportKey,
  (data: DemoData, today: IsoDate, facilityId?: Id) => ReportTable
> = {
  aging: agingReport,
  completion: completionReport,
  inventory: inventoryReport,
  inspections: inspectionsReport,
};
