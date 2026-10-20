// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed, SEED_VERSION } from "@/data/seed";
import { toIsoDate } from "@/data/seed/dates";
import { useDemoStore } from "@/stores/demo-store";
import { useFloorMap } from "./use-floor-map";

/**
 * Four answers to an address, and none of them is an empty floor.
 *
 * The selector is tested against a snapshot; this is the question above it —
 * what a code in the URL resolves to — and the states are where a floor map
 * goes wrong quietly. A code nobody holds and a code held by a room are
 * different answers, and a screen that gave the second one the first would tell
 * somebody standing at a door that the room they are looking at does not exist.
 *
 * Read through the real hook over the real store, because the states are about
 * the store's own progress: `unknown` is the moment before it has been read,
 * and a harness that plants records can never produce it.
 */

const DAY = new Date("2026-09-12T12:00:00.000Z");
const records = buildSeed(DAY);

/** The floor the drawing is of, taken from the records rather than written. */
const drawnFloorId = records.floorPlans.find(
  (plan) => plan.image !== null,
)!.floorId;
const drawnFloor = records.locations.find((one) => one.id === drawnFloorId)!;

function ready() {
  useDemoStore.setState({
    status: "ready",
    data: records,
    seededOn: toIsoDate(DAY),
    seedVersion: SEED_VERSION,
    hydrated: true,
    auditSequence: 0,
    outbox: [],
  });
}

beforeEach(ready);

describe("looking a floor up by its code", () => {
  it("answers unknown while the store is still being read", () => {
    useDemoStore.setState({ status: "unknown", data: null, hydrated: false });
    const { result } = renderHook(() => useFloorMap(drawnFloor.code));
    expect(result.current.state).toBe("unknown");
  });

  it("answers missing for a code nothing holds", () => {
    const { result } = renderHook(() => useFloorMap("ZZZ-B99-F9"));
    expect(result.current.state).toBe("missing");
  });

  it("answers notAFloor for a code that names a room", () => {
    /*
     * The near-miss this state exists for. A room code is a real place with a
     * number on its door, and calling it missing would send somebody looking
     * for a records problem that is not there.
     */
    const room = records.locations.find(
      (one) => one.kind === "room" && one.parentId === drawnFloorId,
    )!;
    const { result } = renderHook(() => useFloorMap(room.code));
    expect(result.current.state).toBe("notAFloor");
    if (result.current.state !== "notAFloor") return;
    expect(result.current.location.code).toBe(room.code);
    expect(result.current.location.kind).toBe("room");
  });

  it("gives the drawn floor its plan, its rooms and its markers", () => {
    const { result } = renderHook(() => useFloorMap(drawnFloor.code));
    expect(result.current.state).toBe("found");
    if (result.current.state !== "found") return;

    const { detail } = result.current;
    expect(detail.view.drawing.kind).toBe("drawn");
    expect(detail.view.placed.length).toBeGreaterThan(0);
    expect(detail.rooms.length).toBeGreaterThan(0);
    expect(detail.facility).not.toBeNull();
    expect(detail.building).not.toBeNull();

    // Every machine the rooms list also stands somewhere the map accounts for:
    // on the plan or, deliberately, in the list of the ones it cannot place.
    const inRooms = detail.rooms.flatMap((one) =>
      one.assets.map((asset) => asset.id),
    );
    const accountedFor = new Set([
      ...detail.view.placed.map((one) => one.placement.assetId),
      ...detail.view.unplaced.map((asset) => asset.id),
    ]);
    expect(inRooms.filter((id) => !accountedFor.has(id))).toEqual([]);
    expect(inRooms.length).toBeGreaterThan(0);
  });

  it("answers found with no drawing for a floor that has none", () => {
    const surveyed = records.floorPlans.find((plan) => plan.image === null)!;
    const floor = records.locations.find((one) => one.id === surveyed.floorId)!;
    const { result } = renderHook(() => useFloorMap(floor.code));
    expect(result.current.state).toBe("found");
    if (result.current.state !== "found") return;
    // A floor with no plan is still a floor, and the rooms on it are still
    // drawn: the screen that shows them is the reason this is not `missing`.
    expect(result.current.detail.view.drawing.kind).toBe("none");
    expect(result.current.detail.rooms.length).toBeGreaterThan(0);
  });
});
