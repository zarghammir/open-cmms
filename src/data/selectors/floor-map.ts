import { isOverdue } from "@/data/repositories/work-order";
import { partsFittedTo } from "@/data/selectors/asset-history";
import type { DemoData } from "@/data/seed";
import { isBelowMinimum } from "@/domain/constants/part";
import { isOpenStatus } from "@/domain/constants/work-order-status";
import type {
  Asset,
  AssetPlacement,
  FloorPlanImage,
  Id,
  IsoDate,
  WorkOrder,
} from "@/domain/types";

/**
 * What one floor looks like on the map.
 *
 * A pure function over a snapshot, like every other selector, so the map can be
 * tested without a store and without a browser.
 *
 * **The outline state is the dashboard's rule, imported rather than rewritten.**
 * `isOverdue`, `isOpenStatus` and `isBelowMinimum` are the same three
 * functions `kpi.ts` counts with, so a machine drawn in red on the plan and the
 * numbers in the tiles above it are the same claims about the same records. A
 * map that decided for itself what late meant — `dueAt < today` without asking
 * whether the order is still open, say — would disagree with the tile beside it
 * by exactly the orders somebody has already finished, and the reader would
 * have no way to tell which of the two was lying.
 */

/**
 * How a placed machine is outlined. Five answers, and the last is the point.
 *
 * `overdue` is work that is late; `open` is work in hand that is not late;
 * `lowStock` is a machine with nothing open against it whose own spares have
 * run below their minimum; `clear` is a machine with none of those.
 * `unreadable` is a marker whose asset the records do not hold — not a clear
 * machine, and drawing it as one would turn "we cannot tell you" into "nothing
 * is wrong here", which is the one sentence a maintenance map must never say by
 * accident.
 *
 * **One outline per machine, so they are ranked.** Late work outranks work in
 * hand, which outranks a shelf running low: the first two are jobs somebody is
 * waiting on and the third is a supply problem that has not stopped anything
 * yet. The panel beside the plan says all of it — a machine with open work
 * *and* a low spare shows both counts — so the ranking decides the colour and
 * never hides a fact.
 */
export type FloorMapState =
  "overdue" | "open" | "lowStock" | "clear" | "unreadable";

/**
 * What the map knows about a floor's drawing. Three answers, not two.
 *
 * `drawn` is a plan it can show. `none` is a floor that was surveyed and has no
 * plan on file. `unrecorded` is a floor nobody has looked at — the difference
 * being that the first is an answer and the second is the absence of one.
 */
export type FloorDrawing =
  | { kind: "drawn"; image: FloorPlanImage }
  | { kind: "none" }
  | { kind: "unrecorded" };

export interface PlacedAsset {
  placement: AssetPlacement;
  /** Null when the marker names an asset the records do not hold. */
  asset: Asset | null;
  state: FloorMapState;
  /**
   * How much work stands behind the outline. Null when the asset does not
   * resolve: a marker we cannot read has no count, and zero would read as
   * "nothing open", which is a different answer.
   */
  openCount: number | null;
  overdueCount: number | null;
  /**
   * Spares fitted to this machine that have run below their minimum.
   *
   * "Fitted to" is the relation the rest of the application already uses —
   * what has actually been issued against this machine's work orders — because
   * there is no asset-to-part link in the model and there is not one in life
   * either: a filter fits a family of units, not one machine. Every part held
   * at the same site would put a hundred unrelated spares on every marker.
   */
  lowParts: number | null;
  /**
   * The open work itself, newest first, for the panel to list.
   *
   * The counts above are what the outline is drawn from; this is what a person
   * reads when they want to know which jobs those are. Empty is an answer;
   * null is the unreadable marker, which has no orders to give.
   */
  openOrders: WorkOrder[] | null;
}

export interface FloorMapView {
  floorId: Id;
  drawing: FloorDrawing;
  /** Markers on this floor, in a stable order so two runs draw the same map. */
  placed: PlacedAsset[];
  /**
   * Equipment on this floor that no marker places.
   *
   * Listed rather than dropped: a machine the map cannot show is still a
   * machine on the floor, and a panel beside the plan that names it is the
   * difference between an incomplete map and a map that lies by omission.
   */
  unplaced: Asset[];
}

function stateOf(open: number, overdue: number, low: number): FloorMapState {
  if (overdue > 0) return "overdue";
  if (open > 0) return "open";
  if (low > 0) return "lowStock";
  return "clear";
}

export function floorMapView(
  data: DemoData,
  floorId: Id,
  today: IsoDate,
): FloorMapView {
  const plan = data.floorPlans.find((one) => one.floorId === floorId);
  const drawing: FloorDrawing = !plan
    ? { kind: "unrecorded" }
    : plan.image === null
      ? { kind: "none" }
      : { kind: "drawn", image: plan.image };

  const byId = new Map(data.assets.map((asset) => [asset.id, asset]));

  const placed: PlacedAsset[] = data.assetPlacements
    .filter((placement) => placement.floorId === floorId)
    .map((placement) => {
      const asset = byId.get(placement.assetId) ?? null;
      if (!asset) {
        return {
          placement,
          asset: null,
          state: "unreadable" as const,
          openCount: null,
          overdueCount: null,
          lowParts: null,
          openOrders: null,
        };
      }
      const orders = data.workOrders.filter(
        (order) => order.assetId === asset.id,
      );
      const openOrders = orders
        .filter((order) => isOpenStatus(order.status))
        .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
      const overdue = orders.filter((order) => isOverdue(order, today)).length;
      const low = partsFittedTo(data, asset.id).filter((part) =>
        isBelowMinimum(part),
      ).length;
      return {
        placement,
        asset,
        state: stateOf(openOrders.length, overdue, low),
        openCount: openOrders.length,
        overdueCount: overdue,
        lowParts: low,
        openOrders,
      };
    })
    .sort((a, b) =>
      (a.asset?.assetTag ?? a.placement.id).localeCompare(
        b.asset?.assetTag ?? b.placement.id,
      ),
    );

  const roomsOnFloor = new Set(
    data.locations
      .filter((one) => one.kind === "room" && one.parentId === floorId)
      .map((one) => one.id),
  );
  const markedAssetIds = new Set(placed.map((one) => one.placement.assetId));
  const unplaced = data.assets
    .filter(
      (asset) =>
        roomsOnFloor.has(asset.locationId) && !markedAssetIds.has(asset.id),
    )
    .sort((a, b) => a.assetTag.localeCompare(b.assetTag));

  return { floorId, drawing, placed, unplaced };
}

/**
 * What a footprint prints on the drawing, which is not always its whole tag.
 *
 * **A plan labels equipment with a short code.** Every machine on the drawn
 * floor is `XXX-MCT-11`: the same site and the same building on all eight, so
 * three quarters of each label is the part that never varies, and it is the
 * part that survives truncation while the part that identifies the machine is
 * what gets cut. Measured at 1440 before this existed: `AUT-…`, `EDS-MCT…`,
 * `R…`, `A…`, `E.` — an ellipsis where the answer should be.
 *
 * So the plan prints the prefix. The full tag is still the accessible name, the
 * tooltip and every row of the panel beside it, so nothing is lost for a reader
 * who needs it; what changes is that the drawing carries the part that tells
 * two machines apart.
 *
 * **It falls back the moment the short form stops being an answer.** If two
 * placed assets on the same floor share a prefix, the short code identifies
 * neither, and every footprint on that floor prints its whole tag instead. All
 * or nothing on purpose: a drawing where some labels are short and others are
 * long reads as a mistake, and the reader cannot tell which kind they are
 * looking at.
 */
export function planLabels(placed: PlacedAsset[]): Map<string, string> {
  const tags = placed
    .map((one) => one.asset?.assetTag)
    .filter((tag): tag is string => Boolean(tag));

  const short = (tag: string) => {
    const dash = tag.indexOf("-");
    return dash === -1 ? tag : tag.slice(0, dash);
  };
  const shortened = tags.map(short);
  const unique = new Set(shortened).size === shortened.length;

  return new Map(tags.map((tag) => [tag, unique ? short(tag) : tag]));
}
