import type { Id, LocalizedText, TenantOwned } from "./common";

/** The tenant. Phase 1 seeds exactly one; the model allows more. */
export interface Organization {
  id: Id;
  /** Fictional. No real organisation is named anywhere in this project. */
  name: LocalizedText;
  code: string;
}

/**
 * The five site codes ratified on WA-29. They are the first segment of every
 * location and bin code in the MP2 import fixture, so changing one here makes
 * that import resolve nothing.
 */
export const SITE_CODES = ["KGN", "SUD", "MCT", "KAM", "REG"] as const;
export type SiteCode = (typeof SITE_CODES)[number];

export type ProvinceCode = "ON" | "NB" | "BC" | "SK";

export interface Facility extends TenantOwned {
  id: Id;
  code: SiteCode;
  name: LocalizedText;
  city: LocalizedText;
  province: ProvinceCode;
  /** IANA zone. Displayed dates still use the fixed application zone. */
  timeZone: string;
}

/**
 * A place inside a site. The tree is building, then floor, then room, which is
 * exactly what the `SITE-Bnn-rrr` code carries: `KGN-B02-219` is building 02,
 * floor 2, room 219.
 */
export type LocationKind = "building" | "floor" | "room";

export interface Location extends TenantOwned {
  id: Id;
  facilityId: Id;
  /** The building a floor belongs to, the floor a room belongs to. */
  parentId: Id | null;
  kind: LocationKind;
  /** The full code, matched verbatim by the MP2 import: `KGN-B02-219`. */
  code: string;
  name: LocalizedText;
}

/** A bin, `SITE-Xnn-nn`: aisle and shelf inside a site's store room. */
export interface InventoryLocation extends TenantOwned {
  id: Id;
  facilityId: Id;
  /** The full code, matched verbatim by the MP2 import: `KGN-C11-05`. */
  code: string;
  aisle: string;
  shelf: string;
}

/**
 * Where a piece of equipment sits on a floor plan, and how big it is.
 *
 * Fractions of the plan's width and height, not pixels. A drawing replaced at a
 * different resolution — and the Moncton plan is one bitmap today that a real
 * deployment would swap for a CAD export — would otherwise move every asset on
 * it, silently and by exactly the ratio nobody measured. Fractions survive that;
 * pixels are a number that is only true against one file.
 *
 * `x` and `y` are the top-left corner rather than the centre, because that is
 * what a rectangle is drawn from and a centre would have to be converted at
 * every use.
 *
 * One row per tracked asset per floor. An asset with no row is not on the map
 * and is not an error: the estate has equipment nobody has placed yet, and the
 * map says so by leaving it in the list rather than inventing a position for
 * it.
 */
export interface AssetPlacement extends TenantOwned {
  id: Id;
  assetId: Id;
  /** The floor this places the asset on: a `Location` of kind `floor`. */
  floorId: Id;
  /** Left edge, as a fraction of the plan's width. */
  x: number;
  /** Top edge, as a fraction of the plan's height. */
  y: number;
  /** Width, as a fraction of the plan's width. */
  width: number;
  /** Height, as a fraction of the plan's height. */
  height: number;
}

/**
 * The drawing itself: where the file is and how big it was authored.
 *
 * The three travel together because they describe one file. Split apart, a
 * record could carry a size with no drawing — a measurement of nothing — and
 * every consumer would check three fields to learn one thing.
 *
 * The image is a static asset served by its path, not a record: a bitmap in
 * IndexedDB would be megabytes of base64 in every browser that opened the
 * demonstration, and the file is already being shipped.
 */
export interface FloorPlanImage {
  /** Served from `public/`, so `/floorplans/…`. */
  path: string;
  /** The drawing's own pixel size, so a caller can keep its aspect ratio. */
  widthPx: number;
  heightPx: number;
}

/**
 * What the map knows about one floor.
 *
 * **Three answers, not two.** No row at all means nobody has looked: the floor
 * exists in `locations`, and whether a drawing exists for it was never
 * recorded. A row with `image: null` means somebody did look and there is no
 * drawing on file — the floor is surveyed, the plan is not digitised. A row
 * with an image is a floor the map can draw. A screen that folded the first two
 * together would tell a reader "no plan for this floor" about a floor nobody
 * has ever asked about, which is the guess this codebase keeps refusing to
 * make.
 *
 * Placements hang off the drawing, so a floor with `image: null` carries none:
 * a fraction of a plan that does not exist is not a position.
 */
export interface FloorPlan extends TenantOwned {
  id: Id;
  floorId: Id;
  image: FloorPlanImage | null;
}
