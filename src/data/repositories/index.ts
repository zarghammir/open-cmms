import { createAssetRepository, type AssetRepository } from "./asset";
import { createAuditRepository, type AuditRepository } from "./audit";
import { createDocumentRepository, type DocumentRepository } from "./document";
import { createFacilityRepository, type FacilityRepository } from "./facility";
import { createImportRepository, type ImportRepository } from "./import";
import {
  createInspectionRepository,
  type InspectionRepository,
} from "./inspection";
import {
  createMaintenanceRepository,
  type MaintenanceRepository,
} from "./maintenance";
import {
  createNotificationRepository,
  type NotificationRepository,
} from "./notification";
import { createPartRepository, type PartRepository } from "./part";
import { createReportRepository, type ReportRepository } from "./report";
import { createSettingsRepository, type SettingsRepository } from "./settings";
import { createUserRepository, type UserRepository } from "./user";
import {
  createWorkOrderRepository,
  type WorkOrderRepository,
} from "./work-order";
import type { RepositoryContext } from "./types";

export type { RepositoryContext };
// Re-exported from the domain, where WA-39 moved it so a screen can
// recognise a refusal without importing across the data boundary.
export { TransitionRefusedError } from "@/domain/constants/work-order-status";
export { isOverdue } from "./work-order";
export type { WorkOrderFilter } from "./work-order";
export type { AssetFilter } from "./asset";

/**
 * The whole data surface a screen may touch.
 *
 * A page asks a feature hook, the hook asks one of these, and only these write
 * to the store. Nothing above this line knows the records live in the browser,
 * which is the entire point: Phase 2 swaps the implementations for REST calls
 * and no screen changes.
 */
export interface Repositories {
  workOrders: WorkOrderRepository;
  assets: AssetRepository;
  facilities: FacilityRepository;
  parts: PartRepository;
  reports: ReportRepository;
  /** The rules an administrator may change, and their trail. */
  settings: SettingsRepository;
  users: UserRepository;
  notifications: NotificationRepository;
  audit: AuditRepository;
  /**
   * Read-only and deliberately thin, added by WA-10 so the asset page can show
   * what hangs off an asset. WA-19, WA-20 and WA-21 own these areas and extend
   * them rather than replacing them.
   */
  maintenance: MaintenanceRepository;
  inspections: InspectionRepository;
  documents: DocumentRepository;
  imports: ImportRepository;
}

export function createRepositories(context: RepositoryContext): Repositories {
  return {
    workOrders: createWorkOrderRepository(context),
    assets: createAssetRepository(context),
    facilities: createFacilityRepository(context),
    parts: createPartRepository(context),
    reports: createReportRepository(context),
    settings: createSettingsRepository(context),
    users: createUserRepository(context),
    notifications: createNotificationRepository(context),
    audit: createAuditRepository(context),
    maintenance: createMaintenanceRepository(context),
    inspections: createInspectionRepository(context),
    documents: createDocumentRepository(context),
    imports: createImportRepository(context),
  };
}
