import { describe, expect, it } from "vitest";
import { buildSeed, type DemoData } from "@/data/seed";
import { isOpenStatus } from "@/domain/constants/work-order-status";
import type { IsoDate, WorkOrder } from "@/domain/types";

/**
 * The demonstration's opening shot has to exist.
 *
 * The recording starts on a screen that is supposed to show the product doing
 * its job: work that is still open, marked Critical, already past its due date,
 * at a site with a name. If the seed ever stops containing one of those, the
 * demonstration opens on a calm screen with nothing to look at, and the person
 * recording it finds out at recording time.
 *
 * It holds today, and not by accident of one date: every due date is a fixed
 * offset drawn from the seeded generator, so an order that is six days overdue
 * is six days overdue whenever the demonstration is opened. What is accidental
 * is that the draws happened to land on Critical — widen the priority pool,
 * shift the date ranges or change the status mix and this could quietly go
 * away. That is what this test is for.
 *
 * It asserts the record exists. Whether it reaches the first screen is a
 * question of sorting, which belongs to the screens (WA-9), not to the seed.
 */

/** Open, Critical, and past its due date on the given day. */
export function openCriticalOverdue(
  data: DemoData,
  today: IsoDate,
): WorkOrder[] {
  return data.workOrders.filter(
    (order) =>
      isOpenStatus(order.status) &&
      order.priority === "critical" &&
      order.dueAt !== null &&
      order.dueAt < today,
  );
}

/** Days a reviewer might plausibly open the demonstration on. */
const DAYS: IsoDate[] = [
  "2026-09-12",
  "2026-09-13",
  "2026-10-14",
  "2026-12-31",
  "2027-02-28",
];

describe("the demonstration's opening shot", () => {
  it("has work orders to look through at all", () => {
    // Without this, an empty seed would make every filter below return nothing
    // and the control could not tell that apart from a working check.
    const seed = buildSeed(new Date("2026-09-12T00:00:00.000Z"));
    expect(seed.workOrders.length).toBeGreaterThan(20);
  });

  it("always holds at least one open, critical, overdue work order", () => {
    for (const day of DAYS) {
      const seed = buildSeed(new Date(`${day}T00:00:00.000Z`));
      const found = openCriticalOverdue(seed, day);

      expect(
        found.length,
        `nothing to open the demonstration with on ${day}`,
      ).toBeGreaterThan(0);
    }
  });

  it("names the site that work is at", () => {
    const day = DAYS[0] as IsoDate;
    const seed = buildSeed(new Date(`${day}T00:00:00.000Z`));

    for (const order of openCriticalOverdue(seed, day)) {
      const facility = seed.facilities.find(
        (candidate) => candidate.id === order.facilityId,
      );
      expect(facility, `${order.number} is at no known site`).toBeDefined();
      // A site with a name in one language only is a site the French
      // recording cannot show.
      expect(facility?.name.en.length).toBeGreaterThan(0);
      expect(facility?.name.fr.length).toBeGreaterThan(0);

      const asset = seed.assets.find(
        (candidate) => candidate.id === order.assetId,
      );
      expect(asset, `${order.number} is on no known asset`).toBeDefined();
    }
  });

  it("would notice if the seed stopped holding one", () => {
    // The deletion control: take the qualifying orders out and the same filter
    // finds nothing, so the assertion above is reading the work orders rather
    // than passing on any data at all.
    const day = DAYS[0] as IsoDate;
    const seed = buildSeed(new Date(`${day}T00:00:00.000Z`));
    const qualifying = new Set(
      openCriticalOverdue(seed, day).map((order) => order.id),
    );

    expect(qualifying.size).toBeGreaterThan(0);
    expect(
      openCriticalOverdue(
        {
          ...seed,
          workOrders: seed.workOrders.filter(
            (order) => !qualifying.has(order.id),
          ),
        },
        day,
      ),
    ).toEqual([]);
  });

  it("counts only work that is all three things", () => {
    // Each control changes exactly one of the three conditions, so a filter
    // that had quietly dropped one of them cannot pass all of these.
    const day = DAYS[0] as IsoDate;
    const seed = buildSeed(new Date(`${day}T00:00:00.000Z`));
    const one = openCriticalOverdue(seed, day)[0] as WorkOrder;

    const only = (order: WorkOrder): DemoData => ({
      ...seed,
      workOrders: [order],
    });

    expect(openCriticalOverdue(only(one), day)).toHaveLength(1);
    expect(
      openCriticalOverdue(only({ ...one, status: "completed" }), day),
    ).toEqual([]);
    expect(
      openCriticalOverdue(only({ ...one, status: "cancelled" }), day),
    ).toEqual([]);
    expect(
      openCriticalOverdue(only({ ...one, priority: "high" }), day),
    ).toEqual([]);
    expect(openCriticalOverdue(only({ ...one, dueAt: day }), day)).toEqual([]);
    expect(openCriticalOverdue(only({ ...one, dueAt: null }), day)).toEqual([]);
  });
});
