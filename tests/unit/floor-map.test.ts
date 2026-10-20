import { describe, expect, it } from "vitest";
import { buildSeed } from "@/data/seed";

/**
 * The map and the estate agree.
 *
 * The positions on the Moncton drawing are written by hand against the image,
 * keyed by asset tag, while the estate on that floor is whatever the seed's
 * shuffle puts there. Those two can drift apart in both directions, and the
 * seed cannot say so itself: a tag it does not hold is skipped rather than
 * thrown, because `buildSeed` takes a generator seed and must build under any
 * of them. So the drift is named here, against the seed the demonstration
 * actually builds.
 *
 * **Both directions, because they are different defects.** A position for an
 * asset that is gone draws a box over the plan labelled with nothing. An asset
 * on the floor with no position is a machine the map does not show, which is
 * worse: a reader who trusts the map concludes the floor is emptier than it is,
 * and nothing on the screen says otherwise.
 */

const TODAY = new Date("2026-09-12T00:00:00.000Z");
const seed = buildSeed(TODAY);

/** The floor the drawing is of, read from the plan rather than written here. */
const drawn = seed.floorPlans.find((plan) => plan.image !== null);

describe("the floor map", () => {
  it("has a drawing, a floor with none, and a size on the drawing", () => {
    /*
     * The floor under everything below. Without it a seed that built no plans
     * at all would satisfy every comparison that follows: two empty lists
     * agree perfectly.
     */
    expect(drawn, "no floor plan carries a drawing").toBeDefined();
    expect(drawn!.image!.path).toMatch(/^\/floorplans\/.+\.(jpg|png|svg)$/);
    expect(drawn!.image!.widthPx).toBeGreaterThan(0);
    expect(drawn!.image!.heightPx).toBeGreaterThan(0);

    // The third state, seeded on purpose: a floor that was surveyed and has no
    // plan on file. A row with no image is not the same answer as no row.
    const surveyed = seed.floorPlans.filter((plan) => plan.image === null);
    expect(surveyed.length).toBeGreaterThanOrEqual(1);

    // Every plan names a floor that exists, and names it once.
    const floors = new Set(
      seed.locations.filter((one) => one.kind === "floor").map((one) => one.id),
    );
    for (const plan of seed.floorPlans) {
      expect(floors.has(plan.floorId), plan.id).toBe(true);
    }
    expect(new Set(seed.floorPlans.map((plan) => plan.floorId)).size).toBe(
      seed.floorPlans.length,
    );
  });

  it("places every asset that stands on the drawn floor, and only those", () => {
    const roomsOnFloor = new Set(
      seed.locations
        .filter((one) => one.kind === "room" && one.parentId === drawn!.floorId)
        .map((one) => one.id),
    );
    expect(roomsOnFloor.size).toBeGreaterThan(0);

    const here = seed.assets.filter(
      (asset) =>
        asset.locationId !== null && roomsOnFloor.has(asset.locationId),
    );
    const placed = seed.assetPlacements.filter(
      (placement) => placement.floorId === drawn!.floorId,
    );
    expect(placed.length).toBeGreaterThan(0);

    const byId = new Map(seed.assets.map((asset) => [asset.id, asset]));
    const placedTags = placed.map(
      (placement) => byId.get(placement.assetId)?.assetTag ?? placement.assetId,
    );

    expect(
      here
        .map((asset) => asset.assetTag)
        .filter((tag) => !placedTags.includes(tag)),
      "on the drawn floor and nowhere on the map",
    ).toEqual([]);
    expect(
      placedTags.filter((tag) => !here.some((asset) => asset.assetTag === tag)),
      "placed on the map and not on that floor",
    ).toEqual([]);
  });

  it("marks every machine on the floor, counted from the records", () => {
    /*
     * The owner's finding, as arithmetic: "why are only two of the machines
     * marked?" The count comes from the **records** — the assets whose room is
     * on this floor — and not from the position table, because a table counted
     * against itself agrees however few entries it holds. That is the shape
     * the defect had: two positions, two markers, and ten machines at the site
     * the map never mentioned.
     */
    const roomsOnFloor = new Set(
      seed.locations
        .filter((one) => one.kind === "room" && one.parentId === drawn!.floorId)
        .map((one) => one.id),
    );
    const onTheFloor = seed.assets.filter(
      (asset) =>
        asset.locationId !== null && roomsOnFloor.has(asset.locationId),
    );
    const markers = seed.assetPlacements.filter(
      (placement) => placement.floorId === drawn!.floorId,
    );

    // A floor that is worth drawing at all. Two was the defect; the estate
    // should put a working floor's worth of machines on it.
    expect(onTheFloor.length).toBeGreaterThanOrEqual(6);

    const byId = new Map(seed.assets.map((asset) => [asset.id, asset]));
    const marked = new Set(
      markers.map((placement) => byId.get(placement.assetId)?.assetTag),
    );
    expect(
      onTheFloor
        .map((asset) => asset.assetTag)
        .filter((tag) => !marked.has(tag)),
      "on the drawn floor and not marked",
    ).toEqual([]);
    expect(markers.length).toBe(onTheFloor.length);
  });

  it("keeps every placement inside the plan", () => {
    /*
     * Fractions, so the arithmetic is the whole check: a box that runs off the
     * drawing is a box drawn half outside the image, and at some widths not
     * drawn at all. Zero width is its own case — a marker with no size is
     * invisible and reads as an asset that was never placed.
     */
    expect(seed.assetPlacements.length).toBeGreaterThan(0);
    const outside: string[] = [];
    for (const placement of seed.assetPlacements) {
      const fits =
        placement.x >= 0 &&
        placement.y >= 0 &&
        placement.width > 0 &&
        placement.height > 0 &&
        placement.x + placement.width <= 1 &&
        placement.y + placement.height <= 1;
      if (!fits) {
        outside.push(
          `${placement.id}: ${placement.x},${placement.y} ${placement.width}x${placement.height}`,
        );
      }
    }
    expect(outside).toEqual([]);
  });

  it("puts no placement on a floor with no drawing", () => {
    // A fraction of a plan that does not exist is not a position. The seed's
    // own rule, asserted rather than assumed.
    const drawnFloors = new Set(
      seed.floorPlans
        .filter((plan) => plan.image !== null)
        .map((plan) => plan.floorId),
    );
    const stranded = seed.assetPlacements.filter(
      (placement) => !drawnFloors.has(placement.floorId),
    );
    expect(stranded.map((placement) => placement.id)).toEqual([]);
  });
});
