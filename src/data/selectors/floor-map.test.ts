import { describe, expect, it } from "vitest";
import { exceptionRows } from "@/data/selectors/dashboard";
import { partsFittedTo } from "@/data/selectors/asset-history";
import {
  floorMapView,
  planLabels,
  type PlacedAsset,
} from "@/data/selectors/floor-map";
import { inventoryReport } from "@/data/selectors/reports";
import { dashboardKpis } from "@/data/selectors/kpi";
import { buildSeed } from "@/data/seed";
import { isOpenStatus } from "@/domain/constants/work-order-status";

/**
 * The map and the dashboard make the same claim about the same work.
 *
 * The outline on a machine is not decoration: it says the work on that machine
 * is late. The tile at the top of the dashboard says how many orders are late.
 * If the two were computed from separate rules they would drift the first time
 * one of them was edited, and the screen would carry two numbers with no way to
 * tell which one to believe.
 *
 * So the agreement is asserted through a **different function**: `exceptionRows`
 * is the dashboard's own row builder, unlimited here, and every machine the map
 * outlines as late has to appear in it — and every one it does not outline has
 * to be absent. A map that wrote its own definition of late would pass no part
 * of this.
 */

const TODAY_DATE = new Date("2026-09-12T00:00:00.000Z");
const TODAY = "2026-09-12";
const seed = buildSeed(TODAY_DATE);

/** The floor the drawing is of, read from the seed rather than written here. */
const drawnFloorId = seed.floorPlans.find(
  (plan) => plan.image !== null,
)!.floorId;

describe("the floor map view", () => {
  it("draws a floor that has markers on it", () => {
    /*
     * The floor under every comparison below. A view with nothing placed agrees
     * with any dashboard at all: two empty lists match perfectly, and a rule
     * that was never applied cannot disagree with one that was.
     */
    const view = floorMapView(seed, drawnFloorId, TODAY);
    expect(view.drawing.kind).toBe("drawn");
    expect(view.placed.length).toBeGreaterThan(0);
    expect(view.placed.every((one) => one.asset !== null)).toBe(true);
    expect(view.unplaced).toEqual([]);

    /*
     * And the floor is worth drawing: one machine with work that is late, one
     * with none. A plan where every outline says the same thing demonstrates
     * nothing about what the outline is for, and it would let the agreement
     * below pass by agreeing about nothing — the seed picks this floor for
     * exactly that reason, so the reason is asserted here rather than left in
     * a comment.
     */
    const states = view.placed.map((one) => one.state);
    expect(states).toContain("overdue");
    expect(states).toContain("clear");
  });

  it("outlines exactly the machines the dashboard calls late", () => {
    const view = floorMapView(seed, drawnFloorId, TODAY);

    // The dashboard's own rows, unlimited so the comparison is not against the
    // six that fit on a panel. A row is late when `daysLate` is a number; the
    // rest are critical work that is not late, which the map draws as open.
    const late = exceptionRows(
      seed,
      TODAY,
      undefined,
      Number.MAX_SAFE_INTEGER,
    ).filter((row) => row.daysLate !== null);

    const disagreement: string[] = [];
    for (const one of view.placed) {
      const lateHere = late.filter((row) => row.assetId === one.asset!.id);
      const mapSaysLate = one.state === "overdue";
      if (mapSaysLate !== lateHere.length > 0) {
        disagreement.push(
          `${one.asset!.assetTag}: map ${one.state}, dashboard ${lateHere.length} late`,
        );
      }
      if (one.overdueCount !== lateHere.length) {
        disagreement.push(
          `${one.asset!.assetTag}: map counts ${one.overdueCount}, dashboard ${lateHere.length}`,
        );
      }
    }
    expect(disagreement).toEqual([]);

    // The instrument itself: the dashboard's rows and its tile agree, so a
    // comparison against those rows is a comparison against the number the
    // reader sees. Without this the test above could be measuring a row
    // builder nobody's screen uses.
    const site = seed.assets.find(
      (one) => one.id === view.placed[0]!.asset!.id,
    )!.facilityId;
    expect(
      exceptionRows(seed, TODAY, site, Number.MAX_SAFE_INTEGER).filter(
        (row) => row.daysLate !== null,
      ).length,
    ).toBe(dashboardKpis(seed, TODAY, site).overdue);
  });

  it("counts the open work behind each outline", () => {
    const view = floorMapView(seed, drawnFloorId, TODAY);
    for (const one of view.placed) {
      expect(one.openCount, one.asset!.assetTag).not.toBeNull();
      // `clear` is a claim that nothing is open, and `open` a claim that
      // something is. Neither may be drawn from a count that says otherwise.
      if (one.state === "clear") expect(one.openCount).toBe(0);
      if (one.state === "open") expect(one.openCount).toBeGreaterThan(0);
      if (one.state === "overdue") expect(one.overdueCount).toBeGreaterThan(0);
    }
  });

  it("answers unrecorded, none and drawn for three different floors", () => {
    /*
     * Three states, and the seed holds all three: the Moncton drawing, the
     * floor beside it that was surveyed with no plan on file, and every other
     * floor in the estate, which nobody has looked at.
     */
    const surveyed = seed.floorPlans.find((plan) => plan.image === null)!;
    expect(floorMapView(seed, surveyed.floorId, TODAY).drawing.kind).toBe(
      "none",
    );

    const knownFloorIds = new Set(seed.floorPlans.map((plan) => plan.floorId));
    const untouched = seed.locations.find(
      (one) => one.kind === "floor" && !knownFloorIds.has(one.id),
    )!;
    expect(untouched).toBeDefined();
    expect(floorMapView(seed, untouched.id, TODAY).drawing.kind).toBe(
      "unrecorded",
    );
  });

  it("reads a marker whose machine is gone as unreadable, never as clear", () => {
    /*
     * The failed lookup, which is the state the whole type exists for. A
     * placement naming an asset the records no longer hold is a marker nobody
     * can read; drawing it as a machine with nothing wrong turns "we cannot
     * tell you" into "nothing is wrong here".
     */
    const placement = seed.assetPlacements.find(
      (one) => one.floorId === drawnFloorId,
    )!;
    const withoutIt = {
      ...seed,
      assets: seed.assets.filter((asset) => asset.id !== placement.assetId),
    };

    const one = floorMapView(withoutIt, drawnFloorId, TODAY).placed.find(
      (candidate) => candidate.placement.id === placement.id,
    )!;
    expect(one.state).toBe("unreadable");
    expect(one.asset).toBeNull();
    expect(one.openCount).toBeNull();
    expect(one.overdueCount).toBeNull();
  });

  it("names equipment on the floor that no marker places", () => {
    /*
     * The positive beside the negative: the first test asserts `unplaced` is
     * empty on the seed as it stands, which a function that always returned an
     * empty list would also satisfy. Take one marker away and the machine it
     * placed has to appear by name.
     */
    const placement = seed.assetPlacements.find(
      (one) => one.floorId === drawnFloorId,
    )!;
    const asset = seed.assets.find((one) => one.id === placement.assetId)!;
    const withoutMarker = {
      ...seed,
      assetPlacements: seed.assetPlacements.filter(
        (one) => one.id !== placement.id,
      ),
    };

    const view = floorMapView(withoutMarker, drawnFloorId, TODAY);
    expect(view.unplaced.map((one) => one.assetTag)).toEqual([asset.assetTag]);
  });
});

describe("every state the map can draw, drawn somewhere on this floor", () => {
  it("shows all four, so none of them is unphotographable", () => {
    /*
     * **A demo must show the rule.** An outline state the seeded floor can
     * never produce is a rule the product claims and the demonstration cannot
     * demonstrate — and it fails silently, because every test about the state
     * passes on a snapshot nobody sees. QA found exactly that on the merged
     * map: the only machine with a low spare also had overdue work, and
     * overdue outranks it, so `lowStock` existed in the code and nowhere on
     * the screen.
     *
     * It costs nothing to keep: the floor as WA-114 populates it happens to
     * hold one machine of each kind. What this stops is a later change to the
     * estate quietly taking one away again, which is how it was lost the first
     * time.
     */
    const view = floorMapView(seed, drawnFloorId, TODAY);
    const states = new Set(view.placed.map((one) => one.state));

    const missing = (["overdue", "open", "lowStock", "clear"] as const).filter(
      (state) => !states.has(state),
    );
    expect(
      missing,
      "a state the floor cannot show is a rule the recording cannot photograph",
    ).toEqual([]);

    // The floor under it: a view with nothing placed would report no missing
    // states only because it reported no states at all.
    expect(view.placed.length).toBeGreaterThanOrEqual(6);
  });

  it("has one machine whose only trouble is its spares, for the shot that needs it", () => {
    // Named separately because the recording plan asks for this picture, and a
    // set-membership assertion above would still pass if the machine carrying
    // it changed to one with work as well.
    const view = floorMapView(seed, drawnFloorId, TODAY);
    const only = view.placed.filter((one) => one.state === "lowStock");

    expect(only.map((one) => one.asset!.assetTag)).not.toEqual([]);
    for (const one of only) {
      expect(one.openCount, one.asset!.assetTag).toBe(0);
      expect(one.overdueCount, one.asset!.assetTag).toBe(0);
      expect(one.lowParts, one.asset!.assetTag).toBeGreaterThan(0);
    }
  });
});

describe("the fourth state: a spare running low", () => {
  it("counts the same low spares the inventory report does", () => {
    /*
     * The agreement again, through a different function. `inventoryReport` is
     * what the reports module prints, and it decides "low" with the same
     * `isBelowMinimum` the map asks. A map that compared `quantityOnHand` to
     * something of its own would disagree with a printed report by exactly the
     * parts sitting on the boundary, and nobody reading either would know.
     */
    const view = floorMapView(seed, drawnFloorId, TODAY);
    const report = inventoryReport(seed, TODAY);
    const lowNumbers = new Set(
      report.rows
        .filter((row) => row.state === "low")
        .map((row) => String(row.stockNumber)),
    );

    // The floor: the report found some, or this compares two empty sets.
    expect(lowNumbers.size).toBeGreaterThan(0);

    const disagreement: string[] = [];
    for (const one of view.placed) {
      const fitted = partsFittedTo(seed, one.asset!.id);
      const lowHere = fitted.filter((part) =>
        lowNumbers.has(part.partNumber),
      ).length;
      if (one.lowParts !== lowHere) {
        disagreement.push(
          `${one.asset!.assetTag}: map ${one.lowParts}, report ${lowHere}`,
        );
      }
    }
    expect(disagreement).toEqual([]);
  });

  it("ranks late work above a low spare, and still says the spare is low", () => {
    /*
     * The case the seeded floor actually holds: a machine with an overdue
     * order AND a spare below its minimum. One outline has to choose, and it
     * chooses the work — but the count stays, because a ranking that decided
     * the colour and then dropped the fact would be a map that quietly knows
     * something it does not say.
     */
    const view = floorMapView(seed, drawnFloorId, TODAY);
    const both = view.placed.filter(
      (one) => (one.overdueCount ?? 0) > 0 && (one.lowParts ?? 0) > 0,
    );
    expect(
      both.map((one) => one.asset!.assetTag),
      "no machine on the drawn floor has both late work and a low spare, so the ranking is untested here",
    ).not.toEqual([]);

    for (const one of both) {
      expect(one.state, one.asset!.assetTag).toBe("overdue");
      expect(one.lowParts).toBeGreaterThan(0);
    }
  });

  it("outlines a machine whose only trouble is its spares", () => {
    /*
     * Not on this floor today — both machines here have work — so the snapshot
     * is narrowed rather than invented: the same records with this machine's
     * work finished.
     *
     * **Finished, not deleted, and the first attempt got that wrong.** A part
     * is "fitted to" a machine through the movements issued against its own
     * work orders, so removing the orders removes the parts with them and the
     * machine came back with nothing low at all. The plant has to leave the
     * relation standing and change only what the state is read from, which is
     * a fair description of the difference between a snapshot and a fiction.
     */
    const view = floorMapView(seed, drawnFloorId, TODAY);
    const withLowSpare = view.placed.find((one) => (one.lowParts ?? 0) > 0)!;
    expect(withLowSpare, "no placed machine has a low spare").toBeDefined();

    const finished = {
      ...seed,
      workOrders: seed.workOrders.map((order) =>
        order.assetId === withLowSpare.asset!.id
          ? {
              ...order,
              status: "completed" as const,
              completedAt: `${TODAY}T12:00:00.000Z`,
            }
          : order,
      ),
    };

    const after = floorMapView(finished, drawnFloorId, TODAY).placed.find(
      (one) => one.placement.id === withLowSpare.placement.id,
    )!;
    expect(after.openCount).toBe(0);
    expect(after.overdueCount).toBe(0);
    expect(
      after.lowParts,
      "the plant took the parts away with the work, so this proves nothing",
    ).toBeGreaterThan(0);
    expect(after.state).toBe("lowStock");
  });

  it("is clear only when all three are nought", () => {
    // The floor under the ranking: `clear` is a claim about work and spares
    // together, and a machine with a low spare must never be drawn as clear.
    const view = floorMapView(seed, drawnFloorId, TODAY);
    for (const one of view.placed) {
      if (one.state !== "clear") continue;
      expect(one.openCount, one.asset!.assetTag).toBe(0);
      expect(one.overdueCount, one.asset!.assetTag).toBe(0);
      expect(one.lowParts, one.asset!.assetTag).toBe(0);
    }
  });

  it("gives the panel the open orders themselves, not only a count", () => {
    const view = floorMapView(seed, drawnFloorId, TODAY);
    const busy = view.placed.find((one) => (one.openCount ?? 0) > 0)!;
    expect(busy, "no machine on the drawn floor has open work").toBeDefined();

    expect(busy.openOrders).not.toBeNull();
    expect(busy.openOrders!.length).toBe(busy.openCount);
    // Every one of them is open, and belongs to this machine: a list built
    // from the wrong filter would still have the right length.
    for (const order of busy.openOrders!) {
      expect(order.assetId).toBe(busy.asset!.id);
      expect(isOpenStatus(order.status), order.number).toBe(true);
    }
  });
});

describe("what a footprint prints on the plan", () => {
  const placed = (tags: (string | null)[]) =>
    tags.map(
      (assetTag, index) =>
        ({
          placement: { id: `p${index}` },
          asset: assetTag === null ? null : { assetTag },
        }) as unknown as PlacedAsset,
    );

  it("prints the short code when the short codes tell the machines apart", () => {
    const labels = planLabels(
      placed(["AHU-MCT-11", "AUT-MCT-11", "VAC-MCT-11"]),
    );
    expect(labels.get("AHU-MCT-11")).toBe("AHU");
    expect(labels.get("VAC-MCT-11")).toBe("VAC");
  });

  it("prints every whole tag as soon as two would collide", () => {
    /*
     * All or nothing. A floor with two air handlers has no short code that
     * names either, and a plan where some labels are short and others are long
     * reads as a mistake rather than as a rule.
     */
    const labels = planLabels(
      placed(["AHU-MCT-11", "AHU-MCT-12", "VAC-MCT-11"]),
    );
    expect(labels.get("AHU-MCT-11")).toBe("AHU-MCT-11");
    expect(labels.get("AHU-MCT-12")).toBe("AHU-MCT-12");
    // Including the one that would have been unambiguous on its own.
    expect(labels.get("VAC-MCT-11")).toBe("VAC-MCT-11");
  });

  it("ignores a footprint whose asset cannot be read", () => {
    // An unreadable placement has no tag to shorten, and it must not make the
    // whole floor fall back by colliding with another absence.
    const labels = planLabels(placed(["AHU-MCT-11", null, null]));
    expect(labels.get("AHU-MCT-11")).toBe("AHU");
    expect(labels.size).toBe(1);
  });
});
