"use client";

import { useMemo } from "react";
import { toIsoDate } from "@/data/seed/dates";
import {
  exceptionRows,
  myAssignments,
  recentActivity,
  upcomingMaintenance,
  type ActivityRow,
  type MaintenanceRow,
  type WorkRow,
} from "@/data/selectors/dashboard";
import {
  dashboardKpis,
  workOrdersByStatus,
  type DashboardKpis,
} from "@/data/selectors/kpi";
import type { Role } from "@/domain/constants/roles";
import type { Facility, Id, WorkOrderStatus } from "@/domain/types";
import { useActor, useDemoData } from "@/hooks/use-demo-data";
import type { DemoStatus } from "@/stores/demo-store";

/**
 * What the home screens read.
 *
 * The screens never touch the records: they ask this, it asks the selectors,
 * and the selectors are pure functions over the snapshot the store holds. Every
 * number and every row on the dashboard comes from one call, so the cards, the
 * chart and the lists cannot narrow to different sites or disagree about what
 * is overdue.
 *
 * Everything is null until the browser has finished reading the database.
 * Null, not zero and not an empty array: "nothing needs attention" is a claim,
 * and it is not one this hook can make before it has read anything.
 */

export interface DashboardModel {
  status: DemoStatus;
  kpis: DashboardKpis | null;
  byStatus: Record<WorkOrderStatus, number> | null;
  exceptions: WorkRow[] | null;
  upcoming: MaintenanceRow[] | null;
  activity: ActivityRow[] | null;
  facilities: Facility[] | null;
}

/**
 * The day the screens reckon from.
 *
 * The same call `ensureSeeded` makes, so the dashboard's idea of today is the
 * one the records were built for. A tab left open across midnight reads a day
 * ahead of its data until the next load reseeds it — which is exactly what the
 * store does on that load, so the two stay in step.
 */
function today(): string {
  return toIsoDate(new Date());
}

export function useDashboard(facilityId?: Id): DashboardModel {
  const { status, data } = useDemoData();

  return useMemo(() => {
    if (!data) {
      return {
        status,
        kpis: null,
        byStatus: null,
        exceptions: null,
        upcoming: null,
        activity: null,
        facilities: null,
      };
    }

    const day = today();
    // An address naming a site that is not in the records is a broken link, not
    // a site with nothing at it: fall back to every site, which is what the
    // filter control will then show as selected.
    const site = data.facilities.some((facility) => facility.id === facilityId)
      ? facilityId
      : undefined;

    return {
      status,
      kpis: dashboardKpis(data, day, site),
      byStatus: workOrdersByStatus(data, site),
      exceptions: exceptionRows(data, day, site),
      upcoming: upcomingMaintenance(data, day, undefined, site),
      activity: recentActivity(data, undefined, site),
      facilities: data.facilities,
    };
  }, [status, data, facilityId]);
}

export interface MyWorkModel {
  status: DemoStatus;
  /** Null until the records have been read. Never an empty stand-in. */
  rows: WorkRow[] | null;
}

/** The field home: the work assigned to the person holding this role. */
export function useMyWork(role: Role): MyWorkModel {
  const { status, data } = useDemoData();
  const actor = useActor(role);

  return useMemo(
    () => ({
      status,
      rows: data ? myAssignments(data, today(), actor.userId) : null,
    }),
    [status, data, actor.userId],
  );
}
