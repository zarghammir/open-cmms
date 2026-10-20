import type { Id, IsoDate, LocalizedText, TenantOwned } from "./common";

export const ASSET_STATUSES = ["active", "inactive", "decommissioned"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ASSET_CRITICALITIES = [
  "critical",
  "high",
  "medium",
  "low",
] as const;
export type AssetCriticality = (typeof ASSET_CRITICALITIES)[number];

/** Broad families, used to group reports and to pool credible manufacturers. */
export const ASSET_CATEGORIES = [
  "airHandling",
  "heatingCooling",
  "electrical",
  "lifeSafety",
  "laboratory",
  "water",
  "conveyance",
] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

/**
 * A kind of equipment. The label lives on the type, not on every asset, so
 * "Air handling unit" is translated once.
 */
export interface AssetType extends TenantOwned {
  id: Id;
  key: string;
  label: LocalizedText;
  category: AssetCategory;
  /** The prefix a tag starts with, `AHU` in `AHU-KGN-01`. */
  tagPrefix: string;
}

export interface Asset extends TenantOwned {
  id: Id;
  /**
   * The tag people say out loud, `AHU-KGN-01`. Unique within the seed, and
   * deliberately disjoint from every tag in the MP2 fixture so that the
   * import's duplicate report stays exactly as long as WA-29 documented it.
   */
  assetTag: string;
  name: LocalizedText;
  assetTypeId: Id;
  facilityId: Id;
  locationId: Id;
  manufacturer: string;
  model: string;
  serialNumber: string;
  installedAt: IsoDate;
  status: AssetStatus;
  criticality: AssetCriticality;
  parentAssetId: Id | null;
}
