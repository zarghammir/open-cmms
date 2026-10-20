import type {
  AssetCriticality,
  AssetStatus,
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderType,
} from "@/domain/types";

/**
 * Legacy codes to WorkAxis domain values.
 *
 * The right-hand side is a domain value, never an English word. What a person
 * reads comes from the catalogues; if these tables held "Waiting for Parts" the
 * French demonstration would show English inside its own records.
 *
 * Every table returns `undefined` for a code it does not know rather than a
 * default. An unrecognised status is not "open", and a priority the export
 * spells differently is not "medium" — guessing here writes a fact into a
 * maintenance record that nobody typed.
 */

const ASSET_STATUS: Record<string, AssetStatus> = {
  A: "active",
  ACTIVE: "active",
  I: "inactive",
  INACTIVE: "inactive",
  D: "decommissioned",
  DECOMM: "decommissioned",
};

const ASSET_CRITICALITY: Record<string, AssetCriticality> = {
  C: "critical",
  H: "high",
  M: "medium",
  L: "low",
};

const WORK_ORDER_STATUS: Record<string, WorkOrderStatus> = {
  OPEN: "open",
  ASSGN: "assigned",
  ASSIGNED: "assigned",
  INPRG: "inProgress",
  WMATL: "waitingForParts",
  COMP: "completed",
  CANC: "cancelled",
};

const WORK_ORDER_TYPE: Record<string, WorkOrderType> = {
  PM: "preventive",
  CM: "corrective",
  EM: "emergency",
  INSP: "inspection",
  CAL: "calibration",
  SAF: "safety",
};

/** MP2 numbers priorities high-to-low: 1 is the one that cannot wait. */
const WORK_ORDER_PRIORITY: Record<string, WorkOrderPriority> = {
  "1": "critical",
  "2": "high",
  "3": "medium",
  "4": "low",
};

export function assetStatusFor(code: string): AssetStatus | undefined {
  return ASSET_STATUS[code.trim().toUpperCase()];
}

export function assetCriticalityFor(
  code: string,
): AssetCriticality | undefined {
  return ASSET_CRITICALITY[code.trim().toUpperCase()];
}

export function workOrderStatusFor(code: string): WorkOrderStatus | undefined {
  return WORK_ORDER_STATUS[code.trim().toUpperCase()];
}

export function workOrderTypeFor(code: string): WorkOrderType | undefined {
  return WORK_ORDER_TYPE[code.trim().toUpperCase()];
}

export function workOrderPriorityFor(
  code: string | number,
): WorkOrderPriority | undefined {
  return WORK_ORDER_PRIORITY[String(code).trim()];
}

/** The type prefix of an asset tag: `AHU` in `AHU-KGN-01`. */
export function tagPrefixOf(assetTag: string): string {
  return assetTag.split("-")[0]?.toUpperCase() ?? "";
}
