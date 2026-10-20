import { describe, expect, it } from "vitest";
import { buildSeed, type DemoData } from "@/data/seed";
import { isOverdue } from "@/data/repositories/work-order";
import type { WorkOrder } from "@/domain/types";
import {
  partsUsedBy,
  readAssignee,
  readDue,
  workOrderDetail,
} from "./work-order-detail";

const NOW = new Date("2026-09-12T14:05:00.000Z");
const TODAY = "2026-09-12";

function seed(): DemoData {
  return buildSeed(NOW);
}

function withDue(
  data: DemoData,
  dueAt: string | null,
  status: WorkOrder["status"],
): WorkOrder {
  return { ...data.workOrders[0]!, dueAt, status };
}

describe("reading a due date as a sentence", () => {
  it("tells absent, today, ahead and late apart", () => {
    const data = seed();

    expect(readDue(withDue(data, null, "open"), TODAY)).toEqual({
      kind: "none",
    });
    expect(readDue(withDue(data, TODAY, "open"), TODAY)).toEqual({
      kind: "today",
    });
    expect(readDue(withDue(data, "2026-09-15", "open"), TODAY)).toEqual({
      kind: "ahead",
      days: 3,
    });
    expect(readDue(withDue(data, "2026-09-04", "open"), TODAY)).toEqual({
      kind: "late",
      days: 8,
    });
  });

  it("does not call a closed order late, however long ago its date was", () => {
    /*
     * The case that makes this a reading rather than a subtraction. A cancelled
     * order eight days past its date is not eight days late — nobody is waiting
     * on it. Saying so would put "8 days late" in red on work that is finished,
     * and an evaluator counting late work would count it.
     */
    const data = seed();

    for (const status of ["completed", "cancelled"] as const) {
      expect(readDue(withDue(data, "2026-09-04", status), TODAY)).toEqual({
        kind: "passed",
        date: "2026-09-04",
      });
    }
  });

  it("agrees with `isOverdue` on every order in the seed", () => {
    /*
     * The queue, the dashboard and this page all print the word "late", and
     * only one of them is allowed to decide what it means. This asserts the
     * agreement across the whole seed rather than on a case chosen to pass.
     */
    const data = seed();
    let late = 0;

    for (const order of data.workOrders) {
      const reading = readDue(order, TODAY);
      expect(reading.kind === "late").toBe(isOverdue(order, TODAY));
      if (reading.kind === "late") late += 1;
    }

    // The floor: the agreement above is worth something only if the seed
    // actually contains late work. With none, every comparison is false===false.
    expect(late).toBeGreaterThan(0);
  });
});

describe("who an order is assigned to", () => {
  it("gives a person when a person is named", () => {
    const data = seed();
    const assignment = data.workOrderAssignments.find(
      (candidate) => candidate.userId !== null,
    )!;

    const assignee = readAssignee(data, assignment.workOrderId);
    expect(assignee.kind).toBe("person");
    if (assignee.kind !== "person") throw new Error("unreachable");
    expect(assignee.user.id).toBe(assignment.userId);
  });

  it("gives the crew code, not `nobody`, when only a code is recorded", () => {
    const data = seed();
    const crewOnly = data.workOrderAssignments.find(
      (candidate) => candidate.userId === null && candidate.crewCode !== null,
    )!;
    expect(crewOnly).toBeDefined();

    const assignee = readAssignee(data, crewOnly.workOrderId);
    expect(assignee.kind).toBe("crew");
    if (assignee.kind !== "crew") throw new Error("unreachable");
    expect(assignee.code).toBe(crewOnly.crewCode);
    // `CONT01` is external work, which is a third answer beside "a person" and
    // "a code nobody recognises".
    expect(assignee.resolvesTo).toBe("contractor");
  });

  it("separates a code that resolves to a person from one that resolves to nothing", () => {
    const data = seed();
    const order = data.workOrders[0]!;
    const base = {
      id: "wka-test",
      organizationId: data.organization.id,
      workOrderId: order.id,
      userId: null,
      assignedAt: NOW.toISOString(),
      assignedByUserId: data.users[0]!.id,
    };

    const known = readAssignee(
      {
        ...data,
        workOrderAssignments: [{ ...base, crewCode: "TECH01" }],
      },
      order.id,
    );
    expect(known.kind).toBe("crew");
    if (known.kind !== "crew") throw new Error("unreachable");
    // A real person stands behind this code, and the screen can say who.
    expect(known.resolvesTo).not.toBeNull();
    expect(known.resolvesTo).not.toBe("contractor");

    const stranger = readAssignee(
      {
        ...data,
        workOrderAssignments: [{ ...base, crewCode: "ZZZ99" }],
      },
      order.id,
    );
    expect(stranger.kind).toBe("crew");
    if (stranger.kind !== "crew") throw new Error("unreachable");
    // Unknown, which is not "nobody". The record says a crew has it; this
    // organisation simply cannot say which crew.
    expect(stranger.resolvesTo).toBeNull();
  });

  it("says nobody only when nothing at all is recorded", () => {
    const data = seed();
    const order = data.workOrders[0]!;

    expect(
      readAssignee({ ...data, workOrderAssignments: [] }, order.id).kind,
    ).toBe("nobody");
  });
});

describe("the parts an order consumed", () => {
  it("takes this order's movements and no others", () => {
    const data = seed();
    const withMovements = data.workOrders.find((order) =>
      data.inventoryTransactions.some(
        (transaction) => transaction.workOrderId === order.id,
      ),
    )!;
    expect(withMovements).toBeDefined();

    const used = partsUsedBy(data, withMovements.id);
    expect(used.length).toBeGreaterThan(0);
    expect(
      used.every((entry) => entry.transaction.workOrderId === withMovements.id),
    ).toBe(true);

    /*
     * The control that matters: a movement attributed to no order at all — a
     * receipt, a shelf count — belongs to nobody and must not be swept in.
     *
     * Planted rather than found. The seed contains no such movement today
     * (every transaction in it carries a work order), so a test written to look
     * for one would pass by finding nothing and would keep passing if this
     * function started returning everything. Building the case makes the
     * assertion true of the function instead of true of the seed.
     */
    const planted = {
      ...data.inventoryTransactions[0]!,
      id: "inv-unattributed",
      workOrderId: null,
    };
    const withPlanted = partsUsedBy(
      {
        ...data,
        inventoryTransactions: [...data.inventoryTransactions, planted],
      },
      withMovements.id,
    );
    expect(withPlanted).toHaveLength(used.length);
    expect(
      withPlanted.some((entry) => entry.transaction.id === planted.id),
    ).toBe(false);
  });

  it("carries a movement whose part record is gone, rather than dropping it", () => {
    // Losing the row would understate what the order consumed. Keeping it with
    // `part: null` is the answer the screen can say out loud.
    const data = seed();
    const movement = data.inventoryTransactions.find(
      (transaction) => transaction.workOrderId !== null,
    )!;

    const used = partsUsedBy(
      { ...data, parts: [] },
      movement.workOrderId as string,
    );
    expect(used.length).toBeGreaterThan(0);
    expect(used.every((entry) => entry.part === null)).toBe(true);
  });
});

describe("the whole detail", () => {
  it("orders the history oldest first and the comments newest first", () => {
    const data = seed();
    const order = data.workOrders.find(
      (candidate) =>
        data.workOrderStatusHistory.filter(
          (entry) => entry.workOrderId === candidate.id,
        ).length > 1,
    )!;

    const detail = workOrderDetail(data, order, TODAY);
    expect(detail.history.length).toBeGreaterThan(1);
    const times = detail.history.map(({ entry }) => entry.at);
    expect(times).toEqual([...times].sort());
  });

  it("says nothing was logged rather than saying zero", () => {
    const data = seed();
    const order = data.workOrders[0]!;

    expect(
      workOrderDetail({ ...data, labourEntries: [] }, order, TODAY)
        .loggedMinutes,
    ).toBeNull();

    // The control: the same seed does log time somewhere, so the null above is
    // an order with no entries rather than a selector that never returns one.
    const logged = data.workOrders
      .map((candidate) => workOrderDetail(data, candidate, TODAY).loggedMinutes)
      .filter((minutes): minutes is number => minutes !== null);
    expect(logged.length).toBeGreaterThan(0);
    expect(logged.every((minutes) => minutes > 0)).toBe(true);
  });

  it("names the place from the outside in, and does not invent one", () => {
    const data = seed();
    const order = data.workOrders[0]!;

    const detail = workOrderDetail(data, order, TODAY);
    expect(detail.locationPath.length).toBeGreaterThan(0);
    expect(detail.asset).not.toBeNull();
    expect(detail.facility).not.toBeNull();

    // A location that does not resolve is an empty path, never a guessed one.
    const orphan = workOrderDetail({ ...data, locations: [] }, order, TODAY);
    expect(orphan.locationPath).toEqual([]);
  });
});
