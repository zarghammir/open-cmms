import { describe, expect, it } from "vitest";
import { buildSeed } from "@/data/seed";
import {
  inQueueOrder,
  recordLabel,
  subjectKey,
  type OutboxEntry,
} from "./outbox";

const actor = { userId: "usr-raman", role: "maintenanceCoordinator" } as const;

function entry(id: string, queuedAt: string): OutboxEntry {
  return {
    id,
    kind: "one",
    label: `WO-2026-000${id}`,
    queuedOffline: true,
    subject: { collection: "workOrders", id: `wko-${id}` },
    baseVersion: 0,
    queuedAt,
    actor: { ...actor },
    mutation: {
      operation: "update",
      collection: "workOrders",
      id: `wko-${id}`,
      changes: { status: "assigned" },
      actor: { ...actor },
      audit: {
        entity: "workOrder",
        action: "statusChanged",
        summaryKey: "audit.statusChanged",
        summaryParams: {},
      },
    },
  };
}

describe("the order a queue drains in", () => {
  const written = [
    entry("a", "2026-09-13T10:00:00.000Z"),
    entry("b", "2026-09-13T10:00:05.000Z"),
    entry("c", "2026-09-13T10:00:09.000Z"),
  ];

  it("has entries to order at all", () => {
    // Without this an empty queue would satisfy every assertion below.
    expect(written).toHaveLength(3);
  });

  it("drains oldest first", () => {
    expect(inQueueOrder(written).map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("puts a shuffled queue back into the order it was written", () => {
    // The deletion control: a function that returned its input unchanged would
    // pass the assertion above and fail this one.
    const shuffled = [written[2]!, written[0]!, written[1]!];
    expect(inQueueOrder(shuffled).map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("still has an order when two changes share a millisecond", () => {
    // Replay order decides what the records end up saying, so "same time" must
    // not mean "either way round" — it would differ between runs.
    const same = "2026-09-13T10:00:00.000Z";
    const tied = [entry("z", same), entry("y", same), entry("x", same)];

    expect(inQueueOrder(tied).map((e) => e.id)).toEqual(["x", "y", "z"]);
    expect(inQueueOrder(tied).map((e) => e.id)).toEqual(
      inQueueOrder([...tied].reverse()).map((e) => e.id),
    );
  });

  it("leaves the queue it was given alone", () => {
    const before = written.map((e) => e.id);
    inQueueOrder(written);
    expect(written.map((e) => e.id)).toEqual(before);
  });

  it("names what an entry touched", () => {
    expect(subjectKey({ collection: "workOrders", id: "wko-1" })).toBe(
      "workOrders:wko-1",
    );
  });
});

describe("naming a record for a person", () => {
  const data = buildSeed(new Date("2026-09-13T00:00:00.000Z"));

  it("names a work order by its number", () => {
    const order = data.workOrders[0]!;
    expect(recordLabel(data, "workOrders", order.id)).toBe(order.number);
  });

  it("names an asset by its tag and a part by its stock number", () => {
    expect(recordLabel(data, "assets", data.assets[0]!.id)).toBe(
      data.assets[0]!.assetTag,
    );
    expect(recordLabel(data, "parts", data.parts[0]!.id)).toBe(
      data.parts[0]!.partNumber,
    );
  });

  it("names a status-history row by the order it belongs to", () => {
    // It appeared in the synchronisation log as `wkh-WO-2026-0041-1`, which is
    // an opaque identifier in front of a person. Found in a screenshot.
    const row = data.workOrderStatusHistory[0]!;
    const parent = data.workOrders.find((o) => o.id === row.workOrderId)!;

    expect(recordLabel(data, "workOrderStatusHistory", row.id)).toBe(
      parent.number,
    );
    expect(recordLabel(data, "workOrderStatusHistory", row.id)).not.toContain(
      "wkh-",
    );
  });

  it("falls back to the identifier rather than inventing a name", () => {
    // The deletion control, and the honest answer: a record this does not know
    // how to name is shown as it is stored, not as a guess.
    expect(recordLabel(data, "workOrders", "wko-does-not-exist")).toBe(
      "wko-does-not-exist",
    );
  });
});
