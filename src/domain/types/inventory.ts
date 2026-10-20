import type { Id, IsoDateTime, LocalizedText, TenantOwned } from "./common";

export const PART_CATEGORIES = [
  "filters",
  "beltsAndSeals",
  "lamps",
  "sensors",
  "valves",
  "pumps",
  "electrical",
  "water",
  "lifeSafety",
  "consumables",
] as const;
export type PartCategory = (typeof PART_CATEGORIES)[number];

export const UNITS_OF_MEASURE = [
  "each",
  "box",
  "litre",
  "metre",
  "kit",
] as const;
export type UnitOfMeasure = (typeof UNITS_OF_MEASURE)[number];

export interface Part extends TenantOwned {
  id: Id;
  /**
   * The stock number, `FLT-2101`. Disjoint from every stock number in the MP2
   * fixture, so importing it does not manufacture duplicates.
   */
  partNumber: string;
  name: LocalizedText;
  category: PartCategory;
  /** Canadian dollars. Money is never a float in Phase 2; here it is data. */
  unitCost: number;
  unitOfMeasure: UnitOfMeasure;
  quantityOnHand: number;
  reorderPoint: number;
  facilityId: Id;
  inventoryLocationId: Id;
}

export const INVENTORY_TRANSACTION_KINDS = [
  "issue",
  "receipt",
  "adjustment",
  "return",
] as const;
export type InventoryTransactionKind =
  (typeof INVENTORY_TRANSACTION_KINDS)[number];

export interface InventoryTransaction extends TenantOwned {
  id: Id;
  partId: Id;
  kind: InventoryTransactionKind;
  /** Signed: negative takes stock out, positive puts it back. */
  quantity: number;
  at: IsoDateTime;
  byUserId: Id;
  workOrderId: Id | null;
  note: string | null;
}
