import type {
  Id,
  IsoDate,
  IsoDateTime,
  LocalizedText,
  TenantOwned,
} from "./common";

export const INSPECTION_STATUSES = [
  "scheduled",
  "inProgress",
  "passed",
  "failed",
] as const;
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

/**
 * Three responses, not two. "Not applicable" is a real answer on a checklist
 * and must not be recorded as a pass.
 */
export const INSPECTION_RESPONSES = ["pass", "fail", "notApplicable"] as const;
export type InspectionResponse = (typeof INSPECTION_RESPONSES)[number];

export const FINDING_SEVERITIES = ["minor", "major", "critical"] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export interface InspectionTemplateItem {
  id: Id;
  sequence: number;
  prompt: LocalizedText;
  requiresNoteOnFail: boolean;
}

export interface InspectionTemplate extends TenantOwned {
  id: Id;
  code: string;
  name: LocalizedText;
  description: LocalizedText;
  /** The kinds of equipment this checklist applies to. */
  assetTypeIds: readonly Id[];
  items: readonly InspectionTemplateItem[];
}

export interface Inspection extends TenantOwned {
  id: Id;
  templateId: Id;
  assetId: Id;
  facilityId: Id;
  scheduledFor: IsoDate;
  performedAt: IsoDateTime | null;
  performedByUserId: Id | null;
  status: InspectionStatus;
  /** The corrective order raised from a failure, if one was raised. */
  workOrderId: Id | null;
}

export interface InspectionResult extends TenantOwned {
  id: Id;
  inspectionId: Id;
  templateItemId: Id;
  response: InspectionResponse;
  note: string | null;
  recordedAt: IsoDateTime;
}

export interface InspectionFinding extends TenantOwned {
  id: Id;
  inspectionId: Id;
  templateItemId: Id;
  severity: FindingSeverity;
  summary: LocalizedText;
  correctiveWorkOrderId: Id | null;
}
