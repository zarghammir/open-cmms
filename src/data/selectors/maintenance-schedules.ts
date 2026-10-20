import type { DemoData } from "@/data/seed";
import type {
  Asset,
  Facility,
  MaintenancePlan,
  MaintenanceSchedule,
  WorkOrder,
} from "@/domain/types";
import { isOpenStatus } from "@/domain/constants/work-order-status";

/**
 * The planned visits, resolved, and a count of the ones that could not be.
 *
 * A pure function over a snapshot, the way `part-detail` is: the screen is
 * handed what it draws and never reaches for a store.
 *
 * **The count is the point of the shape.** A visit whose plan or asset this
 * system cannot read has nothing a planner can act on — no equipment to send
 * anyone to, no checklist to raise — so it cannot be a row in a table whose
 * every column names one of those. But dropping it silently draws a list
 * shorter than the records, and a reader comparing "26 planned visits" against
 * a table showing 24 has no way to learn where the other two went. Three
 * states, never two: resolved, unreadable, and absent are different, and only
 * the last one means there is nothing there.
 */

export interface ResolvedSchedule {
  schedule: MaintenanceSchedule;
  plan: MaintenancePlan;
  asset: Asset;
  /** The site, or null when the asset names one this system cannot read. */
  facility: Facility | null;
  /**
   * The order outstanding for this visit, or null.
   *
   * Open only. A completed or cancelled order does not stand between a visit
   * and its next one, and showing it as though it did would tell a planner
   * work is in hand when it is finished.
   */
  openOrder: WorkOrder | null;
}

export interface ScheduleReading {
  resolved: ResolvedSchedule[];
  /** How many visits could not be resolved. Zero is a real answer. */
  unreadable: number;
}

export function scheduleReading(data: DemoData): ScheduleReading {
  const resolved: ResolvedSchedule[] = [];
  let unreadable = 0;

  for (const schedule of [...data.maintenanceSchedules].sort((a, b) =>
    a.nextDueOn.localeCompare(b.nextDueOn),
  )) {
    const plan = data.maintenancePlans.find(
      (candidate) => candidate.id === schedule.planId,
    );
    const asset = data.assets.find(
      (candidate) => candidate.id === schedule.assetId,
    );

    if (!plan || !asset) {
      unreadable += 1;
      continue;
    }

    const raised =
      schedule.workOrderId === null
        ? null
        : (data.workOrders.find(
            (candidate) => candidate.id === schedule.workOrderId,
          ) ?? null);

    resolved.push({
      schedule,
      plan,
      asset,
      facility:
        data.facilities.find((one) => one.id === asset.facilityId) ?? null,
      openOrder: raised && isOpenStatus(raised.status) ? raised : null,
    });
  }

  return { resolved, unreadable };
}
