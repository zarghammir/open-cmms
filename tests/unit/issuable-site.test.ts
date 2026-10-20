import { describe, expect, it } from "vitest";
import { buildSeed } from "@/data/seed";
import {
  crossablePartsAt,
  crossingAt,
  siteCodeOf,
} from "../fixtures/crossable";

/**
 * The walkthrough can take a part out of stores wherever it starts.
 *
 * The primary flow raises its order against whatever the equipment register
 * lists first, then issues a part at that asset's site until the shelf drops
 * below its minimum. One site in the demonstration is deliberately a store with
 * nothing on the shelves, so if the register ever opens there, the story cannot
 * be told — and the way that arrives today is a throw inside a fixture, in a
 * browser run, which is the most expensive place to learn it.
 *
 * This says it in the unit suite instead, from the same rule the fixture uses.
 * A red here names the site and the run that would have failed; a green here
 * with a red there means the register's order changed rather than the estate.
 */

/*
 * Two days, because the estate is generated from the day it is given. The
 * stock figures do not move with the calendar today, and a check that only ever
 * asks about one day would not notice if they started to.
 */
const DAYS = ["2026-09-12", "2026-09-17"] as const;

describe("the site the walkthrough starts at", () => {
  for (const day of DAYS) {
    const seed = buildSeed(new Date(`${day}T00:00:00.000Z`));

    it(`has stock the story can cross a minimum with, on ${day}`, () => {
      /*
       * `assets.list()` in register order, unsorted, which is what the table
       * renders when nobody has clicked a header — the same first row the
       * fixture reads out of the DOM. If a default sort is ever added to that
       * table, this has to follow it, and the browser run would go red first.
       */
      const first = seed.assets[0];
      expect(first, "the seed holds no equipment at all").toBeDefined();

      const code = siteCodeOf(seed, first!.facilityId);
      const crossing = crossingAt(seed, first!.facilityId);

      expect(
        crossing === null ? `${first!.assetTag} at ${code}` : null,
        "the register opens on a site with nothing issuable, so the walkthrough cannot cross a minimum there",
      ).toBeNull();

      // Not merely present: issuable in one go, which is what the story does.
      expect(crossing!.issue).toBeGreaterThan(0);
      expect(crossing!.issue).toBeLessThanOrEqual(
        crossing!.part.quantityOnHand,
      );
    });
  }

  it("knows which sites have nothing to issue, and says so rather than averaging", () => {
    /*
     * The floor, and the honest half of the picture. A version of the check
     * above that asked "does any site anywhere have stock" would pass on an
     * estate where the one site the register opens on is empty — and this test
     * would then be agreeing with itself about a site nobody visits.
     *
     * So both are stated: every site is counted, and the empty ones are named.
     * Moncton is empty by design — the parts chapter of the demonstration
     * deliberately has one store with nothing in it — and naming it here is
     * what stops the next person reading a throw as a broken fixture.
     */
    const seed = buildSeed(new Date(`${DAYS[0]}T00:00:00.000Z`));
    expect(seed.facilities.length).toBeGreaterThanOrEqual(5);

    const counts = seed.facilities.map((facility) => ({
      code: facility.code,
      crossable: crossablePartsAt(seed, facility.id).length,
    }));

    expect(
      counts.filter((one) => one.crossable > 0).length,
      "no site in the estate holds a part above its minimum",
    ).toBeGreaterThan(0);

    // Measured, and written down so a change to it is deliberate: four of the
    // five sites hold issuable stock, and the fifth is the empty store.
    expect(
      counts.filter((one) => one.crossable === 0).map((one) => one.code),
    ).toEqual(["MCT"]);
  });
});
