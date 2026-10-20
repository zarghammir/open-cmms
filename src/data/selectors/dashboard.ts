import { isOverdue } from "@/data/repositories/work-order";
import type { DemoData } from "@/data/seed";
import {
  comparePriority,
  isOpenStatus,
} from "@/domain/constants/work-order-status";
import type {
  AuditEvent,
  Id,
  IsoDate,
  LocalizedText,
  WorkOrder,
  WorkOrderPriority,
  WorkOrderStatus,
} from "@/domain/types";
import { fullName } from "@/domain/types/user";
import { daysBetweenDays } from "@/lib/dates";

/**
 * The lists the dashboard and the field home are built from.
 *
 * `kpi.ts` holds the numbers; this holds the rows beside them, and both are
 * pure functions over a snapshot so the two can never disagree about what
 * "overdue" means. Nothing here reads the clock: the day arrives as an
 * argument, the way `buildSeed` takes it.
 *
 * Three states run through every function below. A due date that is absent is
 * not late and not on time. A facility that does not resolve is unknown, not
 * "none" — and the difference decides whether a row may be claimed for a site.
 */

/** How many rows each panel shows before it says there are more. */
export const EXCEPTION_LIMIT = 6;
export const ACTIVITY_LIMIT = 8;
export const UPCOMING_DAYS = 14;

export interface WorkRow {
  id: Id;
  number: string;
  title: LocalizedText;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  assetId: Id;
  assetTag: string | null;
  facilityId: Id;
  /** Null when the facility does not resolve. Unreadable is not "none". */
  facilityName: LocalizedText | null;
  dueOn: IsoDate | null;
  /**
   * Whole days past the due date, at least 1.
   *
   * Null means the work is not late, which covers both "due later" and "has no
   * due date at all". Zero is never used as a stand-in for either: it would
   * read as "late by nothing", which is not a thing that happens.
   */
  daysLate: number | null;
}

export interface MaintenanceRow {
  id: Id;
  planId: Id;
  /** Null when the plan does not resolve. */
  planName: LocalizedText | null;
  assetId: Id;
  /** Null when the asset does not resolve. */
  assetTag: string | null;
  facilityId: Id | undefined;
  nextDueOn: IsoDate;
  /** Whole days until the visit. Zero means today. */
  daysUntil: number;
}

/**
 * Who a screen names for an entry. Three answers, not two.
 *
 * A person, when the entry names one the records still hold. The application,
 * when the entry was written by the application rather than by anybody — a
 * rebuild of the records is nobody's doing. And unattributed, when an entry
 * names a person the records no longer hold: that is a failed lookup, and
 * showing it as the application would turn "we cannot tell you who" into "no
 * one did it", which is a different and false claim.
 *
 * One field with three values rather than a name plus a flag, because two
 * fields for three states is how the fourth, impossible one gets written.
 */
export type ActivityAttribution =
  | { kind: "person"; name: string }
  | { kind: "system" }
  | { kind: "unattributed" };

export interface ActivityRow {
  event: AuditEvent;
  actor: ActivityAttribution;
}

/**
 * Whether a row belongs to the site being looked at.
 *
 * `undefined` is the important case: it means the row's site could not be
 * determined, and a row we cannot place must not be claimed for a site the
 * reviewer is filtering to. `null` means the row belongs to the organisation
 * as a whole and shows under every filter.
 */
export function matchesFacility(
  rowFacilityId: Id | null | undefined,
  filter?: Id,
): boolean {
  if (!filter) return true;
  if (rowFacilityId === null) return true;
  if (rowFacilityId === undefined) return false;
  return rowFacilityId === filter;
}

function toWorkRow(data: DemoData, order: WorkOrder, today: IsoDate): WorkRow {
  const facility = data.facilities.find(
    (candidate) => candidate.id === order.facilityId,
  );
  const asset = data.assets.find((candidate) => candidate.id === order.assetId);
  const late = isOverdue(order, today);

  return {
    id: order.id,
    number: order.number,
    title: order.title,
    status: order.status,
    priority: order.priority,
    assetId: order.assetId,
    assetTag: asset?.assetTag ?? null,
    facilityId: order.facilityId,
    facilityName: facility?.name ?? null,
    dueOn: order.dueAt,
    daysLate: late && order.dueAt ? daysBetweenDays(order.dueAt, today) : null,
  };
}

/** Soonest first. Work with no due date sorts after work that has one. */
function byDueDate(a: IsoDate | null, b: IsoDate | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b);
}

/**
 * The order the exceptions panel puts work in.
 *
 * **Late before not late, then priority, then how late.** The first comparison
 * is the only one about time alone: anything already late sorts above work that
 * is merely critical, because a critical order due next week is a plan and a
 * high-priority order that was due last week is a problem.
 *
 * Among the late ones, **priority decides before lateness does**, and that is
 * deliberate. Priority is a statement about what happens while the work is not
 * done; lateness is a statement about how long it has not been done. A critical
 * order a day late is a machine that is down now; a high-priority order a month
 * late is a job nobody has got to. The panel is read by somebody deciding what
 * to send a technician to next, and that is the order they want.
 *
 * It does surprise a reader, which is why this says so rather than leaving the
 * screen to explain itself: on WA-13's dashboard picture the column runs 35,
 * 12, 11, 24, 7, 7 days late, and the 24 sits below the 11 because the 11 is
 * critical. The previous version of this comment said "Longest late first",
 * which is what the fourth comparison does and not what the function does — a
 * reader checking the screen against the comment would have concluded the sort
 * was broken.
 *
 * `dashboard.test.ts` pins it twice, and the pins were run rather than
 * assumed: swapping the two comparisons below reddens "orders late work by
 * priority" — a critical order one day late above a high-priority one eleven
 * days late, planted rows that cannot drift — and "puts an earlier critical
 * order above a later high-priority one", which asks the same question of the
 * seeded records. Two failures, no others.
 *
 * **That second pin was missing for a while, and the gap is the lesson.** The
 * case standing there before it asserted that the first exception row is
 * critical, which is true under either ranking: the head of that list is the
 * most overdue order and the highest priority at once. It reddened under the
 * swap at `d1acd72` and stopped doing so when WA-87's estate reached main —
 * discriminating by luck of the records rather than by construction, and the
 * luck ran out without anybody editing a line.
 *
 * WA-109 replaced it with a case that finds a critical row with a more
 * overdue high-priority row below it and checks their positions, so the
 * seeded half of this rule is pinned by what the arrangement is rather than by
 * what happens to sort first. A test whose inputs are the demonstration data
 * keeps a floor that says when the data has stopped exercising it.
 */
function byUrgency(a: WorkRow, b: WorkRow): number {
  const lateFirst = Number(b.daysLate !== null) - Number(a.daysLate !== null);
  if (lateFirst !== 0) return lateFirst;

  const byPriority = comparePriority(a.priority, b.priority);
  if (byPriority !== 0) return byPriority;

  const byLateness = (b.daysLate ?? 0) - (a.daysLate ?? 0);
  if (byLateness !== 0) return byLateness;

  const byDue = byDueDate(a.dueOn, b.dueOn);
  if (byDue !== 0) return byDue;

  return a.number.localeCompare(b.number);
}

/**
 * What needs attention, in the order it needs it.
 *
 * Two kinds of row qualify: work that is already late, and critical work that
 * is still open. Late work comes first even when the critical work outranks it
 * on priority — a critical order due next week is a plan, a high-priority order
 * that was due last week is a problem.
 */
export function exceptionRows(
  data: DemoData,
  today: IsoDate,
  facilityId?: Id,
  limit: number = EXCEPTION_LIMIT,
): WorkRow[] {
  return data.workOrders
    .filter(
      (order) =>
        isOverdue(order, today) ||
        (isOpenStatus(order.status) && order.priority === "critical"),
    )
    .map((order) => toWorkRow(data, order, today))
    .filter((row) => matchesFacility(row.facilityId, facilityId))
    .sort(byUrgency)
    .slice(0, limit);
}

/**
 * Preventive visits coming up, soonest first.
 *
 * The window starts today and runs forward. A schedule whose date has already
 * passed is not "upcoming" — it is late maintenance, which belongs with the
 * exceptions rather than in a plan for the fortnight.
 */
export function upcomingMaintenance(
  data: DemoData,
  today: IsoDate,
  days: number = UPCOMING_DAYS,
  facilityId?: Id,
): MaintenanceRow[] {
  return data.maintenanceSchedules
    .map((schedule) => {
      const plan = data.maintenancePlans.find(
        (candidate) => candidate.id === schedule.planId,
      );
      const asset = data.assets.find(
        (candidate) => candidate.id === schedule.assetId,
      );

      return {
        id: schedule.id,
        planId: schedule.planId,
        planName: plan?.name ?? null,
        assetId: schedule.assetId,
        assetTag: asset?.assetTag ?? null,
        facilityId: asset?.facilityId,
        nextDueOn: schedule.nextDueOn,
        daysUntil: daysBetweenDays(today, schedule.nextDueOn),
      };
    })
    .filter(
      (row) =>
        row.daysUntil >= 0 &&
        row.daysUntil <= days &&
        matchesFacility(row.facilityId, facilityId),
    )
    .sort(
      (a, b) =>
        a.daysUntil - b.daysUntil ||
        (a.assetTag ?? "").localeCompare(b.assetTag ?? ""),
    );
}

/**
 * Which site a trail entry belongs to.
 *
 * Three answers, and they are not interchangeable. An id places the entry at a
 * site. `null` means it belongs to the organisation as a whole — resetting the
 * demo is not something that happened at one laboratory. `undefined` means the
 * record it names is not in the data, so where it happened is unknown, and an
 * unknown site is not the site someone is filtering to.
 */
export function facilityOfAuditEvent(
  data: DemoData,
  event: AuditEvent,
): Id | null | undefined {
  switch (event.entity) {
    case "demo":
    case "user":
    case "maintenancePlan":
      return null;
    case "workOrder":
      return data.workOrders.find((order) => order.id === event.entityId)
        ?.facilityId;
    case "asset":
      return data.assets.find((asset) => asset.id === event.entityId)
        ?.facilityId;
    case "part":
      return data.parts.find((part) => part.id === event.entityId)?.facilityId;
    case "inspection":
      return data.inspections.find(
        (inspection) => inspection.id === event.entityId,
      )?.facilityId;
    case "document":
      return data.documents.find((document) => document.id === event.entityId)
        ?.facilityId;
    case "inventoryTransaction": {
      const transaction = data.inventoryTransactions.find(
        (candidate) => candidate.id === event.entityId,
      );
      if (!transaction) return undefined;
      return data.parts.find((part) => part.id === transaction.partId)
        ?.facilityId;
    }
    case "notification":
      return undefined;
  }
}

function attributionOf(data: DemoData, event: AuditEvent): ActivityAttribution {
  if (event.actorKind === "system") return { kind: "system" };

  const person = data.users.find(
    (candidate) => candidate.id === event.actorUserId,
  );

  return person
    ? { kind: "person", name: fullName(person) }
    : { kind: "unattributed" };
}

/** The trail, newest first, with each entry's author resolved for a screen. */
export function recentActivity(
  data: DemoData,
  limit: number = ACTIVITY_LIMIT,
  facilityId?: Id,
): ActivityRow[] {
  return data.auditEvents
    .filter((event) =>
      matchesFacility(facilityOfAuditEvent(data, event), facilityId),
    )
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)
    .map((event) => ({ event, actor: attributionOf(data, event) }));
}

/**
 * One technician's own open work, most urgent first.
 *
 * An assignment carrying a crew code and no person is not this person's work,
 * and an empty `userId` is not "everybody": with nobody to ask about, the
 * honest answer is an empty list rather than every unassigned order in the
 * organisation.
 */
export function myAssignments(
  data: DemoData,
  today: IsoDate,
  userId: Id | undefined,
): WorkRow[] {
  if (!userId) return [];

  const mine = new Set(
    data.workOrderAssignments
      .filter((assignment) => assignment.userId === userId)
      .map((assignment) => assignment.workOrderId),
  );

  return data.workOrders
    .filter((order) => mine.has(order.id) && isOpenStatus(order.status))
    .map((order) => toWorkRow(data, order, today))
    .sort(byUrgency);
}
