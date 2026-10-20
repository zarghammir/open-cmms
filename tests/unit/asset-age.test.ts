import { describe, expect, it } from "vitest";
import { ASSET_TYPE_SEEDS } from "@/data/seed/catalog";
import { buildSeed } from "@/data/seed";

/**
 * No asset is older than its own kind of equipment would be.
 *
 * Every asset used to draw its age from one range — 400 to 7300 days — so a
 * UPS and a CO2 incubator could be as old as a boiler. Nothing failed, and
 * nothing looked wrong unless you knew the equipment: a maintenance reader sees
 * a twenty-year-old UPS and reads a battery nobody replaced, which tells them
 * the data was invented by somebody who had not asked.
 *
 * The ceiling is per type because the honest answer is per type, and this names
 * the asset and its type rather than reporting a count — a report that says
 * "three assets are too old" is a report somebody has to go and find.
 */

const TODAY = new Date("2026-09-12T00:00:00.000Z");

describe("how old the equipment is", () => {
  const seed = buildSeed(TODAY);
  const ceilings = new Map(
    ASSET_TYPE_SEEDS.map((type) => [`atp-${type.key}`, type.maxAgeYears]),
  );

  it("has assets and ceilings to check", () => {
    /*
     * The floor. An empty asset list, or a map that keyed on something the
     * assets do not carry, would report no breaches and pass — the same green
     * as an estate with believable ages.
     */
    expect(seed.assets.length).toBeGreaterThanOrEqual(50);
    expect(ceilings.size).toBe(ASSET_TYPE_SEEDS.length);
    expect(
      seed.assets.every((asset) => ceilings.has(asset.assetTypeId)),
      "an asset whose type has no ceiling would be skipped in silence",
    ).toBe(true);
  });

  it("holds nothing older than its type allows", () => {
    const day = TODAY.getTime();
    const tooOld = seed.assets
      .map((asset) => {
        const years =
          (day - new Date(asset.installedAt).getTime()) / 31_557_600_000;
        return { asset, years, ceiling: ceilings.get(asset.assetTypeId)! };
      })
      .filter(({ years, ceiling }) => years > ceiling)
      .map(
        ({ asset, years, ceiling }) =>
          `${asset.assetTag}: ${years.toFixed(1)} years, ceiling ${ceiling}`,
      );

    expect(tooOld).toEqual([]);
  });

  it("still holds equipment that is genuinely old", () => {
    /*
     * The control beside it. A generator that installed everything last Tuesday
     * would satisfy every ceiling and describe an estate nobody maintains —
     * "no asset is too old" is only worth asserting if some asset is old.
     */
    const day = TODAY.getTime();
    const oldest = Math.max(
      ...seed.assets.map(
        (asset) =>
          (day - new Date(asset.installedAt).getTime()) / 31_557_600_000,
      ),
    );

    expect(oldest).toBeGreaterThan(10);
  });

  it("gives the short-lived types a short ceiling", () => {
    // The two the data review named by hand, so the numbers cannot drift back
    // to twenty without this saying so.
    const ceiling = (key: string) =>
      ASSET_TYPE_SEEDS.find((type) => type.key === key)?.maxAgeYears;

    expect(ceiling("uninterruptiblePowerSupply")).toBeLessThanOrEqual(10);
    expect(ceiling("incubator")).toBeLessThanOrEqual(15);
  });
});
