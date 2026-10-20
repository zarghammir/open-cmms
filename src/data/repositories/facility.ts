import type {
  Facility,
  Id,
  InventoryLocation,
  Location,
  Organization,
} from "@/domain/types";
import type { RepositoryContext } from "./types";

export interface FacilityRepository {
  list: () => Facility[];
  byId: (id: Id) => Facility | undefined;
  byCode: (code: string) => Facility | undefined;
  locationsIn: (facilityId: Id) => Location[];
  /** Resolves a room code such as `KGN-B02-219`, as the MP2 import does. */
  locationByCode: (code: string) => Location | undefined;
  binByCode: (code: string) => InventoryLocation | undefined;
  /** A part carries its bin by id; a label and a count sheet show the code. */
  binById: (id: Id) => InventoryLocation | undefined;
  /** Every bin, for an importer that has to know which codes exist. */
  bins: () => InventoryLocation[];
  /** The tenant. Phase 1 seeds exactly one. */
  organization: () => Organization;
}

export function createFacilityRepository(
  context: RepositoryContext,
): FacilityRepository {
  return {
    list: () => context.data.facilities,
    byId: (id) =>
      context.data.facilities.find((facility) => facility.id === id),
    byCode: (code) =>
      context.data.facilities.find((facility) => facility.code === code),
    locationsIn: (facilityId) =>
      context.data.locations.filter(
        (location) => location.facilityId === facilityId,
      ),
    locationByCode: (code) =>
      context.data.locations.find((location) => location.code === code),
    binByCode: (code) =>
      context.data.inventoryLocations.find((bin) => bin.code === code),
    binById: (id) =>
      context.data.inventoryLocations.find((bin) => bin.id === id),
    bins: () => context.data.inventoryLocations,
    organization: () => context.data.organization,
  };
}
