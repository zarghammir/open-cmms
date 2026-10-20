import type { DemoData } from "@/data/seed";
import { isBelowMinimum } from "@/domain/constants/part";
import { isOpenStatus } from "@/domain/constants/work-order-status";
import { isOverdue } from "@/data/repositories/work-order";
import type {
  Id,
  IsoDate,
  WorkOrderPriority,
  WorkOrderStatus,
} from "@/domain/types";

/**
 * The numbers the dashboard and the field home are built from.
 *
 * Pure functions over a snapshot, so they can be tested without a store and
 * without a browser, and so two screens showing "overdue" can never disagree
 * about what overdue means.
 */

export interface DashboardKpis {
  openWorkOrders: number;
  overdue: number;
  criticalOpen: number;
  waitingForParts: number;
  completedLastSevenDays: number;
  partsBelowMinimum: number;
  inspectionsScheduled: number;
}

function inFacility<T extends { facilityId: Id }>(
  records: readonly T[],
  facilityId?: Id,
): T[] {
  return facilityId
    ? records.filter((record) => record.facilityId === facilityId)
    : [...records];
}

export function dashboardKpis(
  data: DemoData,
  today: IsoDate,
  facilityId?: Id,
): DashboardKpis {
  const orders = inFacility(data.workOrders, facilityId);
  const open = orders.filter((order) => isOpenStatus(order.status));

  // Seven days back, inclusive of today. Comparing ISO dates as strings is
  // exact here because they are all zero-padded and in the same zone.
  const weekAgo = new Date(`${today}T00:00:00.000Z`);
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
  const weekAgoIso = weekAgo.toISOString().slice(0, 10);

  return {
    openWorkOrders: open.length,
    overdue: orders.filter((order) => isOverdue(order, today)).length,
    criticalOpen: open.filter((order) => order.priority === "critical").length,
    waitingForParts: orders.filter(
      (order) => order.status === "waitingForParts",
    ).length,
    completedLastSevenDays: orders.filter(
      (order) =>
        order.status === "completed" &&
        order.completedAt !== null &&
        order.completedAt.slice(0, 10) >= weekAgoIso,
    ).length,
    partsBelowMinimum: inFacility(data.parts, facilityId).filter((part) =>
      isBelowMinimum(part),
    ).length,
    inspectionsScheduled: inFacility(data.inspections, facilityId).filter(
      (inspection) => inspection.status === "scheduled",
    ).length,
  };
}

/** Every status, including the ones with nothing in them. */
export function workOrdersByStatus(
  data: DemoData,
  facilityId?: Id,
): Record<WorkOrderStatus, number> {
  const counts: Record<WorkOrderStatus, number> = {
    open: 0,
    assigned: 0,
    inProgress: 0,
    waitingForParts: 0,
    completed: 0,
    cancelled: 0,
  };
  for (const order of inFacility(data.workOrders, facilityId)) {
    counts[order.status] += 1;
  }
  return counts;
}

export function openWorkOrdersByPriority(
  data: DemoData,
  facilityId?: Id,
): Record<WorkOrderPriority, number> {
  const counts: Record<WorkOrderPriority, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const order of inFacility(data.workOrders, facilityId)) {
    if (isOpenStatus(order.status)) counts[order.priority] += 1;
  }
  return counts;
}
