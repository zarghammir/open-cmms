import type { Id, IsoDate, LocalizedText, TenantOwned } from "./common";

export const SCHEDULE_FREQUENCIES = [
  "weekly",
  "monthly",
  "quarterly",
  "semiAnnual",
  "annual",
] as const;
export type ScheduleFrequency = (typeof SCHEDULE_FREQUENCIES)[number];

/** How often a kind of equipment is serviced, and what the visit involves. */
export interface MaintenancePlan extends TenantOwned {
  id: Id;
  code: string;
  name: LocalizedText;
  description: LocalizedText;
  assetTypeId: Id;
  frequency: ScheduleFrequency;
  /** Days before the due date that the work order is raised. */
  leadTimeDays: number;
  estimatedMinutes: number;
  active: boolean;
  tasks: readonly LocalizedText[];
}

/** One asset's place in a plan: when it was last done, when it is next due. */
export interface MaintenanceSchedule extends TenantOwned {
  id: Id;
  planId: Id;
  assetId: Id;
  lastCompletedOn: IsoDate | null;
  nextDueOn: IsoDate;
  /** The order raised for the next visit, if it has been raised yet. */
  workOrderId: Id | null;
}
