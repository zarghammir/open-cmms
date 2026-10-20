import type { DemoData } from "@/data/seed";
import type {
  Facility,
  InventoryLocation,
  InventoryTransaction,
  Part,
  User,
  WorkOrder,
} from "@/domain/types";

/**
 * One part, and everything recorded against it.
 *
 * A pure function over a snapshot, the way `work-order-detail` is: the screen
 * is handed what it draws and never reaches for a store. Every join here can
 * fail, and each failure is its own answer rather than folded into an empty
 * one — a record this system cannot read is not a record that is not there.
 */

/**
 * Which work order a movement belongs to, as the three answers the record can
 * actually give.
 *
 * The one a screen is tempted to flatten is `none`. A movement with no work
 * order is **not** a broken link: a shelf count belongs to no job, and that is
 * the ordinary and correct state for an adjustment. Drawing it the same way as
 * a work order this system cannot read would tell a reader that a perfectly
 * good count was damaged.
 */
export type MovementOrigin =
  | { kind: "order"; order: WorkOrder }
  | { kind: "none" }
  | { kind: "unreadable"; id: string };

export interface LedgerEntry {
  transaction: InventoryTransaction;
  origin: MovementOrigin;
  /** Who moved it, or null when the person is no longer in the records. */
  actor: User | null;
}

/**
 * Deliberately no `low` here.
 *
 * Whether a part is under its minimum is the repository's predicate, and a
 * selector cannot reach the repository — so computing it here would have meant
 * writing `quantityOnHand < reorderPoint` out again. When this was written that
 * would have been the fourth copy; since WA-69 it would be the second, because
 * the comparison lives in exactly one place, `isBelowMinimum` in
 * `domain/constants/part.ts`, and everything else asks. The screen asks
 * `parts.belowMinimum()` for it, the same way the register does.
 */
export interface PartDetail {
  part: Part;
  /** The site, or null when the record names one this system cannot read. */
  facility: Facility | null;
  /** The bin, same three-state reasoning as the site. */
  bin: InventoryLocation | null;
  /** Newest first: the order of these is the information. */
  ledger: LedgerEntry[];
}

function originFor(data: DemoData, movement: InventoryTransaction) {
  if (movement.workOrderId === null) return { kind: "none" } as const;

  const order = data.workOrders.find(
    (candidate) => candidate.id === movement.workOrderId,
  );
  return order
    ? ({ kind: "order", order } as const)
    : ({ kind: "unreadable", id: movement.workOrderId } as const);
}

export function partDetail(data: DemoData, part: Part): PartDetail {
  const ledger = data.inventoryTransactions
    .filter((movement) => movement.partId === part.id)
    /*
     * Newest first, and by the recorded moment rather than by position in the
     * collection. Two movements written in one act share a timestamp, so the
     * comparison is `localeCompare` on the stamp with the insertion order left
     * to break the tie — a numeric subtraction on equal dates is 0 and leaves
     * whatever order the array happened to be in, which is not wrong but is not
     * decided either.
     */
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at))
    .map<LedgerEntry>((movement) => ({
      transaction: movement,
      origin: originFor(data, movement),
      actor: data.users.find((user) => user.id === movement.byUserId) ?? null,
    }));

  return {
    part,
    facility: data.facilities.find((one) => one.id === part.facilityId) ?? null,
    bin:
      data.inventoryLocations.find(
        (one) => one.id === part.inventoryLocationId,
      ) ?? null,
    ledger,
  };
}
