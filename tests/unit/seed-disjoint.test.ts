import { describe, expect, it } from "vitest";
import { buildSeed } from "@/data/seed";
import { fixtureEquipment, fixtureInventory } from "../fixtures/mp2";

/**
 * The seed's natural keys and the import fixture's natural keys never overlap.
 *
 * The fixture carries exactly twelve planted defects, two of which are
 * duplicate asset tags, and WA-17's validation report is expected to find
 * exactly those. A seed asset tag that matched one of the fixture's would add
 * a duplicate nobody planted, the report would grow a row, and the demo script
 * built on "twelve defects" would be wrong — with nothing to say why.
 *
 * So this is not a tidiness check. It is what keeps WA-17's story true.
 */

const TODAY = new Date("2026-09-12T00:00:00.000Z");

function intersection(left: Iterable<string>, right: Set<string>): string[] {
  return [...left].filter((value) => right.has(value)).sort();
}

describe("seed keys are disjoint from the import fixture", () => {
  const seed = buildSeed(TODAY);
  const fixtureTags = new Set(
    fixtureEquipment()
      .map((row) => row.EQUIP_NO)
      .filter((tag): tag is string => Boolean(tag)),
  );
  const fixtureStockNumbers = new Set(
    fixtureInventory()
      .map((row) => row.STOCK_NO)
      .filter((value): value is string => Boolean(value)),
  );

  it("read the fixture at all", () => {
    // Without this, an unreadable or renamed fixture would leave both sets
    // empty and every assertion below would pass while comparing nothing.
    expect(fixtureTags.size).toBe(78);
    expect(fixtureStockNumbers.size).toBe(40);
    expect(seed.assets.length).toBeGreaterThan(40);
    expect(seed.parts.length).toBeGreaterThan(20);
  });

  it("shares no asset tag with the fixture", () => {
    expect(fixtureTags.size).toBe(78);
    expect(seed.assets.length).toBeGreaterThan(40);
    expect(
      intersection(
        seed.assets.map((asset) => asset.assetTag),
        fixtureTags,
      ),
    ).toEqual([]);
  });

  it("shares no stock number with the fixture", () => {
    expect(fixtureStockNumbers.size).toBe(40);
    expect(seed.parts.length).toBeGreaterThan(20);
    expect(
      intersection(
        seed.parts.map((part) => part.partNumber),
        fixtureStockNumbers,
      ),
    ).toEqual([]);
  });

  it("shares no work-order number with the fixture", () => {
    // The fixture uses WO-1000nn; the seed uses WO-<year>-nnnn.
    const fixtureNumbers = new Set(
      Array.from({ length: 120 }, (_, index) => `WO-${100001 + index}`),
    );
    expect(fixtureNumbers.size).toBe(120);
    expect(seed.workOrders.length).toBeGreaterThan(20);
    expect(
      intersection(
        seed.workOrders.map((order) => order.number),
        fixtureNumbers,
      ),
    ).toEqual([]);
  });

  it("would notice an overlap", () => {
    // The deletion control. If the comparison itself stopped working, the
    // three assertions above would pass on any seed at all.
    const overlapping = [...fixtureTags][0] as string;
    expect(intersection([overlapping, "AHU-KGN-11"], fixtureTags)).toEqual([
      overlapping,
    ]);
  });
});
