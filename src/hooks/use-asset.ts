"use client";

import { useMemo } from "react";
import {
  assetHistory,
  type HistoryEntry,
} from "@/data/selectors/asset-history";
import { toIsoDate } from "@/data/seed/dates";
import type {
  Asset,
  AssetType,
  DocumentRecord,
  Facility,
  Id,
  Inspection,
  InspectionTemplate,
  IsoDate,
  Location,
  MaintenancePlan,
  MaintenanceSchedule,
  Part,
  WorkOrder,
} from "@/domain/types";
import {
  hasRecords,
  useActor,
  useDemoData,
  useRepositories,
} from "@/hooks/use-demo-data";
import type { AssetUpdateInput } from "@/domain/schemas/asset";
import type { Role } from "@/domain/constants/roles";
import { useCallback } from "react";

/**
 * Everything the asset page shows, from one lookup.
 *
 * Three answers, not two, and the same three the label screen gives: `unknown`
 * while the browser is still reading the records, `missing` for a tag this
 * system does not hold, `found` otherwise. A tag that resolves to nothing is
 * not an empty asset — somebody is standing in front of a machine holding a
 * label, and telling them the asset is blank is worse than telling them it is
 * not here.
 */

export interface AssetDetail {
  asset: Asset;
  /** Null when the type does not resolve: unreadable, not "untyped". */
  type: AssetType | null;
  facility: Facility | null;
  /** Building, floor, room — outermost first. Empty when the location is gone. */
  locationPath: Location[];
  history: HistoryEntry[];
  workOrders: WorkOrder[];
  schedules: MaintenanceSchedule[];
  plans: MaintenancePlan[];
  /** Each inspection with the checklist it ran, which is the half that says what was checked. */
  inspections: {
    inspection: Inspection;
    template: InspectionTemplate | null;
  }[];
  documents: DocumentRecord[];
  /** Spares this asset has actually consumed — see the note below. */
  parts: Part[];
  today: IsoDate;
}

export type AssetLookup =
  | { state: "unknown" }
  | { state: "missing" }
  | { state: "found"; detail: AssetDetail };

export function useAsset(tag: string): AssetLookup {
  const { status, data } = useDemoData();
  const { repositories } = useRepositories();

  return useMemo<AssetLookup>(() => {
    if (!hasRecords(status) || !repositories || !data) {
      return { state: "unknown" };
    }

    const asset = repositories.assets.byTag(tag);
    if (!asset) {
      return { state: "missing" };
    }

    const workOrders = repositories.workOrders.list({ assetId: asset.id });
    const history = assetHistory(data, asset.id);

    /*
     * There is no asset-to-part relation in the model, because in life there
     * is not one either: a filter fits a family of units, not one machine.
     * What is true of this asset is what has actually been fitted to it, which
     * is its own stock movements — the same derivation the timeline uses.
     *
     * The alternative, every part held at the same site, would list a hundred
     * unrelated spares on every asset and mean nothing.
     */
    const partIds = new Set(
      history.flatMap((entry) =>
        entry.kind === "movement" ? [entry.transaction.partId] : [],
      ),
    );
    const parts = [...partIds].flatMap((partId) => {
      const part = repositories.parts.byId(partId);
      return part ? [part] : [];
    });

    return {
      state: "found",
      detail: {
        asset,
        type: repositories.assets.typeOf(asset) ?? null,
        facility: repositories.facilities.byId(asset.facilityId) ?? null,
        locationPath: repositories.assets.locationPath(asset),
        history,
        workOrders,
        schedules: repositories.maintenance.schedulesForAsset(asset.id),
        plans: repositories.maintenance.plansForAsset(asset.id),
        inspections: repositories.inspections
          .forAsset(asset.id)
          .map((inspection) => ({
            inspection,
            template:
              repositories.inspections.templateById(inspection.templateId) ??
              null,
          })),
        documents: repositories.documents.forAsset(asset.id),
        parts,
        today: toIsoDate(new Date()),
      },
    };
  }, [status, data, repositories, tag]);
}

/**
 * Changing an asset.
 *
 * The repository writes the record and its audit entry in one step, so there is
 * no way to change an asset without the trail saying who did it and when.
 *
 * Returns false when there was nothing to change. A form submitted with every
 * field as it already was should write nothing at all: an audit entry saying an
 * asset was updated, listing no change, is worse than silence — it is a record
 * of something that did not happen. The same rule the part repository applies
 * to a stock count that agrees with the record.
 */
export function useUpdateAsset(
  role: Role,
): (assetId: Id, changes: AssetUpdateInput) => boolean {
  const { repositories } = useRepositories();
  const actor = useActor(role);

  return useCallback(
    (assetId: Id, changes: AssetUpdateInput) => {
      if (!repositories) return false;

      const current = repositories.assets.byId(assetId);
      if (!current) return false;

      const changed = Object.fromEntries(
        Object.entries(changes).filter(
          ([field, value]) => current[field as keyof typeof current] !== value,
        ),
      ) as AssetUpdateInput;

      if (Object.keys(changed).length === 0) return false;

      repositories.assets.update(assetId, changed, actor);
      return true;
    },
    [repositories, actor],
  );
}
