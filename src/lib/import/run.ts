import { buildRecords, type BuildContext, type BuiltRecords } from "./build";
import type { ColumnMapping, SheetKind } from "./mapping";
import {
  issuesByCode,
  rowsWithIssues,
  validateImport,
  type ImportIssue,
  type SheetData,
  type ValidationContext,
} from "./validate";

/**
 * One run of the importer, whose answer both the report and the commit use.
 *
 * This exists to stop a class of defect rather than to save work. If the report
 * were produced by one pass and the commit by another, the two could disagree —
 * about how many rows import, about which ones were blocked, about anything
 * that depends on the order a `Set` was filled or on a clock read twice. A
 * person would approve a screen that said 237 records and get some other
 * number, and nothing would have failed.
 *
 * So validation and building happen together, once, and everything downstream
 * reads the same object. `counts` is derived from `records` here rather than
 * recomputed by the screen, so the number shown is the length of the list that
 * will be written.
 */

export interface ImportCounts {
  /** Per collection, the length of the list that will actually be written. */
  assets: number;
  parts: number;
  workOrders: number;
  assignments: number;
  /** Every record the commit will create, across every collection. */
  total: number;
  /** Rows a blocking issue keeps out, per sheet. */
  blocked: Record<SheetKind, number>;
  /** Rows carrying at least one issue of any severity. */
  rowsWithIssues: number;
  byCode: Record<string, number>;
}

export interface ImportRun {
  issues: readonly ImportIssue[];
  records: BuiltRecords;
  counts: ImportCounts;
}

export function runImport(
  sheets: readonly SheetData[],
  mappings: Record<SheetKind, ColumnMapping>,
  validation: ValidationContext,
  build: BuildContext,
): ImportRun {
  const { issues, blocked } = validateImport(sheets, mappings, validation);
  const records = buildRecords(sheets, mappings, issues, build);

  const counts: ImportCounts = {
    assets: records.assets.length,
    parts: records.parts.length,
    workOrders: records.workOrders.length,
    assignments: records.workOrderAssignments.length,
    total:
      records.assets.length +
      records.parts.length +
      records.workOrders.length +
      records.workOrderAssignments.length,
    blocked,
    rowsWithIssues: rowsWithIssues(issues),
    byCode: issuesByCode(issues),
  };

  return { issues, records, counts };
}

/**
 * What the commit will create, counted from the records themselves.
 *
 * The screen shows `run.counts.total`; this is the same number arrived at from
 * the other end. A test holds the two together, so a screen that started
 * counting rows rather than records would be caught.
 */
export function recordCount(records: BuiltRecords): number {
  return (
    records.assets.length +
    records.parts.length +
    records.workOrders.length +
    records.workOrderAssignments.length
  );
}
