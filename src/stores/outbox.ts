import type { DemoData } from "@/data/seed";
import type { Id, IsoDateTime } from "@/domain/types";
import type {
  Actor,
  CollectionName,
  Mutation,
  MutationAudit,
} from "./mutations";

/**
 * Changes made here that have not reached the server.
 *
 * The unit is the commit, not the mutation. `commitMany` applies a list of
 * changes under a single audit entry — one logical event — so replaying its
 * pieces separately would turn one thing that happened into several, and a
 * half-replayed batch is a state the records were never in. The tagged union
 * is here from the start for that reason; the `many` arm arrives with the
 * import work that introduces it.
 *
 * Queued is not the same as unapplied. A change made offline lands in the local
 * records immediately — the technician has to see their own work — and the
 * queue is the record of what the server has not been told, not of what has not
 * happened.
 */
export interface OutboxEntryBase {
  id: Id;
  /** The record as a person says it: a work-order number, an asset tag. */
  label: string;
  /**
   * Whether the change was written with no connection.
   *
   * The queue behaves the same either way; this is what the simulated server
   * uses to decide that a conflict is plausible, because a conflict exists when
   * the server moved while you were away.
   */
  queuedOffline: boolean;
  /** The record the change is against, so a conflict can be recognised. */
  subject: { collection: CollectionName; id: Id };
  /**
   * The server's version of that record when the change was written.
   *
   * This is what makes replay able to refuse: if the server has moved on since,
   * the two changes are talking about different things and overwriting would
   * lose one of them silently.
   */
  baseVersion: number;
  queuedAt: IsoDateTime;
  actor: Actor;
}

export interface OutboxEntryOne extends OutboxEntryBase {
  kind: "one";
  mutation: Mutation;
}

/**
 * Many changes that were one act.
 *
 * Raising a work order writes the order and the first row of its history;
 * importing a file writes hundreds of records. Each is one thing a person did,
 * so each is one entry here — which is why the banner counts three when three
 * things were done, rather than six because six rows were written.
 */
export interface OutboxEntryMany extends OutboxEntryBase {
  kind: "many";
  mutations: readonly Mutation[];
  audit: MutationAudit;
  entityId: Id;
}

export type OutboxEntry = OutboxEntryOne | OutboxEntryMany;

/** The queue drains in the order it was written, oldest first. */
export function inQueueOrder(entries: readonly OutboxEntry[]): OutboxEntry[] {
  return [...entries].sort((a, b) => {
    const byTime = a.queuedAt.localeCompare(b.queuedAt);
    // Two changes in the same millisecond still have an order: the one written
    // first. Sorting by time alone would let them swap between runs.
    return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
  });
}

/** How a single entry describes what it touched, for the log and the screen. */
export function subjectKey(subject: OutboxEntry["subject"]): string {
  return `${subject.collection}:${subject.id}`;
}

/**
 * The record as a person says it, for the queue and the log.
 *
 * Resolved when the change is queued rather than when it is shown, so the
 * label still reads correctly if the record is edited again before the queue
 * drains — and so a log entry about a record still names it after a reset.
 */
export function recordLabel(
  data: DemoData,
  collection: CollectionName,
  id: Id,
): string {
  if (collection === "workOrders") {
    return data.workOrders.find((order) => order.id === id)?.number ?? id;
  }
  if (collection === "assets") {
    return data.assets.find((asset) => asset.id === id)?.assetTag ?? id;
  }
  if (collection === "parts") {
    return data.parts.find((part) => part.id === id)?.partNumber ?? id;
  }

  // A row that belongs to a work order is named by that order. Raising one
  // writes the order and its first history row, and the second showed in the
  // synchronisation log as `wkh-WO-2026-0041-1` — an identifier the domain
  // says is opaque, put in front of a person. Naming the parent is what a
  // reader can act on.
  const parentOf: Partial<Record<CollectionName, (row: never) => Id>> = {
    workOrderStatusHistory: (row: { workOrderId: Id }) => row.workOrderId,
    workOrderTasks: (row: { workOrderId: Id }) => row.workOrderId,
    workOrderAssignments: (row: { workOrderId: Id }) => row.workOrderId,
  } as Partial<Record<CollectionName, (row: never) => Id>>;

  const toParent = parentOf[collection];
  if (toParent) {
    const rows = data[collection] as readonly { id: Id }[];
    const row = rows.find((candidate) => candidate.id === id);
    if (row) {
      const parent = (toParent as (r: unknown) => Id)(row);
      return data.workOrders.find((order) => order.id === parent)?.number ?? id;
    }
  }

  return id;
}
