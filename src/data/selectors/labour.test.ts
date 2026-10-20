import { describe, expect, it } from "vitest";
import { buildSeed, type DemoData } from "@/data/seed";
import type { LabourEntry } from "@/domain/types";
import { loggedMinutes } from "./labour";

const TODAY = new Date("2026-09-12T00:00:00.000Z");
const seed = buildSeed(TODAY);

function entry(overrides: Partial<LabourEntry>): LabourEntry {
  return {
    id: "lab-test",
    organizationId: seed.organization.id,
    workOrderId: "wko-WO-2026-0001",
    userId: seed.users[0]!.id,
    minutes: 30,
    workedAt: "2026-09-10T10:00:00.000Z",
    note: null,
    ...overrides,
  };
}

function withEntries(entries: LabourEntry[]): DemoData {
  return { ...seed, labourEntries: entries };
}

describe("time logged against a work order", () => {
  it("adds up the entries", () => {
    const data = withEntries([
      entry({ id: "a", workOrderId: "wko-1", minutes: 45 }),
      entry({ id: "b", workOrderId: "wko-1", minutes: 75 }),
      entry({ id: "c", workOrderId: "wko-2", minutes: 999 }),
    ]);

    expect(loggedMinutes(data, "wko-1")).toBe(120);
  });

  it("says nothing was logged, rather than saying zero", () => {
    /*
     * The whole reason this returns `number | null`. Every order imported from
     * the legacy system arrives with no entries, because the MP2 export has no
     * minutes column — and a screen printing "0 min" for those would be saying
     * somebody worked no time, rather than that nobody wrote anything down.
     */
    const data = withEntries([
      entry({ id: "elsewhere", workOrderId: "wko-2" }),
    ]);

    expect(loggedMinutes(data, "wko-1")).toBeNull();
    expect(loggedMinutes(data, "wko-1")).not.toBe(0);
  });

  it("cannot produce a total of zero when there are entries", () => {
    // The other half of the guarantee: minutes are positive by schema, so a
    // non-null answer is always greater than zero. If that ever stops being
    // true, "0 min" becomes renderable again and this is where it shows.
    const data = withEntries([
      entry({ id: "a", workOrderId: "wko-1", minutes: 15 }),
    ]);

    const total = loggedMinutes(data, "wko-1");
    expect(total).not.toBeNull();
    expect(total!).toBeGreaterThan(0);
  });

  it("is looking at a seed that logs time at all", () => {
    // Without this the tests above all build their own data and would pass
    // against a seed that never produced an entry — and the demonstration
    // would show "no time logged" on every order that was ever worked.
    const worked = seed.workOrders.filter(
      (order) => loggedMinutes(seed, order.id) !== null,
    );

    expect(
      worked.length,
      "no seeded work order has any time logged against it",
    ).toBeGreaterThan(0);
    // And an order nobody started has none, which is the honest empty case.
    const untouched = seed.workOrders.find(
      (order) => order.status === "open" && order.startedAt === null,
    );
    expect(untouched).toBeDefined();
    expect(loggedMinutes(seed, untouched!.id)).toBeNull();
  });
});
