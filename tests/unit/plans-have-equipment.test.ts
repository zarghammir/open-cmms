import { describe, expect, it } from "vitest";
import { buildSeed } from "@/data/seed";

/**
 * No seeded maintenance plan is left with nothing to visit.
 *
 * The plans table draws "No equipment" instead of a nought for a plan with no
 * schedules — on purpose, because a plan nobody can perform is a problem a
 * planner should see. That makes it the wrong thing to ship in a demonstration
 * for a reason that is merely arithmetic: WA-87's pinned equipment comes out of
 * the twelve-per-site budget, and the chiller lost its last asset to the
 * squeeze, leaving its plan on screen with nothing under it.
 *
 * The seed now emits a plan only for a type it seeded equipment of. This is the
 * check that says so, at the level where it fails in a second rather than in a
 * browser: the browser suite did catch it, which is how it was found, but only
 * after a build and a minute and a half.
 */

const TODAY = new Date("2026-09-12T00:00:00.000Z");

describe("every maintenance plan has equipment to visit", () => {
  const seed = buildSeed(TODAY);

  it("has plans and schedules to check", () => {
    // The floor. A seed that emitted no plans at all would satisfy the
    // assertion below for ever.
    expect(seed.maintenancePlans.length).toBeGreaterThan(5);
    expect(seed.maintenanceSchedules.length).toBeGreaterThan(
      seed.maintenancePlans.length,
    );
  });

  it("names any plan the estate cannot perform", () => {
    const scheduled = new Set(
      seed.maintenanceSchedules.map((schedule) => schedule.planId),
    );
    const orphaned = seed.maintenancePlans
      .filter((plan) => !scheduled.has(plan.id))
      .map((plan) => `${plan.code} (${plan.assetTypeId})`);

    expect(
      orphaned,
      "these plans have no equipment to visit, so the plans table draws " +
        '"No equipment" against them. Either the estate should hold one of ' +
        "that type, or the plan should not be seeded.",
    ).toEqual([]);
  });

  it("also holds the other way round: nothing is scheduled against a plan that is gone", () => {
    // The pair. Filtering plans without filtering schedules would leave
    // schedules pointing at a plan id nothing holds, which no screen could
    // draw and this would not otherwise notice.
    const planIds = new Set(seed.maintenancePlans.map((plan) => plan.id));
    const dangling = seed.maintenanceSchedules
      .filter((schedule) => !planIds.has(schedule.planId))
      .map((schedule) => schedule.id);

    expect(
      dangling,
      "schedules pointing at a plan the seed did not emit",
    ).toEqual([]);
  });
});
