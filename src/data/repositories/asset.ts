import type { Asset, AssetType, Id, Location } from "@/domain/types";
import type { AssetUpdateInput } from "@/domain/schemas/asset";
import { fieldChanges, type Actor } from "@/stores/mutations";
import type { RepositoryContext } from "./types";

export interface AssetFilter {
  facilityId?: Id;
  assetTypeId?: Id;
  status?: readonly Asset["status"][];
  criticality?: readonly Asset["criticality"][];
}

export interface AssetRepository {
  list: (filter?: AssetFilter) => Asset[];
  byId: (id: Id) => Asset | undefined;
  byTag: (tag: string) => Asset | undefined;
  typeOf: (asset: Asset) => AssetType | undefined;
  /** Every type, so an import can resolve a tag prefix without scanning assets. */
  types: () => AssetType[];
  locationOf: (asset: Asset) => Location | undefined;
  /** Building, floor, room — outermost first. Empty if the location is gone. */
  locationPath: (asset: Asset) => Location[];
  update: (id: Id, changes: AssetUpdateInput, actor: Actor) => Asset;
}

export function createAssetRepository(
  context: RepositoryContext,
): AssetRepository {
  const all = () => context.data.assets;

  return {
    list(filter) {
      return all().filter((asset) => {
        if (filter?.facilityId && asset.facilityId !== filter.facilityId) {
          return false;
        }
        if (filter?.assetTypeId && asset.assetTypeId !== filter.assetTypeId) {
          return false;
        }
        if (filter?.status && !filter.status.includes(asset.status)) {
          return false;
        }
        if (
          filter?.criticality &&
          !filter.criticality.includes(asset.criticality)
        ) {
          return false;
        }
        return true;
      });
    },

    byId(id) {
      return all().find((asset) => asset.id === id);
    },

    byTag(tag) {
      return all().find((asset) => asset.assetTag === tag);
    },

    types: () => context.data.assetTypes,

    typeOf(asset) {
      return context.data.assetTypes.find(
        (type) => type.id === asset.assetTypeId,
      );
    },

    locationOf(asset) {
      return context.data.locations.find(
        (location) => location.id === asset.locationId,
      );
    },

    locationPath(asset) {
      const path: Location[] = [];
      let current = this.locationOf(asset);
      while (current) {
        path.unshift(current);
        const parentId: Id | null = current.parentId;
        current = parentId
          ? context.data.locations.find((location) => location.id === parentId)
          : undefined;
      }
      return path;
    },

    update(id, changes, actor) {
      const asset = this.byId(id);
      if (!asset) {
        throw new Error(`No asset with id ${id}`);
      }
      const at = context.now().toISOString();
      const flat = changes as unknown as Record<string, unknown>;
      const difference = fieldChanges(
        asset as unknown as Record<string, unknown>,
        flat,
      );

      /*
       * A change that agrees with the record writes nothing at all — the same
       * line `adjust` takes for a stock count that matches. An audit entry
       * saying an asset was updated, listing no changed field, is a record of
       * something that did not happen, and a trail that carries those is worth
       * less than one that does not.
       *
       * The guard belongs here rather than only in the hook above it. A screen
       * can be careful; the repository is the thing that cannot be talked out
       * of it, and it is the only door — a future importer or a keyboard path
       * meets the same answer.
       */
      if (difference.length === 0) {
        return asset;
      }

      context.commit(
        {
          operation: "update",
          collection: "assets",
          id,
          changes: flat,
          actor,
          audit: {
            entity: "asset",
            action: "updated",
            summaryKey: "audit.assetUpdated",
            summaryParams: { tag: asset.assetTag },
            changes: difference,
          },
        },
        at,
      );

      return { ...asset, ...flat } as Asset;
    },
  };
}
