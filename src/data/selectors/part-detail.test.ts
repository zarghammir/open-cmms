import { describe, expect, it } from "vitest";
import { buildSeed, type DemoData } from "@/data/seed";
import { partDetail } from "./part-detail";

const NOW = new Date("2026-09-12T14:05:00.000Z");

function seeded(): DemoData {
  return buildSeed(NOW);
}

function partWithMovements(data: DemoData) {
  const found = data.parts.find((part) =>
    data.inventoryTransactions.some((one) => one.partId === part.id),
  );
  if (!found) throw new Error("The seed holds no part with a movement");
  return found;
}

describe("one part and its ledger", () => {
  it("carries only this part's movements", () => {
    const data = seeded();
    const part = partWithMovements(data);

    const detail = partDetail(data, part);

    // A floor: every assertion about the ledger's contents is satisfied by an
    // empty ledger.
    expect(detail.ledger.length, "no movements to examine").toBeGreaterThan(0);
    expect(
      detail.ledger.every((row) => row.transaction.partId === part.id),
    ).toBe(true);
    // And it did not simply take every movement in the store.
    expect(detail.ledger.length).toBeLessThan(
      data.inventoryTransactions.length,
    );
  });

  it("puts the newest movement first", () => {
    const data = seeded();
    const part = partWithMovements(data);
    // Two movements on one part, planted through the records rather than
    // through a repository, because what is under test is the ordering and not
    // the writing.
    const first = data.inventoryTransactions.find(
      (one) => one.partId === part.id,
    )!;
    const older = { ...first, id: "inv-older", at: "2020-01-01T00:00:00.000Z" };
    const newer = { ...first, id: "inv-newer", at: "2030-01-01T00:00:00.000Z" };
    const withBoth: DemoData = {
      ...data,
      inventoryTransactions: [older, ...data.inventoryTransactions, newer],
    };

    const detail = partDetail(withBoth, part);

    expect(detail.ledger[0]!.transaction.id).toBe("inv-newer");
    expect(detail.ledger.at(-1)!.transaction.id).toBe("inv-older");
  });

  it("tells a movement with no work order apart from one it cannot read", () => {
    /*
     * The distinction this selector exists for.
     *
     * A shelf count belongs to no job, and that is the ordinary, correct state
     * for an adjustment — not a broken link. A movement naming an order this
     * system does not hold is a different thing entirely. Folded together, a
     * perfectly good count would be drawn as damaged.
     */
    const data = seeded();
    const part = partWithMovements(data);
    const template = data.inventoryTransactions.find(
      (one) => one.partId === part.id,
    )!;
    const order = data.workOrders[0]!;

    const withThree: DemoData = {
      ...data,
      inventoryTransactions: [
        { ...template, id: "inv-a", workOrderId: null },
        { ...template, id: "inv-b", workOrderId: order.id },
        { ...template, id: "inv-c", workOrderId: "wko-does-not-exist" },
      ],
    };

    const byId = new Map(
      partDetail(withThree, part).ledger.map((row) => [
        row.transaction.id,
        row.origin,
      ]),
    );

    expect(byId.get("inv-a")).toEqual({ kind: "none" });
    expect(byId.get("inv-b")).toEqual({ kind: "order", order });
    expect(byId.get("inv-c")).toEqual({
      kind: "unreadable",
      id: "wko-does-not-exist",
    });
  });

  it("says who moved it, and says so when the person is gone", () => {
    const data = seeded();
    const part = partWithMovements(data);
    const template = data.inventoryTransactions.find(
      (one) => one.partId === part.id,
    )!;
    const user = data.users[0]!;

    const withTwo: DemoData = {
      ...data,
      inventoryTransactions: [
        { ...template, id: "inv-known", byUserId: user.id },
        { ...template, id: "inv-gone", byUserId: "usr-does-not-exist" },
      ],
    };

    const byId = new Map(
      partDetail(withTwo, part).ledger.map((row) => [
        row.transaction.id,
        row.actor,
      ]),
    );

    expect(byId.get("inv-known")).toEqual(user);
    // Null, not a fabricated name and not an empty string pretending to be one.
    expect(byId.get("inv-gone")).toBeNull();
  });

  it("resolves the site and the bin, and answers null for one it cannot read", () => {
    const data = seeded();
    const part = partWithMovements(data);

    const found = partDetail(data, part);
    expect(found.facility?.id).toBe(part.facilityId);
    expect(found.bin?.id).toBe(part.inventoryLocationId);

    // The control beside the positive: without it, a selector that returned
    // null for everything would pass a test that only checked the unreadable
    // case, and one that never returned null would pass a test that only
    // checked the readable one.
    const orphaned = partDetail(data, {
      ...part,
      facilityId: "fac-does-not-exist",
      inventoryLocationId: "bin-does-not-exist",
    });
    expect(orphaned.facility).toBeNull();
    expect(orphaned.bin).toBeNull();
  });
});
