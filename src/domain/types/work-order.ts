import type {
  ContentLanguage,
  Id,
  IsoDate,
  IsoDateTime,
  LocalizedText,
  TenantOwned,
} from "./common";

export const WORK_ORDER_STATUSES = [
  "open",
  "assigned",
  "inProgress",
  "waitingForParts",
  "completed",
  "cancelled",
] as const;
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export const WORK_ORDER_PRIORITIES = [
  "critical",
  "high",
  "medium",
  "low",
] as const;
export type WorkOrderPriority = (typeof WORK_ORDER_PRIORITIES)[number];

export const WORK_ORDER_TYPES = [
  "preventive",
  "corrective",
  "emergency",
  "inspection",
  "calibration",
  "safety",
] as const;
export type WorkOrderType = (typeof WORK_ORDER_TYPES)[number];

/**
 * Why a work order was cancelled.
 *
 * A key, not a sentence: the reason is shown to a French reader as often as to
 * an English one. `notRecordedInSource` exists for the MP2 import, whose
 * source system has no reason column — WA-17 records the absence rather than
 * inventing a reason, and the rule that cancelling requires a reason still
 * holds.
 */
export const CANCELLATION_REASONS = [
  "duplicate",
  "noLongerRequired",
  "assetDecommissioned",
  "handledUnderAnotherOrder",
  "notRecordedInSource",
] as const;
export type CancellationReasonKey = (typeof CANCELLATION_REASONS)[number];

export interface CancellationReason {
  key: CancellationReasonKey;
  /** Optional free text a person typed. Never the only record of the reason. */
  note: string | null;
}

/** Where the record came from. The import wizard sets `import`. */
export type WorkOrderSource = "manual" | "plan" | "import";

export interface WorkOrder extends TenantOwned {
  id: Id;
  /** `WO-2026-0001`. Distinct from the MP2 fixture's `WO-1000nn` series. */
  number: string;
  title: LocalizedText;
  description: LocalizedText;
  /**
   * The language the title and description were typed in, or null when the
   * record was authored in both — as the seeded ones are.
   *
   * When it is set, both slots hold the same words: the ones a person wrote.
   * Nothing invents a translation, and a screen showing them to a reader of
   * the other language says which language they are in.
   */
  contentLanguage: ContentLanguage | null;
  assetId: Id;
  facilityId: Id;
  locationId: Id;
  type: WorkOrderType;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  requestedAt: IsoDateTime;
  dueAt: IsoDate | null;
  startedAt: IsoDateTime | null;
  completedAt: IsoDateTime | null;
  cancelledAt: IsoDateTime | null;
  /** Present when and only when the status is `cancelled`. */
  cancellationReason: CancellationReason | null;
  maintenancePlanId: Id | null;
  source: WorkOrderSource;
  estimatedMinutes: number | null;
}

export interface WorkOrderTask extends TenantOwned {
  id: Id;
  workOrderId: Id;
  sequence: number;
  description: LocalizedText;
  done: boolean;
  completedAt: IsoDateTime | null;
  completedByUserId: Id | null;
}

/**
 * Who is doing the work.
 *
 * `userId` and `crewCode` are both nullable and they mean different things.
 * An order with neither is unassigned. An order with a crew code and no user
 * came from a legacy import whose code did not resolve to a person: the code
 * is kept so the record says what the source said, instead of quietly
 * reading as unassigned.
 */
export interface WorkOrderAssignment extends TenantOwned {
  id: Id;
  workOrderId: Id;
  userId: Id | null;
  crewCode: string | null;
  assignedAt: IsoDateTime;
  assignedByUserId: Id;
}

export interface WorkOrderStatusHistory extends TenantOwned {
  id: Id;
  workOrderId: Id;
  /** Null only for the entry that records the order being raised. */
  from: WorkOrderStatus | null;
  to: WorkOrderStatus;
  at: IsoDateTime;
  byUserId: Id;
  reason: CancellationReason | null;
}

/**
 * Time somebody spent on a work order.
 *
 * The entries are the record; there is no stored total. A number on the order
 * saying "180 minutes" beside a list of entries adding to 150 is a question
 * nobody can answer, and the way to be sure that never happens is not to keep
 * the number. `loggedMinutes` in `data/selectors/labour.ts` derives it, and
 * returns null — not zero — when nobody has logged anything.
 *
 * `minutes` is positive. An entry recording no time is not an entry.
 */
export interface LabourEntry extends TenantOwned {
  id: Id;
  workOrderId: Id;
  userId: Id;
  minutes: number;
  /** When the work was done, not when the row was typed. */
  workedAt: IsoDateTime;
  note: string | null;
}

/**
 * Something a person wrote on a work order.
 *
 * `body` is one string, not `LocalizedText`, and that is the whole point. Every
 * seeded record carries both languages because the seed generates them; a
 * comment exists in the language the person typed it in, and putting it in both
 * slots would mean inventing words they did not write.
 *
 * `contentLanguage` is WA-27's field and is not null here. A work order can be
 * authored in both — the seeded ones are — but nobody types a comment twice.
 * WA-32's "as written in English" marker reads this to tell a French reader why
 * the text in front of them is English.
 */
export interface WorkOrderComment extends TenantOwned {
  id: Id;
  workOrderId: Id;
  authorUserId: Id;
  body: string;
  contentLanguage: ContentLanguage;
  createdAt: IsoDateTime;
}
