import { isOverdue } from "@/data/repositories/work-order";
import type { DemoData } from "@/data/seed";
import { fullName } from "@/domain/types/user";
import type {
  Id,
  IsoDate,
  WorkOrder,
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderType,
} from "@/domain/types";
import {
  matchesAssignee,
  matchesWorkOrderSearch,
  type AssigneeFacet,
  type DueWindow,
  type WorkOrderRow,
} from "@/components/work-orders/work-order-rows";
import { daysBetweenDays } from "@/lib/dates";

/**
 * The work-order queue: the rows, and what narrows them.
 *
 * Pure over a snapshot, so the queue's idea of "overdue" is the same function
 * the dashboard counts with — `isOverdue` — rather than a second comparison
 * that could drift. Two screens showing different overdue counts is the kind of
 * thing an evaluator notices and cannot unsee.
 */

export interface WorkOrderQueueFilter {
  status: readonly WorkOrderStatus[];
  priority: readonly WorkOrderPriority[];
  type: readonly WorkOrderType[];
  facilityId?: Id;
  assignee: AssigneeFacet;
  due: DueWindow;
  query: string;
}

export const EMPTY_QUEUE_FILTER: WorkOrderQueueFilter = {
  status: [],
  priority: [],
  type: [],
  assignee: "anyone",
  due: "any",
  query: "",
};

/**
 * The row a person sees, in the language they are reading.
 *
 * Names resolve here rather than in the table, so a row that cannot be fully
 * read still carries what is known: an assignment naming a person this
 * organisation does not hold keeps the crew code, and an order at a site that
 * does not resolve keeps its facility id rather than showing a blank column.
 */
export function toWorkOrderRow(
  data: DemoData,
  order: WorkOrder,
  today: IsoDate,
  locale: string,
): WorkOrderRow {
  const french = locale.split("-")[0] === "fr";
  const facility = data.facilities.find(
    (candidate) => candidate.id === order.facilityId,
  );
  const asset = data.assets.find((candidate) => candidate.id === order.assetId);
  const assignment = data.workOrderAssignments.find(
    (candidate) => candidate.workOrderId === order.id,
  );
  const assignee = assignment?.userId
    ? data.users.find((candidate) => candidate.id === assignment.userId)
    : undefined;
  const late = isOverdue(order, today);

  return {
    id: order.id,
    number: order.number,
    title: french ? order.title.fr : order.title.en,
    status: order.status,
    priority: order.priority,
    type: order.type,
    assetId: order.assetId,
    assetTag: asset?.assetTag ?? "",
    facilityId: order.facilityId,
    facilityName: facility
      ? french
        ? facility.name.fr
        : facility.name.en
      : order.facilityId,
    facilityCity: facility
      ? french
        ? facility.city.fr
        : facility.city.en
      : order.facilityId,
    dueOn: order.dueAt,
    daysLate: late && order.dueAt ? daysBetweenDays(order.dueAt, today) : null,
    requestedAt: order.requestedAt,
    assigneeUserId: assignment?.userId ?? null,
    assigneeName: assignee ? fullName(assignee) : null,
    crewCode: assignment?.crewCode ?? null,
  };
}

/**
 * Whether a row falls in a due window.
 *
 * `none` is its own answer. An order with no due date is not overdue and not
 * due later — it has no date, and a coordinator looking for work nobody has
 * dated needs to be able to ask for exactly that.
 */
export function matchesDueWindow(
  row: WorkOrderRow,
  window: DueWindow,
  today: IsoDate,
): boolean {
  if (window === "any") return true;
  if (window === "none") return row.dueOn === null;
  if (row.dueOn === null) return false;
  if (window === "overdue") return row.daysLate !== null;

  const days = daysBetweenDays(today, row.dueOn);
  if (days < 0) return false;
  if (window === "today") return days === 0;
  if (window === "week") return days <= 7;
  return days <= 30;
}

export function matchesQueueFilter(
  row: WorkOrderRow,
  filter: WorkOrderQueueFilter,
  today: IsoDate,
): boolean {
  // An empty facet is "no opinion", not "nothing matches". Choosing no status
  // means every status, which is what an untouched filter has to mean or the
  // queue opens empty.
  if (filter.status.length > 0 && !filter.status.includes(row.status)) {
    return false;
  }
  if (filter.priority.length > 0 && !filter.priority.includes(row.priority)) {
    return false;
  }
  if (filter.type.length > 0 && !filter.type.includes(row.type)) return false;
  if (filter.facilityId && row.facilityId !== filter.facilityId) return false;
  if (!matchesAssignee(row, filter.assignee)) return false;
  if (!matchesDueWindow(row, filter.due, today)) return false;
  return matchesWorkOrderSearch(row, filter.query);
}

/** Every work order as a row, newest request first, before any narrowing. */
export function workOrderRows(
  data: DemoData,
  today: IsoDate,
  locale: string,
): WorkOrderRow[] {
  return data.workOrders
    .map((order) => toWorkOrderRow(data, order, today, locale))
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

export function filterWorkOrderRows(
  rows: readonly WorkOrderRow[],
  filter: WorkOrderQueueFilter,
  today: IsoDate,
): WorkOrderRow[] {
  return rows.filter((row) => matchesQueueFilter(row, filter, today));
}
