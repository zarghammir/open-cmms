import type { DemoData } from "@/data/seed";
import { assignmentForCrewCode } from "@/data/seed/people";
import type {
  Asset,
  Facility,
  Id,
  InventoryTransaction,
  IsoDate,
  Location,
  Part,
  User,
  WorkOrder,
  WorkOrderComment,
  WorkOrderStatusHistory,
  WorkOrderTask,
} from "@/domain/types";
import { isOpenStatus } from "@/domain/constants/work-order-status";
import { daysBetweenDays } from "@/lib/dates";
import { loggedMinutes } from "@/data/selectors/labour";

/**
 * One work order, and everything hanging off it.
 *
 * A pure function over a snapshot, the way `asset-history` is: the screen is
 * handed what it draws and never reaches for a store. Every join here can fail,
 * and each failure is carried as its own answer rather than folded into an
 * empty one — a record this system cannot read is not a record that is not
 * there.
 */

/**
 * Who is doing the work, as the three answers the record can actually give.
 *
 * `crew` is the one a screen is tempted to flatten. An order that names a crew
 * code and no person is not unassigned: somebody is doing it and the legacy
 * system knew who. The code itself resolves three ways in turn — to one of our
 * people, to a contractor, or to nothing at all — and `resolvesTo: null` is a
 * code this organisation does not use, which is unknown rather than nobody.
 */
export type WorkOrderAssignee =
  | { kind: "person"; user: User; crewCode: string | null }
  | { kind: "crew"; code: string; resolvesTo: User | "contractor" | null }
  | { kind: "nobody" };

/**
 * How a due date reads to a person, rather than as a number to compare.
 *
 * Five answers, because a date can be absent, and because a date in the past
 * does not mean the same thing on an order somebody closed last month as on one
 * still open. `late` follows `isOverdue`'s rule — open statuses only — so the
 * queue, the dashboard and this page cannot disagree about what "late" means.
 * `passed` is the closed order whose date has gone by: the date is worth
 * printing, "12 days late" is not.
 */
export type DueReading =
  | { kind: "none" }
  | { kind: "late"; days: number }
  | { kind: "today" }
  | { kind: "ahead"; days: number }
  | { kind: "passed"; date: IsoDate };

/** One movement of stock made against this order, with the part if it resolves. */
export interface PartUsed {
  transaction: InventoryTransaction;
  /** Null when the part record is gone: unreadable, not "no part". */
  part: Part | null;
}

export interface WorkOrderDetail {
  order: WorkOrder;
  /** Null when the asset does not resolve. Every order has one; this says so when it cannot be read. */
  asset: Asset | null;
  facility: Facility | null;
  /** Building, floor, room — outermost first. Empty when the location is gone. */
  locationPath: Location[];
  tasks: WorkOrderTask[];
  assignee: WorkOrderAssignee;
  due: DueReading;
  history: { entry: WorkOrderStatusHistory; actor: User | null }[];
  comments: { comment: WorkOrderComment; author: User | null }[];
  partsUsed: PartUsed[];
  /** Null when nobody has logged time. Never 0 — see `loggedMinutes`. */
  loggedMinutes: number | null;
  today: IsoDate;
}

export function readDue(order: WorkOrder, today: IsoDate): DueReading {
  if (!order.dueAt) return { kind: "none" };

  const days = daysBetweenDays(today, order.dueAt);
  if (days === 0) return { kind: "today" };
  if (days > 0) return { kind: "ahead", days };

  // The date has gone by. Whether that is "late" depends on the status, and the
  // answer has to be the one `isOverdue` gives or two screens will disagree.
  return isOpenStatus(order.status)
    ? { kind: "late", days: -days }
    : { kind: "passed", date: order.dueAt };
}

export function readAssignee(
  data: DemoData,
  workOrderId: Id,
): WorkOrderAssignee {
  const assignment = data.workOrderAssignments.find(
    (candidate) => candidate.workOrderId === workOrderId,
  );
  if (!assignment) return { kind: "nobody" };

  const byId = (id: Id) => data.users.find((user) => user.id === id) ?? null;

  if (assignment.userId) {
    const user = byId(assignment.userId);
    // A person id that does not resolve is not a person. Falling through to the
    // crew code, or to "nobody", would both be claims the record does not make;
    // the code is what is left that is true.
    if (user) return { kind: "person", user, crewCode: assignment.crewCode };
  }

  if (assignment.crewCode) {
    const resolved = assignmentForCrewCode(assignment.crewCode);
    return {
      kind: "crew",
      code: assignment.crewCode,
      resolvesTo:
        resolved === undefined
          ? null
          : resolved.kind === "contractor"
            ? "contractor"
            : byId(resolved.userId),
    };
  }

  return { kind: "nobody" };
}

/**
 * The stock this order consumed.
 *
 * Matched on the order, never on the part or the asset. A movement carrying no
 * work order — a receipt, a shelf count — is not this order's and is not
 * nobody's; it simply is not attributable to an order, which `asset-history`
 * calls the third answer for the same reason.
 */
export function partsUsedBy(data: DemoData, workOrderId: Id): PartUsed[] {
  return data.inventoryTransactions
    .filter((transaction) => transaction.workOrderId === workOrderId)
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
    .map((transaction) => ({
      transaction,
      part: data.parts.find((part) => part.id === transaction.partId) ?? null,
    }));
}

export function workOrderDetail(
  data: DemoData,
  order: WorkOrder,
  today: IsoDate,
): WorkOrderDetail {
  const byId = (id: Id | null) =>
    id === null ? null : (data.users.find((user) => user.id === id) ?? null);

  const asset = data.assets.find((candidate) => candidate.id === order.assetId);
  const location = data.locations.find(
    (candidate) => candidate.id === order.locationId,
  );

  // Outermost first, walking up to the building and reversing. A cycle in the
  // parent chain would hang this, so the walk is bounded by the number of
  // locations there are.
  const locationPath: Location[] = [];
  let step = location;
  for (let guard = 0; step && guard <= data.locations.length; guard += 1) {
    locationPath.unshift(step);
    const parentId: Id | null = step.parentId;
    step = parentId
      ? data.locations.find((candidate) => candidate.id === parentId)
      : undefined;
  }

  return {
    order,
    asset: asset ?? null,
    facility:
      data.facilities.find((candidate) => candidate.id === order.facilityId) ??
      null,
    locationPath,
    tasks: data.workOrderTasks
      .filter((task) => task.workOrderId === order.id)
      .sort((a, b) => a.sequence - b.sequence),
    assignee: readAssignee(data, order.id),
    due: readDue(order, today),
    history: data.workOrderStatusHistory
      .filter((entry) => entry.workOrderId === order.id)
      .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
      .map((entry) => ({ entry, actor: byId(entry.byUserId) })),
    comments: data.workOrderComments
      .filter((comment) => comment.workOrderId === order.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((comment) => ({ comment, author: byId(comment.authorUserId) })),
    partsUsed: partsUsedBy(data, order.id),
    loggedMinutes: loggedMinutes(data, order.id),
    today,
  };
}
