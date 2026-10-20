import { describe, expect, it } from "vitest";
import { matchesSearch, type PartRow } from "./part-rows";

const row: PartRow = {
  id: "prt-FLT-2101",
  partNumber: "FLT-2101",
  name: "Pleated air filter, MERV 13, 24x24x2",
  category: "filters",
  categoryLabel: "Filters",
  onHand: 12,
  minimum: 6,
  unitOfMeasure: "each",
  unitLabel: "each",
  unitCost: 38.5,
  facilityId: "fac-KGN",
  binCode: "KGN-C11-05",
  stockState: "ok",
};

describe("searching the parts register", () => {
  it("matches the stock number, the name and the bin", () => {
    expect(matchesSearch(row, "FLT-2101")).toBe(true);
    expect(matchesSearch(row, "MERV")).toBe(true);
    expect(matchesSearch(row, "KGN-C11")).toBe(true);
  });

  it("ignores case and surrounding space", () => {
    expect(matchesSearch(row, "  flt-2101 ")).toBe(true);
  });

  it("does not match a field nobody searched for", () => {
    /*
     * The category has a facet of its own, so matching it here would make the
     * search return rows that do not contain what was typed — which reads as a
     * broken search rather than a generous one.
     */
    expect(matchesSearch(row, "Filters")).toBe(false);
    // Nor the numbers, which are quantities rather than identifiers: "12"
    // appearing in a cost or a count is not a part somebody was looking for.
    expect(matchesSearch({ ...row, name: "Gasket" }, "38.5")).toBe(false);
  });

  it("matches nothing when nothing matches", () => {
    expect(matchesSearch(row, "pump")).toBe(false);
  });

  it("an empty query filters nothing out", () => {
    // Clearing the box must show every part, not none.
    expect(matchesSearch(row, "")).toBe(true);
    expect(matchesSearch(row, "   ")).toBe(true);
  });

  it("can actually tell a match from a miss", () => {
    // The deletion control: a predicate stuck on true passes every assertion
    // above except the two negative ones, and one stuck on false passes only
    // those. This pins both directions in a single test.
    expect(matchesSearch(row, "FLT")).toBe(true);
    expect(matchesSearch(row, "BLT")).toBe(false);
  });
});
