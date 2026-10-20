"use client";

import { useMemo } from "react";
import { equipmentIn } from "@/data/selectors/facility-tree";
import { floorMapView, type FloorMapView } from "@/data/selectors/floor-map";
import { toIsoDate } from "@/data/seed/dates";
import type {
  Asset,
  Facility,
  Id,
  IsoDate,
  LocalizedText,
  Location,
} from "@/domain/types";
import {
  hasRecords,
  useDemoData,
  useRepositories,
} from "@/hooks/use-demo-data";
import type { DemoStatus } from "@/stores/demo-store";

/**
 * One floor, its drawing, and everything standing on it.
 *
 * **Four answers, not two.** `unknown` is the moment before the browser has
 * read its records back — a map drawn as empty then would tell a reviewer this
 * floor holds nothing. `missing` is a code this system does not hold. `notAFloor`
 * is a code it does hold that names something else: a room code typed into the
 * map address is not a failed lookup and not a floor, and answering "we have
 * never heard of it" about a room printed on a door is the kind of near-miss
 * that sends somebody looking for a records problem that does not exist.
 *
 * `found` carries the whole screen from one lookup, the way `useAsset` does, so
 * the map, the room list and the panel beside them cannot be drawn from three
 * different readings of the store.
 */

export interface FloorMapDetail {
  floor: Location;
  /** Null when the building does not resolve: unreadable, not "no building". */
  building: Location | null;
  facility: Facility | null;
  view: FloorMapView;
  /** Every room on the floor, with what stands in it, in code order. */
  rooms: { room: Location; assets: Asset[] }[];
  today: IsoDate;
}

export type FloorMapLookup =
  | { state: "unknown" }
  | { state: "missing" }
  | { state: "notAFloor"; location: Location }
  | { state: "found"; detail: FloorMapDetail };

export function useFloorMap(floorCode: string): FloorMapLookup {
  const { status, data } = useDemoData();
  const { repositories } = useRepositories();

  return useMemo<FloorMapLookup>(() => {
    if (!hasRecords(status) || !repositories || !data) {
      return { state: "unknown" };
    }

    const location = repositories.facilities.locationByCode(floorCode);
    if (!location) return { state: "missing" };
    if (location.kind !== "floor") return { state: "notAFloor", location };

    const rooms = data.locations
      .filter((one) => one.kind === "room" && one.parentId === location.id)
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((room) => ({ room, assets: equipmentIn(data, room.id) }));

    const today = toIsoDate(new Date());

    return {
      state: "found",
      detail: {
        floor: location,
        building: location.parentId
          ? (data.locations.find((one) => one.id === location.parentId) ?? null)
          : null,
        facility: repositories.facilities.byId(location.facilityId) ?? null,
        view: floorMapView(data, location.id, today),
        rooms,
        today,
      },
    };
  }, [status, data, repositories, floorCode]);
}

/**
 * The floors the map can draw, for a picker to choose between.
 *
 * Only floors with a drawing on file: a picker that offered every floor in the
 * estate would be offering forty answers of which one shows anything, and the
 * other thirty-nine would each need their own sentence explaining that nobody
 * has looked. Those sentences belong on a floor somebody navigated to, not in a
 * list somebody is choosing from.
 *
 * Empty is its own answer and the screen says so. `unknown` is the store still
 * being read, as everywhere else.
 */
export function useDrawnFloors(): {
  status: DemoStatus;
  floors: { code: string; name: LocalizedText; id: Id }[];
} {
  const { status, data } = useDemoData();

  const floors = useMemo(() => {
    if (!data) return [];
    return data.floorPlans
      .filter((plan) => plan.image !== null)
      .flatMap((plan) => {
        const floor = data.locations.find((one) => one.id === plan.floorId);
        return floor
          ? [{ code: floor.code, name: floor.name, id: floor.id }]
          : [];
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [data]);

  return { status, floors };
}
