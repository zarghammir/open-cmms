import type { DemoData } from "@/data/seed";
import type {
  AuditEvent,
  Id,
  Inspection,
  InspectionTemplate,
  InventoryTransaction,
  IsoDateTime,
  Part,
  WorkOrder,
} from "@/domain/types";

/**
 * One asset's history, as a single chronology.
 *
 * The repositories answer "what records relate to this asset". This answers
 * "how do those read as one story", which is a different question and the
 * reason it lives here rather than in a repository: merging four kinds of
 * record into one ordered list is a view of the data, not a query on it.
 *
 * Four sources. Three of them name the asset directly. The fourth does not, and
 * that is the part worth reading carefully.
 */

export type HistoryEntry =
  | { kind: "workOrder"; id: Id; at: IsoDateTime; order: WorkOrder }
  | {
      kind: "inspection";
      id: Id;
      at: IsoDateTime;
      inspection: Inspection;
      /** Null when the checklist does not resolve: unreadable, not "no checklist". */
      template: InspectionTemplate | null;
    }
  | {
      kind: "movement";
      id: Id;
      at: IsoDateTime;
      transaction: InventoryTransaction;
      /** Null when the part does not resolve: unreadable, not "no part". */
      part: Part | null;
      workOrderNumber: string;
    }
  | { kind: "audit"; id: Id; at: IsoDateTime; event: AuditEvent };

/**
 * When a work order last did something.
 *
 * One entry per order rather than one per status change. The status history
 * would be more granular and less use: four rows saying an order moved from
 * open to assigned to in progress to completed push everything else off the
 * screen, and the thing a person came to the asset to find out is what happened
 * to it, not how many times it was touched.
 */
function workOrderMoment(order: WorkOrder): IsoDateTime {
  return (
    order.completedAt ??
    order.cancelledAt ??
    order.startedAt ??
    order.requestedAt
  );
}

/**
 * When an inspection happened, or when it is due if it has not.
 *
 * `scheduledFor` is a calendar day and everything else here is an instant, so
 * it is widened to the start of that day rather than compared as a shorter
 * string — otherwise a scheduled inspection sorts against instants by accident
 * of string length rather than by time.
 */
function inspectionMoment(inspection: Inspection): IsoDateTime {
  return inspection.performedAt ?? `${inspection.scheduledFor}T00:00:00.000Z`;
}

/**
 * Stock movements that belong to this asset.
 *
 * An inventory movement records a part and, when there is one, the work order
 * it was issued against. It never records an asset. So "parts used on this
 * asset" is derived: the movement belongs here only if its work order does.
 *
 * Two ways to get this wrong, and both look like a working screen:
 *
 * - Matching on the part instead of the order would show every issue of that
 *   filter anywhere in the organisation on every asset that uses one.
 * - Treating a movement with no work order as belonging here would attribute
 *   a stock count or a receipt to whichever asset was open at the time. A
 *   movement with no order is not this asset's, and it is not nobody's — it
 *   simply is not attributable to an asset at all, which is a third answer.
 */
function movementsForAsset(
  data: DemoData,
  assetId: Id,
): { transaction: InventoryTransaction; workOrderNumber: string }[] {
  const ordersOnAsset = new Map(
    data.workOrders
      .filter((order) => order.assetId === assetId)
      .map((order) => [order.id, order.number]),
  );

  return data.inventoryTransactions.flatMap((transaction) => {
    if (!transaction.workOrderId) return [];
    const workOrderNumber = ordersOnAsset.get(transaction.workOrderId);
    return workOrderNumber ? [{ transaction, workOrderNumber }] : [];
  });
}

/**
 * The spares actually fitted to one machine.
 *
 * There is no asset-to-part relation in the model, because in life there is not
 * one either: a filter fits a family of units, not one machine. What is true of
 * this asset is what has been issued against its own work orders, which is what
 * `movementsForAsset` already walks for the timeline.
 *
 * Exported because the floor map needs the same answer to decide whether a
 * machine's outline should say its spares are running low. Written twice, the
 * timeline and the map would disagree about which parts belong to a machine —
 * and the map would be the one nobody checked.
 */
export function partsFittedTo(data: DemoData, assetId: Id): Part[] {
  const partIds = new Set(
    movementsForAsset(data, assetId).map(
      ({ transaction }) => transaction.partId,
    ),
  );
  return [...partIds].flatMap((partId) => {
    const part = data.parts.find((candidate) => candidate.id === partId);
    return part ? [part] : [];
  });
}

/** Newest first, and a stable tie-break so two entries at one instant do not swap between renders. */
function newestFirst(a: HistoryEntry, b: HistoryEntry): number {
  return b.at.localeCompare(a.at) || a.id.localeCompare(b.id);
}

export function assetHistory(
  data: DemoData,
  assetId: Id,
  limit?: number,
): HistoryEntry[] {
  const entries: HistoryEntry[] = [];

  for (const order of data.workOrders) {
    if (order.assetId !== assetId) continue;
    entries.push({
      kind: "workOrder",
      id: `wo-${order.id}`,
      at: workOrderMoment(order),
      order,
    });
  }

  for (const inspection of data.inspections) {
    if (inspection.assetId !== assetId) continue;
    entries.push({
      kind: "inspection",
      id: `in-${inspection.id}`,
      at: inspectionMoment(inspection),
      inspection,
      template:
        data.inspectionTemplates.find(
          (candidate) => candidate.id === inspection.templateId,
        ) ?? null,
    });
  }

  for (const { transaction, workOrderNumber } of movementsForAsset(
    data,
    assetId,
  )) {
    entries.push({
      kind: "movement",
      id: `mv-${transaction.id}`,
      at: transaction.at,
      transaction,
      part:
        data.parts.find((candidate) => candidate.id === transaction.partId) ??
        null,
      workOrderNumber,
    });
  }

  for (const event of data.auditEvents) {
    if (event.entity !== "asset" || event.entityId !== assetId) continue;
    entries.push({
      kind: "audit",
      id: `au-${event.id}`,
      at: event.at,
      event,
    });
  }

  entries.sort(newestFirst);
  return limit === undefined ? entries : entries.slice(0, limit);
}
