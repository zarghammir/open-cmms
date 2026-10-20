import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { drawFloorPlanSvg } from "./floor-drawing";
import { DOORS, FIXTURES, PLAN } from "./floor-geometry";

const ASSET = join(process.cwd(), "public/floorplans/mct-b01-f1.svg");

/**
 * The committed drawing is the geometry's output, and this is what says so.
 *
 * **The drift this exists for.** The plan this replaces was a rendered picture,
 * and nothing tied it to the records: it showed eight rooms while the floor had
 * two, for as long as nobody looked. A drawing generated from the same file the
 * placements come from cannot do that — but only while the committed file and
 * the generator agree, and a static asset is exactly the thing somebody edits
 * by hand at four in the afternoon.
 *
 * So the asset is regenerated behind a flag, like the screenshots, and asserted
 * without one. A hand edit reddens here rather than surviving to production.
 */
describe("the committed floor plan", () => {
  const drawn = drawFloorPlanSvg();

  if (process.env.WA_DRAW_FLOOR) {
    it("is written out from the geometry", () => {
      writeFileSync(ASSET, drawn, "utf8");
      expect(readFileSync(ASSET, "utf8")).toBe(drawn);
    });
    return;
  }

  it("is exactly what the geometry draws", () => {
    expect(
      readFileSync(ASSET, "utf8"),
      "the drawing and the geometry disagree — regenerate with WA_DRAW_FLOOR=1",
    ).toBe(drawn);
  });

  it("is a drawing rather than a picture", () => {
    /*
     * The ticket's first acceptance step, asserted on the file rather than
     * taken on trust from a screenshot. Line work has no raster in it and no
     * shading: a plan that had quietly become an embedded photograph again
     * would still satisfy every other test in this file.
     */
    expect(drawn).not.toMatch(/<image\b/);
    expect(drawn).not.toMatch(/data:image/);
    expect(drawn).not.toMatch(/<filter\b|feGaussianBlur|Gradient/);
  });

  it("draws every door with its swing, and never the long way round", () => {
    // An arc drawn with the wrong sweep flag takes 270 degrees to get where 90
    // would do. It is still a valid path and still renders, which is why this
    // counts arcs rather than looking at them.
    const arcs = drawn.match(/ A \d/g) ?? [];
    expect(arcs).toHaveLength(DOORS.length);

    for (const one of DOORS) {
      const delta = (one.toDeg - one.fromDeg + 360) % 360;
      expect(
        delta === 90 || delta === 270,
        `${one.xM},${one.yM} sweeps ${delta}°, which is not a quarter turn`,
      ).toBe(true);
    }
  });

  it("keeps its own extent", () => {
    // The container holds the drawing's aspect ratio, so a change here silently
    // reshapes every screen the map appears on.
    expect(drawn).toContain(`viewBox="0 0 ${PLAN.widthPx} ${PLAN.heightPx}"`);
    // 1425 rather than 1350: the canvas carries a metre of outside on the west
    // so the exit leaf can be drawn swinging out of the building. The building
    // itself is unchanged — see `ORIGIN_XM`.
    expect(PLAN.widthPx).toBe(1425);
    expect(PLAN.heightPx).toBe(750);
  });

  it("draws the services, so the rooms read as rooms", () => {
    // The floor: without a fixture the drawing is four walls, and every
    // assertion above still passes.
    expect(FIXTURES.length).toBeGreaterThan(2);
    expect(drawn).toMatch(/stroke-dasharray/);
  });
});
