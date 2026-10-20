import type { DemoData } from "@/data/seed";
import { isOpenStatus } from "@/domain/constants/work-order-status";
import type { Id, LocalizedText, LocationKind } from "@/domain/types";

/**
 * The places this organisation looks after, as a tree, with what is at each.
 *
 * Built from the records the assets already carry rather than from a second
 * list of places: a site is a `Facility`, and a building, floor and room are
 * `Location`s linked by `parentId`. Nothing here invents structure, so the tree
 * cannot describe a building the equipment does not agree exists.
 */

export type FacilityNodeKind = "site" | LocationKind;

export interface FacilityNode {
  id: Id;
  kind: FacilityNodeKind;
  /** `KGN`, `KGN-B02`, `KGN-B02-219` — what a person says out loud. */
  code: string;
  name: LocalizedText;
  /**
   * Equipment **at this node or anywhere below it**, so a site's number is the
   * sum of its rooms rather than the handful of assets filed directly on it.
   * A count that only looked at the node itself would read zero for every site
   * in the organisation, which is worse than no number.
   */
  equipment: number;
  /** Open work at this node or below, "open" being `isOpenStatus` and nothing else. */
  openWork: number;
  children: FacilityNode[];
}

/** Every location id at or below one node, itself included. */
function subtree(
  id: Id,
  childrenOf: Map<Id | null, { id: Id }[]>,
  into: Set<Id>,
): Set<Id> {
  into.add(id);
  for (const child of childrenOf.get(id) ?? []) {
    subtree(child.id, childrenOf, into);
  }
  return into;
}

export function facilityTree(data: DemoData): FacilityNode[] {
  const childrenOf = new Map<Id | null, (typeof data.locations)[number][]>();
  for (const location of data.locations) {
    const siblings = childrenOf.get(location.parentId) ?? [];
    siblings.push(location);
    childrenOf.set(location.parentId, siblings);
  }

  /*
   * Counted once per place, then read by every node above it.
   *
   * The obvious shape — walk the tree and filter the assets at each node — is
   * quadratic and, worse, invites two different filters to drift: the room's
   * and the site's. One index, read the same way at every level, cannot.
   */
  const equipmentAt = new Map<Id, number>();
  for (const asset of data.assets) {
    equipmentAt.set(
      asset.locationId,
      (equipmentAt.get(asset.locationId) ?? 0) + 1,
    );
  }

  const openWorkAt = new Map<Id, number>();
  for (const order of data.workOrders) {
    if (!isOpenStatus(order.status)) continue;
    openWorkAt.set(
      order.locationId,
      (openWorkAt.get(order.locationId) ?? 0) + 1,
    );
  }

  const sum = (ids: Set<Id>, counts: Map<Id, number>) => {
    let total = 0;
    for (const id of ids) total += counts.get(id) ?? 0;
    return total;
  };

  function node(location: (typeof data.locations)[number]): FacilityNode {
    const ids = subtree(location.id, childrenOf, new Set<Id>());
    return {
      id: location.id,
      kind: location.kind,
      code: location.code,
      name: location.name,
      equipment: sum(ids, equipmentAt),
      openWork: sum(ids, openWorkAt),
      children: (childrenOf.get(location.id) ?? [])
        .map(node)
        .sort((a, b) => a.code.localeCompare(b.code)),
    };
  }

  return [...data.facilities]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((facility) => {
      const buildings = (childrenOf.get(null) ?? [])
        .filter((location) => location.facilityId === facility.id)
        .map(node)
        .sort((a, b) => a.code.localeCompare(b.code));

      /*
       * A site counts everything filed against it, not only what hangs off its
       * buildings. An asset whose location is a room reaches the site through
       * the tree; one filed directly against the site would otherwise vanish
       * from every number on the screen while still appearing in the register.
       */
      const inSite = new Set<Id>(
        data.locations
          .filter((location) => location.facilityId === facility.id)
          .map((location) => location.id),
      );

      return {
        id: facility.id,
        kind: "site" as const,
        code: facility.code,
        name: facility.name,
        equipment: sum(inSite, equipmentAt),
        openWork: sum(inSite, openWorkAt),
        children: buildings,
      };
    });
}

/** The equipment in one room, in the order a register would list it. */
export function equipmentIn(data: DemoData, locationId: Id) {
  return data.assets
    .filter((asset) => asset.locationId === locationId)
    .sort((a, b) => a.assetTag.localeCompare(b.assetTag));
}
