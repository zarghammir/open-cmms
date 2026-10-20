import { describe, expect, it } from "vitest";
import { buildSeed, type DemoData } from "@/data/seed";
import { isOpenStatus } from "@/domain/constants/work-order-status";
import type { WorkOrder } from "@/domain/types";
import {
  dashboardKpis,
  openWorkOrdersByPriority,
  workOrdersByStatus,
} from "./kpi";

const TODAY = new Date("2026-09-12T00:00:00.000Z");
const TODAY_ISO = "2026-09-12";

const seed = buildSeed(TODAY);

/** The seed with a hand-written set of work orders, for the edge cases. */
function withOrders(orders: WorkOrder[]): DemoData {
  return { ...seed, workOrders: orders };
}

function order(overrides: Partial<WorkOrder>): WorkOrder {
  const base = seed.workOrders[0] as WorkOrder;
  return { ...base, ...overrides };
}

describe("dashboard numbers", () => {
  it("counts open work the same way the status rules do", () => {
    const kpis = dashboardKpis(seed, TODAY_ISO);
    const expected = seed.workOrders.filter((candidate) =>
      isOpenStatus(candidate.status),
    ).length;

    expect(kpis.openWorkOrders).toBe(expected);
    // Guards the comparison: if the seed held no open work, the line above
    // would pass while measuring nothing.
    expect(expected).toBeGreaterThan(0);
  });

  it("treats a missing due date as not overdue, not as overdue", () => {
    // The third state. An order with no due date is neither late nor on time;
    // the question does not apply, and answering "late" would invent a fact.
    const data = withOrders([
      order({ id: "a", status: "open", dueAt: null }),
      order({ id: "b", status: "open", dueAt: "2026-09-11" }),
    ]);

    expect(dashboardKpis(data, TODAY_ISO).overdue).toBe(1);
  });

  it("does not call closed work overdue", () => {
    const data = withOrders([
      order({ id: "a", status: "completed", dueAt: "2020-01-01" }),
      order({ id: "b", status: "cancelled", dueAt: "2020-01-01" }),
      order({ id: "c", status: "waitingForParts", dueAt: "2020-01-01" }),
    ]);

    expect(dashboardKpis(data, TODAY_ISO).overdue).toBe(1);
  });

  it("counts due today as not yet overdue", () => {
    const data = withOrders([
      order({ id: "a", status: "open", dueAt: TODAY_ISO }),
    ]);
    expect(dashboardKpis(data, TODAY_ISO).overdue).toBe(0);
  });

  it("counts the last seven days of completed work, inclusive", () => {
    const data = withOrders([
      order({
        id: "a",
        status: "completed",
        completedAt: "2026-09-12T09:00:00.000Z",
      }),
      order({
        id: "b",
        status: "completed",
        completedAt: "2026-09-05T09:00:00.000Z",
      }),
      order({
        id: "c",
        status: "completed",
        completedAt: "2026-09-04T09:00:00.000Z",
      }),
    ]);

    expect(dashboardKpis(data, TODAY_ISO).completedLastSevenDays).toBe(2);
  });

  it("counts a part as short only when it is under its minimum", () => {
    const parts = [
      { ...seed.parts[0]!, id: "p1", quantityOnHand: 1, reorderPoint: 2 },
      { ...seed.parts[0]!, id: "p2", quantityOnHand: 2, reorderPoint: 2 },
      { ...seed.parts[0]!, id: "p3", quantityOnHand: 3, reorderPoint: 2 },
    ];

    expect(dashboardKpis({ ...seed, parts }, TODAY_ISO).partsBelowMinimum).toBe(
      1,
    );
  });

  it("narrows to one site when asked", () => {
    const site = seed.facilities[0]!.id;
    const all = dashboardKpis(seed, TODAY_ISO);
    const one = dashboardKpis(seed, TODAY_ISO, site);

    expect(one.openWorkOrders).toBeLessThanOrEqual(all.openWorkOrders);
    expect(
      seed.facilities.reduce(
        (total, facility) =>
          total + dashboardKpis(seed, TODAY_ISO, facility.id).openWorkOrders,
        0,
      ),
    ).toBe(all.openWorkOrders);
  });
});

describe("status and priority breakdowns", () => {
  it("accounts for every work order exactly once", () => {
    const counts = workOrdersByStatus(seed);
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

    expect(total).toBe(seed.workOrders.length);
  });

  it("names every status, including the empty ones", () => {
    const counts = workOrdersByStatus(
      withOrders([order({ id: "a", status: "open" })]),
    );

    expect(Object.keys(counts).sort()).toEqual([
      "assigned",
      "cancelled",
      "completed",
      "inProgress",
      "open",
      "waitingForParts",
    ]);
    // Zero is a number the chart has to draw, not a series to leave out.
    expect(counts.completed).toBe(0);
  });

  it("counts priorities only for work that is still open", () => {
    const data = withOrders([
      order({ id: "a", status: "open", priority: "critical" }),
      order({ id: "b", status: "completed", priority: "critical" }),
    ]);

    expect(openWorkOrdersByPriority(data).critical).toBe(1);
  });
});
