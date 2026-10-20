import { describe, expect, it } from "vitest";
import { buildSeed, type DemoData } from "@/data/seed";
import type {
  AuditEvent,
  Inspection,
  InventoryTransaction,
  WorkOrder,
} from "@/domain/types";
import { assetHistory } from "./asset-history";

const TODAY = new Date("2026-09-12T00:00:00.000Z");
const seed = buildSeed(TODAY);

/** An asset that actually has work against it, so the tests are not measuring an empty list. */
const busiestAssetId = [...seed.workOrders].reduce<string>((best, order) => {
  const count = (id: string) =>
    seed.workOrders.filter((candidate) => candidate.assetId === id).length;
  return count(order.assetId) > count(best) ? order.assetId : best;
}, seed.workOrders[0]!.assetId);

const otherAssetId = seed.assets.find(
  (asset) => asset.id !== busiestAssetId,
)!.id;

function order(overrides: Partial<WorkOrder>): WorkOrder {
  return { ...(seed.workOrders[0] as WorkOrder), ...overrides };
}

function movement(
  overrides: Partial<InventoryTransaction>,
): InventoryTransaction {
  return {
    ...(seed.inventoryTransactions[0] as InventoryTransaction),
    ...overrides,
  };
}

function inspection(overrides: Partial<Inspection>): Inspection {
  return { ...(seed.inspections[0] as Inspection), ...overrides };
}

function auditEvent(overrides: Partial<AuditEvent>): AuditEvent {
  return {
    id: "aud-test",
    organizationId: seed.organization.id,
    at: "2026-09-10T10:00:00.000Z",
    actorKind: "person",
    actorUserId: seed.users[0]!.id,
    actorRole: "administrator",
    entity: "asset",
    entityId: busiestAssetId,
    action: "updated",
    summaryKey: "audit.assetUpdated",
    summaryParams: { tag: "AHU-KGN-01" },
    changes: [],
    ...overrides,
  };
}

/** The seed with only the collections a test cares about replaced. */
function only(parts: Partial<DemoData>): DemoData {
  return {
    ...seed,
    workOrders: [],
    inspections: [],
    inventoryTransactions: [],
    auditEvents: [],
    ...parts,
  };
}

describe("an asset's history", () => {
  it("has something to show for a seeded asset", () => {
    // Without this every assertion below could be satisfied by an empty list.
    const entries = assetHistory(seed, busiestAssetId);

    expect(entries.length).toBeGreaterThan(1);
    expect(new Set(entries.map((entry) => entry.kind)).size).toBeGreaterThan(1);
  });

  it("reads newest first", () => {
    const entries = assetHistory(seed, busiestAssetId);
    const moments = entries.map((entry) => entry.at);

    expect([...moments].sort().reverse()).toEqual(moments);
  });

  it("does not swap two entries that happened at the same instant", () => {
    // Without a stable tie-break the order depends on which source was walked
    // first, and a screenshot taken twice disagrees with itself.
    // Fed in reverse, on purpose. Given in the order the assertion expects, the
    // list would come out right even with no tie-break at all and this would be
    // a test of nothing.
    const data = only({
      workOrders: [
        order({
          id: "b",
          assetId: busiestAssetId,
          requestedAt: "2026-09-01T09:00:00.000Z",
          startedAt: null,
          completedAt: null,
          cancelledAt: null,
        }),
        order({
          id: "a",
          assetId: busiestAssetId,
          requestedAt: "2026-09-01T09:00:00.000Z",
          startedAt: null,
          completedAt: null,
          cancelledAt: null,
        }),
      ],
    });

    expect(assetHistory(data, busiestAssetId).map((entry) => entry.id)).toEqual(
      assetHistory(data, busiestAssetId).map((entry) => entry.id),
    );
    expect(assetHistory(data, busiestAssetId).map((entry) => entry.id)).toEqual(
      ["wo-a", "wo-b"],
    );
  });

  it("shows a work order once, not once for every status it passed through", () => {
    const data = only({
      workOrders: [
        order({
          id: "one",
          assetId: busiestAssetId,
          requestedAt: "2026-08-01T09:00:00.000Z",
          startedAt: "2026-08-02T09:00:00.000Z",
          completedAt: "2026-08-03T09:00:00.000Z",
          cancelledAt: null,
          status: "completed",
        }),
      ],
    });

    const entries = assetHistory(data, busiestAssetId);
    expect(entries).toHaveLength(1);
    // Dated by the last thing that happened to it, not by when it was raised.
    expect(entries[0]?.at).toBe("2026-08-03T09:00:00.000Z");
  });

  it("dates an inspection that has not happened by the day it is due", () => {
    const data = only({
      inspections: [
        inspection({
          id: "scheduled",
          assetId: busiestAssetId,
          performedAt: null,
          scheduledFor: "2026-09-20",
        }),
      ],
      workOrders: [
        order({
          id: "earlier",
          assetId: busiestAssetId,
          requestedAt: "2026-09-19T23:00:00.000Z",
          startedAt: null,
          completedAt: null,
          cancelledAt: null,
        }),
      ],
    });

    // The scheduled day is widened to an instant, so it sorts by time rather
    // than by happening to be a shorter string than everything else.
    expect(assetHistory(data, busiestAssetId).map((entry) => entry.id)).toEqual(
      ["in-scheduled", "wo-earlier"],
    );
  });

  it("does not show a movement made against another asset's work order", () => {
    // The first way the derivation goes wrong, and it looks like a working
    // screen: the part is right, the work order is real, the asset is not this
    // one.
    const data = only({
      workOrders: [
        order({ id: "mine", assetId: busiestAssetId }),
        order({ id: "theirs", assetId: otherAssetId }),
      ],
      inventoryTransactions: [
        movement({ id: "here", workOrderId: "mine" }),
        movement({ id: "elsewhere", workOrderId: "theirs" }),
      ],
    });

    const ids = assetHistory(data, busiestAssetId).map((entry) => entry.id);
    expect(ids).toContain("mv-here");
    expect(ids).not.toContain("mv-elsewhere");
  });

  it("does not attribute a movement with no work order to this asset", () => {
    // The second way, and the quieter one: a stock count or a receipt belongs
    // to no asset at all. Letting it through would put it on whichever asset
    // someone happened to open.
    const data = only({
      workOrders: [order({ id: "mine", assetId: busiestAssetId })],
      inventoryTransactions: [
        movement({ id: "counted", workOrderId: null, kind: "adjustment" }),
      ],
    });

    const entries = assetHistory(data, busiestAssetId);
    // The work order is this asset's and belongs in the list; the movement is
    // not attributable to any asset and does not. Asserting both halves is what
    // stops this passing against a selector that simply returned nothing.
    expect(entries.map((entry) => entry.id)).toEqual(["wo-mine"]);
    expect(entries.some((entry) => entry.kind === "movement")).toBe(false);
  });

  it("keeps a movement whose part it cannot read, and says the part is unknown", () => {
    // Unreadable is not absent. Dropping the row would hide that stock moved.
    const data = only({
      workOrders: [order({ id: "mine", assetId: busiestAssetId })],
      inventoryTransactions: [
        movement({ id: "orphan", workOrderId: "mine", partId: "prt-gone" }),
      ],
    });

    const entry = assetHistory(data, busiestAssetId).find(
      (candidate) => candidate.kind === "movement",
    );
    expect(entry).toBeDefined();
    expect(entry?.kind === "movement" && entry.part).toBeNull();
  });

  it("takes only this asset's audit entries, and only the asset ones", () => {
    const data = only({
      auditEvents: [
        auditEvent({ id: "mine", entityId: busiestAssetId }),
        auditEvent({ id: "other-asset", entityId: otherAssetId }),
        auditEvent({
          id: "a-work-order",
          entity: "workOrder",
          entityId: busiestAssetId,
        }),
      ],
    });

    expect(assetHistory(data, busiestAssetId).map((entry) => entry.id)).toEqual(
      ["au-mine"],
    );
  });

  it("stops at the limit when given one", () => {
    const all = assetHistory(seed, busiestAssetId);
    const limited = assetHistory(seed, busiestAssetId, 2);
    expect(all.length).toBeGreaterThan(2);
    expect(limited).toHaveLength(2);

    /*
     * The limit takes the newest two, and that is checked against the other
     * entries rather than against another call to the same function. Comparing
     * `limited` with `all.slice(0, 2)` proves only that one function agrees
     * with itself: delete the sort and both sides move together and the test
     * stays green.
     */
    const kept = limited.map((entry) => entry.at);
    const dropped = all
      .filter((entry) => !limited.some((keep) => keep.id === entry.id))
      .map((entry) => entry.at);

    expect(dropped.length).toBeGreaterThan(0);
    for (const moment of dropped) {
      for (const keptMoment of kept) {
        expect(keptMoment >= moment).toBe(true);
      }
    }
  });

  it("is looking at an asset the seed gave movements to", () => {
    // The control for the two negative tests above: if no seeded movement ever
    // reaches an asset, both of them pass against a selector that returns
    // nothing, forever.
    const withMovements = seed.assets.filter((asset) =>
      assetHistory(seed, asset.id).some((entry) => entry.kind === "movement"),
    );

    expect(
      withMovements.length,
      "no asset in the seed has a stock movement, so the derivation is untested against real data",
    ).toBeGreaterThan(0);
  });
});
