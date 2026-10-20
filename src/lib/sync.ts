import type { Id, IsoDateTime, WorkOrderStatus } from "@/domain/types";

/**
 * The simulated server.
 *
 * Phase 1 has no backend, so "sending a change" is this module accepting it and
 * bumping a version. That is enough to make the one thing the tender asks for
 * demonstrable and honest: a change written offline can meet a change the
 * server already had, and the person has to choose.
 *
 * Everything here is pure. The state it operates on lives in the store; this
 * decides, and is testable without a browser.
 */

/** What the server knows about a record: which version it is on. */
export type ServerVersions = Record<string, number>;

/**
 * A change the server already had when ours arrived.
 *
 * One field, because a demonstration conflict a person has to read in ten
 * seconds is a conflict about one thing. Both versions are shown and neither is
 * applied until someone chooses.
 */
export interface ServerChange {
  field: "status";
  value: WorkOrderStatus;
  /** Who the server says made it. A name, already resolved. */
  by: string;
  at: IsoDateTime;
}

export type ReplayOutcome =
  | { kind: "applied"; version: number }
  | { kind: "conflict"; server: ServerChange };

/**
 * The planted conflict.
 *
 * It fires on the first change to a work order that was queued **while
 * offline**, whichever order that is, rather than on a record named in advance
 * — so the conflict screen appears in the recording regardless of which order
 * the presenter opens. It fires once.
 *
 * Offline is the part that matters. Keyed on "first work-order change" alone it
 * would fire on an ordinary online edit and be spent before the demonstration
 * ever switched the network off. It is also the truer story: a conflict exists
 * because the server moved while you were away.
 *
 * This is a simulation and the code says so. Nothing here pretends to be a
 * server; it exists so that "manage synchronization conflicts" is something a
 * reviewer can watch rather than something a document claims.
 *
 * The moment is not here. A conflict is discovered when the queue is replayed,
 * so whoever plants it stamps it then: carrying a placeholder in the constant
 * is how an empty string reaches a date formatter and a screen reads "Invalid
 * Date". `Omit` makes that a compile error rather than a discipline.
 */
export const PLANTED_CONFLICT: Omit<ServerChange, "at"> = {
  field: "status",
  value: "waitingForParts",
  by: "Sophie Gagnon",
};

export function shouldPlantConflict(
  collection: string,
  alreadyPlanted: boolean,
  queuedOffline: boolean,
): boolean {
  return !alreadyPlanted && queuedOffline && collection === "workOrders";
}

/**
 * Whether a queued change can be applied, given what the server holds.
 *
 * A version the server does not know about is version zero: a record nobody
 * has synchronised yet is not a record in conflict. An unknown version and a
 * mismatched one are different answers.
 *
 * `at` is the moment of this replay attempt, which is when the simulated server
 * shows what it already had. It was the epoch before — a conflict raised here
 * would have read "1 Jan 1970" the moment anyone formatted it.
 */
export function replayOutcome(
  subject: string,
  baseVersion: number,
  versions: ServerVersions,
  planted: ServerChange | null,
  at: IsoDateTime,
): ReplayOutcome {
  if (planted) {
    return { kind: "conflict", server: planted };
  }

  const current = versions[subject] ?? 0;
  if (current !== baseVersion) {
    return { kind: "conflict", server: { ...PLANTED_CONFLICT, at } };
  }

  return { kind: "applied", version: current + 1 };
}

/** The version a change should be written against right now. */
export function versionOf(subject: string, versions: ServerVersions): number {
  return versions[subject] ?? 0;
}

/** What happened to one entry, for the log in Settings. */
export interface SyncLogEntry {
  id: Id;
  subject: string;
  /** The record as a person says it: a work-order number, an asset tag. */
  label: string;
  at: IsoDateTime;
  outcome: "applied" | "conflicted" | "keptMine" | "keptTheirs";
}
