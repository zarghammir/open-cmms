/**
 * The vocabulary every entity is built from.
 *
 * Phase 1 keeps records in the browser; Phase 2 keeps them in PostgreSQL. The
 * types here are written so that the swap changes where a record comes from
 * and nothing about its shape.
 */

/** A record identifier. Opaque — never parse meaning out of it. */
export type Id = string;

/** A calendar day, ISO 8601: `2026-09-12`. No time, no zone. */
export type IsoDate = string;

/** An instant, ISO 8601 with offset: `2026-09-12T14:05:00.000-04:00`. */
export type IsoDateTime = string;

/**
 * Text a person reads, held in both official languages.
 *
 * Interface chrome comes from `messages/{en,fr}.json`. Records cannot: a work
 * order's description belongs to the record, not to the catalogue. Holding
 * both languages on the record is what lets the French demo show French data
 * instead of English data under French labels.
 */
export interface LocalizedText {
  en: string;
  fr: string;
}

/**
 * Which language a person actually typed in.
 *
 * Interface text is translated; text a person writes is not. A work order
 * raised in French by a technician stays French, and a screen says so rather
 * than presenting it as though it were the reader's language.
 */
export type ContentLanguage = keyof LocalizedText;

/** Everything a tenant owns says which tenant owns it. */
export interface TenantOwned {
  organizationId: Id;
}

/** Names of the entities that can be audited or referred to. */
export type EntityName =
  | "workOrder"
  | "asset"
  | "part"
  | "inspection"
  | "maintenancePlan"
  | "document"
  | "user"
  | "inventoryTransaction"
  | "notification"
  | "importBatch"
  | "demo";

/** A pointer to another record, used by notifications and audit entries. */
export interface EntityRef {
  entity: EntityName;
  id: Id;
}
