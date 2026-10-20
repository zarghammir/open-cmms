import { describe, expect, it } from "vitest";
import { buildSeed } from "./index";
import {
  CIRCULATION,
  DOORS,
  FIXTURES,
  FOOTPRINTS,
  PLAN,
  ROOMS,
  SYMBOL_M,
  toFraction,
  type RectM,
} from "./floor-geometry";

/**
 * What a footprint has to be true of, now that it is the thing people click.
 *
 * A fraction of a drawing could only ever be checked against itself. Metres can
 * be checked against the room the record names, against the machine beside it
 * and against the services already drawn there — so the questions below are
 * ones the old table could not be asked.
 */

function overlaps(a: RectM, b: RectM): boolean {
  return (
    a.xM < b.xM + b.widthM &&
    b.xM < a.xM + a.widthM &&
    a.yM < b.yM + b.depthM &&
    b.yM < a.yM + a.depthM
  );
}

/**
 * A centimetre is the unit here; this is a floating-point tolerance, not a
 * tolerance in the drawing. `ALI-MCT-11` sits flush against 187's south wall,
 * and `6.4 + 1.2` is `7.6000000000000005` while the wall is at `7.6`, so an
 * exact comparison called a device mounted on the wall "outside the room". A
 * wall-mounted thing being flush with its wall is correct, so the comparison
 * gives way rather than the geometry.
 */
const EPSILON = 1e-9;

function contains(outer: RectM, inner: RectM): boolean {
  return (
    inner.xM >= outer.xM - EPSILON &&
    inner.yM >= outer.yM - EPSILON &&
    inner.xM + inner.widthM <= outer.xM + outer.widthM + EPSILON &&
    inner.yM + inner.depthM <= outer.yM + outer.depthM + EPSILON
  );
}

describe("the footprints on the drawn floor", () => {
  it("each stand inside the room their record names", () => {
    for (const one of FOOTPRINTS) {
      const room = ROOMS[one.room];
      expect(
        room,
        `${one.tag} names ${one.room}, which is not on this floor`,
      ).toBeDefined();
      expect(
        contains(room!, one),
        `${one.tag} is drawn outside ${one.room}: a reader would click it in the wrong room`,
      ).toBe(true);
    }
  });

  it("do not sit on top of one another", () => {
    // Two footprints overlapping is a machine nobody can click: the one drawn
    // second takes the pointer for both. On the old table this was invisible
    // because the shapes were markers rather than the objects themselves.
    for (const a of FOOTPRINTS) {
      for (const b of FOOTPRINTS) {
        if (a.tag >= b.tag) continue;
        expect(overlaps(a, b), `${a.tag} and ${b.tag} overlap`).toBe(false);
      }
    }
  });

  it("do not sit on top of a drawn service", () => {
    // A bench under a footprint reads as a dead target: the drawing shows
    // something there and the click opens a machine standing somewhere else.
    for (const one of FOOTPRINTS) {
      for (const fixture of FIXTURES) {
        expect(
          overlaps(one, fixture),
          `${one.tag} stands on the ${fixture.kind}`,
        ).toBe(false);
      }
    }
  });

  it("are a scale footprint or a declared symbol, and never a speck", () => {
    /*
     * The two size classes, asserted rather than described. A wall device is
     * smaller than any legible shape, so a plan draws it as a symbol — but a
     * footprint that has quietly shrunk below symbol size is the defect this
     * ticket exists to end, and both look the same in a fraction table.
     */
    for (const one of FOOTPRINTS) {
      if (one.symbol) {
        expect(one.widthM, `${one.tag} is a symbol`).toBe(SYMBOL_M);
        expect(one.depthM, `${one.tag} is a symbol`).toBe(SYMBOL_M);
        continue;
      }

      /*
       * Strictly larger, and the `>=` this replaces is why. A shape exactly
       * `SYMBOL_M` square is indistinguishable from a symbol on the screen, so
       * if it is not declared as one the declaration is doing no work — and the
       * control proved it: removing `symbol: true` from `ALI-MCT-11` left the
       * whole suite green, because 0.8 passes a floor of 0.8. A footprint that
       * has shrunk to symbol size has become a symbol and must say so.
       */
      /*
       * **Not the symbol's exact square, which is a different rule from the one
       * this replaced.** While the symbol was the smallest thing on the plan,
       * "a footprint must be larger than a symbol" was the same statement as "a
       * footprint must not look like one". Raising `SYMBOL_M` to 1.2 for
       * legibility broke that equivalence: a vacuum pump really is 1.2 by 1.0
       * and is a true footprint, so requiring every footprint to exceed the
       * symbol would force three real machines to be declared conventions.
       *
       * What has to hold is the thing the declaration is for — a shape drawn at
       * exactly the symbol's square is indistinguishable from a symbol, so it
       * must say it is one. The control is unchanged: `ALI-MCT-11` is exactly
       * 1.2 by 1.2, so removing its flag still reds here.
       */
      expect(
        one.widthM === SYMBOL_M && one.depthM === SYMBOL_M,
        `${one.tag} is drawn at exactly the device symbol's size but is not declared as one`,
      ).toBe(false);
    }
  });

  it("reach the records as the same rectangle, in fractions", () => {
    // The join between the two units. A drawing in metres and a store in
    // fractions is one conversion away from a floor whose shapes are all
    // slightly wrong, and nothing on the screen would look broken.
    const seed = buildSeed(new Date("2026-09-12T12:00:00.000Z"));
    const byTag = new Map(
      seed.assets.map((asset) => [asset.id, asset.assetTag]),
    );

    expect(seed.assetPlacements).toHaveLength(FOOTPRINTS.length);

    for (const one of FOOTPRINTS) {
      const stored = seed.assetPlacements.find(
        (placement) => byTag.get(placement.assetId) === one.tag,
      );
      expect(stored, `${one.tag} reached no placement`).toBeDefined();

      const expected = toFraction(one);
      expect(stored!.x).toBeCloseTo(expected.x, 10);
      expect(stored!.y).toBeCloseTo(expected.y, 10);
      expect(stored!.width).toBeCloseTo(expected.width, 10);
      expect(stored!.height).toBeCloseTo(expected.height, 10);

      // And back out again: the stored fraction times the plan is the metres
      // this file declares, which is the claim "true scale" makes.
      expect(stored!.width * PLAN.widthM).toBeCloseTo(one.widthM, 10);
      expect(stored!.height * PLAN.heightM).toBeCloseTo(one.depthM, 10);
    }
  });

  it("stand in the rooms the estate says they are in", () => {
    /*
     * The floor under the first test. That one checks a footprint against the
     * room written beside it in this file; this one checks that room against
     * the asset's own location record. Without it both could name the same
     * wrong room and agree with each other.
     */
    const seed = buildSeed(new Date("2026-09-12T12:00:00.000Z"));
    const rooms = new Map(seed.locations.map((one) => [one.id, one.code]));

    for (const one of FOOTPRINTS) {
      const asset = seed.assets.find((each) => each.assetTag === one.tag);
      expect(asset, `${one.tag} is not in the estate`).toBeDefined();
      expect(
        rooms.get(asset!.locationId),
        `${one.tag} is drawn in ${one.room} and its record says otherwise`,
      ).toBe(one.room);
    }
  });

  it("only name rooms this floor actually has", () => {
    // Two, because a room's floor is the first digit of its number. The drawing
    // this replaces showed eight while the panel beside it listed two.
    const seed = buildSeed(new Date("2026-09-12T12:00:00.000Z"));
    const onThisFloor = seed.locations
      .filter((one) => one.parentId === "loc-MCT-B01-F1")
      .map((one) => one.code)
      .sort();

    expect(onThisFloor).toEqual(Object.keys(ROOMS).sort());
  });
});

describe("the services drawn on the floor", () => {
  const spaces = [
    ...Object.values(ROOMS),
    CIRCULATION.airlock,
    CIRCULATION.corridor,
  ];

  it("each stand in a room, the airlock or the corridor", () => {
    // A fixture drawn through a wall is the giveaway that the drawing and the
    // geometry have parted company, and it is invisible in a list of numbers.
    for (const one of FIXTURES) {
      expect(
        spaces.some((space) => contains(space, one)),
        `the ${one.kind} at ${one.xM},${one.yM} is not inside any space on this floor`,
      ).toBe(true);
    }
  });

  it("do not sit on top of one another", () => {
    for (const [index, a] of FIXTURES.entries()) {
      for (const b of FIXTURES.slice(index + 1)) {
        expect(
          overlaps(a, b),
          `the ${a.kind} at ${a.xM},${a.yM} overlaps the ${b.kind} at ${b.xM},${b.yM}`,
        ).toBe(false);
      }
    }
  });

  it("are each their own size rather than one icon stamped out", () => {
    /*
     * The owner's point about the reference drawing, as a check. A repeated
     * icon says "something is here"; a footprint says what and how much room it
     * takes. A drawing that has drifted back to one stamped shape passes every
     * other assertion in this file — the sizes are still inside the rooms, they
     * still do not overlap, and the count is still right.
     */
    const sizes = new Set(FIXTURES.map((one) => `${one.widthM}x${one.depthM}`));
    expect(
      sizes.size,
      "the services are drawn from too few distinct footprints to be drawn at all",
    ).toBeGreaterThanOrEqual(FIXTURES.length - 1);

    // And they are not all one kind, which is the other way to stamp an icon.
    expect(
      new Set(FIXTURES.map((one) => one.kind)).size,
    ).toBeGreaterThanOrEqual(5);
  });
});

/**
 * Nothing stands in a door's swing.
 *
 * **The defect this exists for was in my own drawing, twice.** The door into
 * 127 opened straight into the bench run along the same wall, and the gowning
 * bench sat in the airlock door's quarter-turn. Both drew perfectly: the arc
 * is a path and the bench is a rectangle, and nothing in a file of coordinates
 * says they cannot occupy the same floor. A person reading the plan sees it at
 * once, which is the whole reason the swing is drawn — so it is worth asserting
 * rather than leaving to whoever looks next.
 *
 * The swept area is sampled rather than solved: the leaf at each degree of its
 * turn, along its whole length. A closed form would be neater and this is the
 * version whose failure I can read.
 */
describe("the doors", () => {
  const obstacles = [
    ...FIXTURES.map((one) => ({ what: one.kind, ...one })),
    ...FOOTPRINTS.map((one) => ({ what: one.tag, ...one })),
  ];

  /** Every point the leaf passes through, at each degree along its length. */
  function swept(one: (typeof DOORS)[number]) {
    const step = one.toDeg > one.fromDeg ? 1 : -1;
    const turn = Math.abs(one.toDeg - one.fromDeg) > 180 ? -step : step;
    const points: { xM: number; yM: number }[] = [];

    for (let angle = 0; angle <= 90; angle += 1) {
      const rad = ((one.fromDeg + turn * angle) * Math.PI) / 180;
      for (let along = 0.1; along <= one.widthM; along += 0.1) {
        points.push({
          xM: one.xM + along * Math.cos(rad),
          yM: one.yM + along * Math.sin(rad),
        });
      }
    }
    return points;
  }

  it("all swing clear of the corridor, including the way out", () => {
    /*
     * **The defect this exists for hit nothing, which is why the sweep above
     * could not see it.** The exit door opened east into the corridor — across
     * the path of somebody leaving — while the other three opened into the
     * space they serve and left the corridor clear. No collision, so the
     * obstacle check passed and was right to pass; what was wrong was that the
     * drawing set a convention on three doors and broke it on the fourth, on
     * the one door where the direction of travel is the whole point.
     *
     * Counting points in the corridor is what tells those two questions apart:
     * "does this leaf hit something" and "does this leaf open into the route
     * people leave by" are different, and only the first was being asked.
     *
     * Consistency is the claim. Whether an outward swing is *required* depends
     * on occupant load and is a building official's judgement, not this
     * repository's.
     */
    const corridor = CIRCULATION.corridor;

    for (const one of DOORS) {
      const inside = swept(one).filter(
        (at) =>
          at.xM > corridor.xM &&
          at.xM < corridor.xM + corridor.widthM &&
          at.yM > corridor.yM &&
          at.yM < corridor.yM + corridor.depthM,
      );

      expect(
        inside.length,
        `the door at ${one.xM},${one.yM} sweeps ${inside.length} points into the corridor`,
      ).toBe(0);
    }
  });

  it("each sweep a floor with nothing standing on it", () => {
    for (const one of DOORS) {
      const step = one.toDeg > one.fromDeg ? 1 : -1;
      const turn = Math.abs(one.toDeg - one.fromDeg) > 180 ? -step : step;

      for (let angle = 0; angle <= 90; angle += 1) {
        const deg = one.fromDeg + turn * angle;
        const rad = (deg * Math.PI) / 180;

        for (let along = 0.1; along <= one.widthM; along += 0.1) {
          const x = one.xM + along * Math.cos(rad);
          const y = one.yM + along * Math.sin(rad);

          const hit = obstacles.find(
            (obstacle) =>
              x > obstacle.xM &&
              x < obstacle.xM + obstacle.widthM &&
              y > obstacle.yM &&
              y < obstacle.yM + obstacle.depthM,
          );

          expect(
            hit?.what,
            `the door at ${one.xM},${one.yM} sweeps into the ${hit?.what} at ${deg}°`,
          ).toBeUndefined();
        }
      }
    }
  });
});
