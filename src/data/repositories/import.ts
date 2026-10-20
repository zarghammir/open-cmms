import type { Id, ImportBatch, ImportableCollection } from "@/domain/types";
import { importedCount } from "@/domain/types";
import type { BuiltRecords } from "@/lib/import/build";
import type { Actor, Mutation } from "@/stores/mutations";
import { freeId } from "./ids";
import type { RepositoryContext } from "./types";

/**
 * What has been imported.
 *
 * The read side only. WA-35 adds committing a batch and undoing one; this is
 * the half the rest of the application needs first — a screen that wants to
 * offer "undo that import" has to be able to find out whether there is one.
 *
 * A rolled-back batch stays in the list rather than disappearing. An import
 * that was undone is part of what happened, and a trail that quietly forgets it
 * is a trail that cannot answer why the records changed twice.
 */
export interface ImportRepository {
  /** Newest first, the order a person would look for them in. */
  list: () => ImportBatch[];
  byId: (id: Id) => ImportBatch | undefined;
  /**
   * The most recent batch that still stands, or `undefined` when there is
   * none — which is a different thing from there being no imports at all, and
   * callers are expected to say so differently.
   */
  latestUndoable: () => ImportBatch | undefined;
  /** How many records a batch created, across every collection. */
  sizeOf: (batch: ImportBatch) => number;
  /**
   * Writes every built record and the batch that records them, as one act.
   *
   * All-or-nothing: if any single record is refused, nothing is written at all
   * and the caller is told. A half-imported spreadsheet is worse than one that
   * did not import.
   */
  commitImport: (
    records: BuiltRecords,
    fileName: string,
    actor: Actor,
  ) => ImportBatch;
  /**
   * Removes exactly the records a batch created, and marks it undone.
   *
   * Exactly those: the ids are read from the batch, never inferred from how an
   * id looks. Removed in the reverse order they were written, so an assignment
   * goes before the order it points at.
   */
  rollback: (batchId: Id, actor: Actor) => ImportBatch;
}

export function createImportRepository(
  context: RepositoryContext,
): ImportRepository {
  /*
   * Newest first — and the tie-break is not decoration. Two batches can now
   * share a timestamp, which is the state the fix below makes reachable, and
   * with equal `at` a sort on `at` alone leaves them in insertion order. So
   * `latestUndoable` would offer the *older* of two imports made in one tick.
   * Later-inserted wins the tie, which is what "latest" means.
   */
  const all = () =>
    context.data.importBatches
      .map((batch, index) => ({ batch, index }))
      .sort((a, b) => b.batch.at.localeCompare(a.batch.at) || b.index - a.index)
      .map((entry) => entry.batch);

  /** The order records are written in. Rollback walks it backwards. */
  const WRITE_ORDER: readonly ImportableCollection[] = [
    "assets",
    "parts",
    "workOrders",
    "workOrderAssignments",
  ];

  return {
    list: all,
    byId: (id) => context.data.importBatches.find((batch) => batch.id === id),
    latestUndoable: () => all().find((batch) => batch.rolledBackAt === null),
    sizeOf: importedCount,

    commitImport(records, fileName, actor) {
      const at = context.now().toISOString();
      /*
       * The id asks the collection; it does not trust the clock.
       *
       * `imp-${at}` was the whole id — no name component at all — so two
       * imports inside one millisecond built the same one and `applyMutation`
       * refused the second outright. WA-57 fixed six sites of this shape and
       * its sweep passed over this one, classifying the batch id as "derived
       * from a batch id" when the batch id *is* the clock.
       *
       * Not a narrow window in practice: under the screenshot fixture's pinned
       * clock the millisecond is the whole session, so import, undo, import
       * again collided on every run.
       */
      const batchId = freeId(context.data.importBatches, `imp-${at}`);

      const created = WRITE_ORDER.map((collection) => ({
        collection,
        ids: records[collection].map((record) => record.id),
      })).filter((entry) => entry.ids.length > 0);

      const batch: ImportBatch = {
        id: batchId,
        organizationId: context.data.organization.id,
        at,
        byUserId: actor.userId,
        fileName,
        created,
        rolledBackAt: null,
      };

      const mutations: Mutation[] = [];
      for (const collection of WRITE_ORDER) {
        for (const record of records[collection]) {
          mutations.push({
            operation: "insert",
            collection,
            id: record.id,
            record: { ...record },
            actor,
            audit: {
              entity: "importBatch",
              action: "imported",
              summaryKey: "audit.importCommitted",
              summaryParams: { fileName, records: 0 },
            },
          });
        }
      }

      mutations.push({
        operation: "insert",
        collection: "importBatches",
        id: batchId,
        record: { ...batch },
        actor,
        audit: {
          entity: "importBatch",
          action: "imported",
          summaryKey: "audit.importCommitted",
          summaryParams: { fileName, records: importedCount(batch) },
        },
      });

      context.commitMany(
        mutations,
        {
          entity: "importBatch",
          action: "imported",
          summaryKey: "audit.importCommitted",
          summaryParams: { fileName, records: importedCount(batch) },
        },
        actor,
        batchId,
        at,
      );

      return batch;
    },

    rollback(batchId, actor) {
      const batch = context.data.importBatches.find(
        (candidate) => candidate.id === batchId,
      );
      if (!batch) {
        throw new Error(`No import batch with id ${batchId}`);
      }
      if (batch.rolledBackAt !== null) {
        throw new Error(`Import ${batchId} has already been undone`);
      }

      const at = context.now().toISOString();
      const mutations: Mutation[] = [];

      // Backwards, so a record is removed before whatever points at it.
      for (const collection of [...WRITE_ORDER].reverse()) {
        const entry = batch.created.find(
          (candidate) => candidate.collection === collection,
        );
        for (const id of entry?.ids ?? []) {
          mutations.push({
            operation: "remove",
            collection,
            id,
            actor,
            audit: {
              entity: "importBatch",
              action: "deleted",
              summaryKey: "audit.importRolledBack",
              summaryParams: { fileName: batch.fileName, records: 0 },
            },
          });
        }
      }

      const undone: ImportBatch = { ...batch, rolledBackAt: at };
      mutations.push({
        operation: "update",
        collection: "importBatches",
        id: batchId,
        changes: { rolledBackAt: at },
        actor,
        audit: {
          entity: "importBatch",
          action: "deleted",
          summaryKey: "audit.importRolledBack",
          summaryParams: {
            fileName: batch.fileName,
            records: importedCount(batch),
          },
        },
      });

      context.commitMany(
        mutations,
        {
          entity: "importBatch",
          action: "deleted",
          summaryKey: "audit.importRolledBack",
          summaryParams: {
            fileName: batch.fileName,
            records: importedCount(batch),
          },
        },
        actor,
        batchId,
        at,
      );

      return undone;
    },
  };
}
