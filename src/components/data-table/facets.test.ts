import { describe, expect, it } from "vitest";
import { matchesFacet } from "./facets";

/**
 * Moved here with the predicate, from `assets/asset-rows.test.ts`. The
 * assertions are unchanged — they were never about assets, only about what an
 * empty selection means.
 */
describe("filtering by a facet", () => {
  it("keeps a row whose value was selected", () => {
    expect(matchesFacet("active", ["active", "inactive"])).toBe(true);
  });

  it("drops a row whose value was not", () => {
    expect(matchesFacet("decommissioned", ["active"])).toBe(false);
  });

  it("treats no selection as no filter, not as a filter matching nothing", () => {
    // Opening a filter menu and closing it again must not empty the table.
    expect(matchesFacet("active", [])).toBe(true);
    expect(matchesFacet("active", undefined)).toBe(true);
  });

  it("can actually tell the two apart", () => {
    // The deletion control: a predicate stuck on true would pass every
    // assertion above except this one.
    expect(matchesFacet("active", ["inactive"])).toBe(false);
    expect(matchesFacet("active", ["active"])).toBe(true);
  });
});
