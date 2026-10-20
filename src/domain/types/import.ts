import type { Id, IsoDateTime, TenantOwned } from "./common";

/**
 * The collections an import may create records in. Deliberately narrower than
 * "every collection": an import brings equipment, parts and work orders, and
 * nothing in the spreadsheet describes a user or a facility.
 */
export const IMPORTABLE_COLLECTIONS = [
  "assets",
  "parts",
  "workOrders",
  "workOrderAssignments",
] as const;
export type ImportableCollection = (typeof IMPORTABLE_COLLECTIONS)[number];

export interface ImportedRecords {
  collection: ImportableCollection;
  ids: readonly Id[];
}

/**
 * What one import created.
 *
 * It exists so that undoing an import can remove exactly the records that
 * import made — no more, and none of the ones that happen to look similar.
 *
 * The alternative was to mint ids with a recognisable prefix and delete by
 * matching it. That would have been shorter and wrong: `common.ts` says an `Id`
 * is opaque and that nothing may parse meaning out of it, and a rollback that
 * works by reading ids is a rollback that breaks the first time id minting
 * changes. Writing down what was created is the honest way, and it is the shape
 * a Phase 2 backend needs anyway.
 *
 * `rolledBackAt` keeps a reverted batch on the record rather than deleting it:
 * an import that was undone is part of what happened, and the trail should be
 * able to say so.
 */
export interface ImportBatch extends TenantOwned {
  id: Id;
  at: IsoDateTime;
  byUserId: Id;
  /** The spreadsheet's own name, shown when offering to undo. */
  fileName: string;
  created: readonly ImportedRecords[];
  rolledBackAt: IsoDateTime | null;
}

/** How many records a batch created, across every collection. */
export function importedCount(batch: ImportBatch): number {
  return batch.created.reduce((total, entry) => total + entry.ids.length, 0);
}
