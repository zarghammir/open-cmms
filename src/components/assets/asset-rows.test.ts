import { describe, expect, it } from "vitest";
import { matchesSearch, type AssetRow } from "./asset-rows";

const row: AssetRow = {
  id: "ast-AHU-KGN-11",
  assetTag: "AHU-KGN-11",
  name: "Air handling unit AHU-KGN-11",
  typeId: "atp-airHandlingUnit",
  typeLabel: "Air handling unit",
  facilityId: "fac-KGN",
  facilityName: "Kingston Central Laboratory",
  facilityCity: "Kingston",
  locationCode: "KGN-B02-219",
  status: "active",
  criticality: "critical",
  installedOn: "2015-03-04",
  manufacturer: "Norvent Systems",
  model: "NS-3689X",
};

describe("searching the assets table", () => {
  it("matches the tag, the name and the location", () => {
    expect(matchesSearch(row, "AHU-KGN-11")).toBe(true);
    expect(matchesSearch(row, "air handling")).toBe(true);
    expect(matchesSearch(row, "B02-219")).toBe(true);
  });

  it("ignores case and surrounding space", () => {
    expect(matchesSearch(row, "  ahu-kgn-11 ")).toBe(true);
  });

  it("does not match a field nobody searched for", () => {
    // The control that keeps the search honest: manufacturer and model are
    // deliberately not searched, so a helper that quietly searched everything
    // would fail here rather than feel vaguely wrong in use.
    expect(matchesSearch(row, "Norvent")).toBe(false);
    expect(matchesSearch(row, "NS-3689X")).toBe(false);
  });

  it("matches nothing when nothing matches", () => {
    expect(matchesSearch(row, "elevator")).toBe(false);
  });

  it("an empty query filters nothing out", () => {
    expect(matchesSearch(row, "")).toBe(true);
    expect(matchesSearch(row, "   ")).toBe(true);
  });
});
