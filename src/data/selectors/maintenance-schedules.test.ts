import { describe, expect, it } from "vitest";
import { buildSeed, type DemoData } from "@/data/seed";
import { scheduleReading } from "./maintenance-schedules";

const NOW = new Date("2026-09-12T00:00:00.000Z");

function seeded(): DemoData {
  return buildSeed(NOW);
}

describe("reading the planned visits", () => {
  it("resolves every seeded visit and counts none unreadable", () => {
    const data = seeded();
    const reading = scheduleReading(data);

    // A floor: the assertions below are satisfied by an empty list.
    expect(reading.resolved.length).toBeGreaterThan(0);
    expect(reading.resolved).toHaveLength(data.maintenanceSchedules.length);
    expect(reading.unreadable).toBe(0);
  });

  it("counts a visit whose plan is gone rather than dropping it silently", () => {
    /*
     * The whole reason this returns a count.
     *
     * Such a visit cannot be a row: every column names the plan or the asset,
     * and a planner has nothing to act on. But a list one shorter than the
     * records, with nothing saying so, leaves a reader comparing 26 against 25
     * with no way to find out where the other went. Unreadable is not absent.
     */
    const data = seeded();
    const orphaned = data.maintenanceSchedules[0]!;
    const planted: DemoData = {
      ...data,
      maintenancePlans: data.maintenancePlans.filter(
        (plan) => plan.id !== orphaned.planId,
      ),
    };

    const reading = scheduleReading(planted);

    // Every visit on that plan is unreadable, and none of them is a row.
    const onThatPlan = data.maintenanceSchedules.filter(
      (one) => one.planId === orphaned.planId,
    ).length;
    expect(onThatPlan).toBeGreaterThan(0);
    expect(reading.unreadable).toBe(onThatPlan);
    expect(reading.resolved).toHaveLength(
      data.maintenanceSchedules.length - onThatPlan,
    );
    expect(
      reading.resolved.some((row) => row.schedule.id === orphaned.id),
    ).toBe(false);
  });

  it("counts a visit whose asset is gone the same way", () => {
    const data = seeded();
    const orphaned = data.maintenanceSchedules[0]!;
    const planted: DemoData = {
      ...data,
      assets: data.assets.filter((asset) => asset.id !== orphaned.assetId),
    };

    const reading = scheduleReading(planted);

    expect(reading.unreadable).toBeGreaterThan(0);
    expect(
      reading.resolved.some((row) => row.schedule.id === orphaned.id),
    ).toBe(false);
  });

  it("would notice the difference between unreadable and absent", () => {
    /*
     * The positive beside the negative. A count stuck at zero passes the first
     * test; a count that rose for every visit would pass the second. Reading
     * both from one planted record is what tells them apart.
     */
    const data = seeded();
    const before = scheduleReading(data);
    const one = data.maintenanceSchedules[0]!;
    const planted: DemoData = {
      ...data,
      assets: data.assets.filter((asset) => asset.id !== one.assetId),
    };
    const after = scheduleReading(planted);

    expect(before.unreadable).toBe(0);
    expect(after.unreadable).toBeGreaterThan(before.unreadable);
    expect(after.resolved.length).toBeLessThan(before.resolved.length);
    // And an empty store is not "unreadable", it is empty.
    const emptied = scheduleReading({ ...data, maintenanceSchedules: [] });
    expect(emptied.resolved).toEqual([]);
    expect(emptied.unreadable).toBe(0);
  });

  it("shows an order only while it is still open", () => {
    // A finished order does not stand between a visit and its next one, and
    // showing it would tell a planner work is in hand when it is done.
    const data = seeded();
    const schedule = data.maintenanceSchedules[0]!;
    const completed = data.workOrders.find(
      (one) => one.status === "completed",
    )!;
    const open = data.workOrders.find((one) => one.status === "open")!;

    const withCompleted = scheduleReading({
      ...data,
      maintenanceSchedules: data.maintenanceSchedules.map((one) =>
        one.id === schedule.id ? { ...one, workOrderId: completed.id } : one,
      ),
    });
    const withOpen = scheduleReading({
      ...data,
      maintenanceSchedules: data.maintenanceSchedules.map((one) =>
        one.id === schedule.id ? { ...one, workOrderId: open.id } : one,
      ),
    });

    const find = (reading: ReturnType<typeof scheduleReading>) =>
      reading.resolved.find((row) => row.schedule.id === schedule.id)!;

    expect(find(withCompleted).openOrder).toBeNull();
    expect(find(withOpen).openOrder?.id).toBe(open.id);
  });
});
