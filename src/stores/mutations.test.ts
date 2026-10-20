import { describe, expect, it } from "vitest";
import { buildSeed } from "@/data/seed";
import {
  applyMutation,
  applyMutations,
  fieldChanges,
  RecordNotFoundError,
  type Mutation,
  type MutationAudit,
} from "./mutations";

/**
 * Every change carries its audit entry, because they are written together.
 *
 * That is the point of having one commit function: a caller cannot write a
 * record and forget the trail, because it has no way to write a record on its
 * own.
 */

const seed = buildSeed(new Date("2026-09-12T00:00:00.000Z"));
const AT = "2026-09-12T14:05:00.000Z";
const ACTOR = { userId: "usr-raman", role: "maintenanceCoordinator" } as const;

function updateFirstOrder(changes: Record<string, unknown>): Mutation {
  return {
    operation: "update",
    collection: "workOrders",
    id: seed.workOrders[0]!.id,
    changes,
    actor: { ...ACTOR },
    audit: {
      entity: "workOrder",
      action: "statusChanged",
      summaryKey: "audit.statusChanged",
      summaryParams: { number: seed.workOrders[0]!.number, status: "assigned" },
    },
  };
}

describe("applying a mutation", () => {
  it("writes the change and the audit entry in one step", () => {
    const next = applyMutation(
      seed,
      updateFirstOrder({ status: "assigned" }),
      AT,
      "aud-1",
    );

    expect(next.workOrders[0]!.status).toBe("assigned");
    expect(next.auditEvents).toHaveLength(seed.auditEvents.length + 1);

    const event = next.auditEvents[0]!;
    expect(event.id).toBe("aud-1");
    expect(event.at).toBe(AT);
    expect(event.actorKind).toBe("person");
    expect(event.actorKind === "person" && event.actorUserId).toBe("usr-raman");
    expect(event.actorKind === "person" && event.actorRole).toBe(
      "maintenanceCoordinator",
    );
    expect(event.entityId).toBe(seed.workOrders[0]!.id);
    expect(event.summaryKey).toBe("audit.statusChanged");
  });

  it("leaves the records it was not asked about alone", () => {
    const next = applyMutation(
      seed,
      updateFirstOrder({ status: "assigned" }),
      AT,
      "aud-1",
    );

    // Compare the totals, not a sample: a mutation that quietly dropped rows
    // would still satisfy an assertion about the one row it changed.
    expect(next.workOrders).toHaveLength(seed.workOrders.length);
    expect(next.assets).toBe(seed.assets);
    expect(next.workOrders[1]).toBe(seed.workOrders[1]);
  });

  it("does not change the data it was given", () => {
    const before = seed.workOrders[0]!.status;
    applyMutation(seed, updateFirstOrder({ status: "assigned" }), AT, "aud-1");
    expect(seed.workOrders[0]!.status).toBe(before);
  });

  it("inserts and removes, counting both times", () => {
    const inserted = applyMutation(
      seed,
      {
        operation: "insert",
        collection: "workOrderTasks",
        id: "wkt-new",
        record: {
          organizationId: seed.organization.id,
          workOrderId: seed.workOrders[0]!.id,
          sequence: 9,
          description: { en: "Check", fr: "Vérifier" },
          done: false,
          completedAt: null,
          completedByUserId: null,
        },
        actor: { ...ACTOR },
        audit: {
          entity: "workOrder",
          action: "created",
          summaryKey: "audit.workOrderCreated",
          summaryParams: {},
        },
      },
      AT,
      "aud-1",
    );

    expect(inserted.workOrderTasks).toHaveLength(
      seed.workOrderTasks.length + 1,
    );

    const removed = applyMutation(
      inserted,
      {
        operation: "remove",
        collection: "workOrderTasks",
        id: "wkt-new",
        actor: { ...ACTOR },
        audit: {
          entity: "workOrder",
          action: "deleted",
          summaryKey: "audit.workOrderCreated",
          summaryParams: {},
        },
      },
      AT,
      "aud-2",
    );

    expect(removed.workOrderTasks).toHaveLength(seed.workOrderTasks.length);
    // Two changes, two entries. The trail does not lose the removal.
    expect(removed.auditEvents).toHaveLength(seed.auditEvents.length + 2);
  });

  it("refuses to update a record that is not there", () => {
    // A missing record is a failure, not an empty update that silently does
    // nothing and reports success.
    expect(() =>
      applyMutation(
        seed,
        {
          operation: "update",
          collection: "workOrders",
          id: "wko-does-not-exist",
          changes: { status: "assigned" },
          actor: { ...ACTOR },
          audit: {
            entity: "workOrder",
            action: "statusChanged",
            summaryKey: "audit.statusChanged",
            summaryParams: {},
          },
        },
        AT,
        "aud-1",
      ),
    ).toThrow(RecordNotFoundError);
  });

  it("refuses to insert over an id that already exists", () => {
    expect(() =>
      applyMutation(
        seed,
        {
          operation: "insert",
          collection: "workOrders",
          id: seed.workOrders[0]!.id,
          record: {},
          actor: { ...ACTOR },
          audit: {
            entity: "workOrder",
            action: "created",
            summaryKey: "audit.workOrderCreated",
            summaryParams: {},
          },
        },
        AT,
        "aud-1",
      ),
    ).toThrow(/already holds/);
  });
});

describe("the change list on an audit entry", () => {
  it("reports what actually changed, and nothing else", () => {
    expect(
      fieldChanges({ status: "open", priority: "low" }, { status: "assigned" }),
    ).toEqual([{ field: "status", from: "open", to: "assigned" }]);
  });

  it("says nothing when a value is written back unchanged", () => {
    expect(fieldChanges({ status: "open" }, { status: "open" })).toEqual([]);
  });
});

/**
 * `audit.importCommitted` is registered, translated in both catalogues, and
 * rendered by a case in `useAuditSummary` — the three places an audit key has
 * to live. The importer that writes it arrives with the wizard.
 */
const IMPORT_AUDIT: MutationAudit = {
  entity: "importBatch",
  action: "imported",
  summaryKey: "audit.importCommitted",
  summaryParams: { fileName: "mp2-export-sample.xlsx", records: 2 },
};

function insertPart(id: string): Mutation {
  const source = seed.parts[0]!;
  return {
    operation: "insert",
    collection: "parts",
    id,
    record: { ...source, id, partNumber: `IMP-${id}` },
    actor: { ...ACTOR },
    audit: {
      entity: "part",
      action: "created",
      summaryKey: "audit.partIssued",
      summaryParams: { partNumber: `IMP-${id}`, quantity: 0 },
    },
  };
}

describe("applying many changes as one act", () => {
  it("applies every change and writes a single audit entry", () => {
    const next = applyMutations(
      seed,
      [insertPart("prt-imp-1"), insertPart("prt-imp-2")],
      IMPORT_AUDIT,
      { ...ACTOR },
      "imp-0001",
      AT,
      "aud-live-000001",
    );

    expect(next.parts).toHaveLength(seed.parts.length + 2);
    // One entry, not one per row: an import is one act a person performed.
    expect(next.auditEvents).toHaveLength(seed.auditEvents.length + 1);
    expect(next.auditEvents[0]?.summaryKey).toBe("audit.importCommitted");
    expect(next.auditEvents[0]?.entityId).toBe("imp-0001");
  });

  it("leaves the records untouched when one change is refused", () => {
    // The one that matters. A file whose two hundredth row is refused must not
    // leave the first hundred and ninety-nine behind.
    const good = insertPart("prt-imp-1");
    const collides = insertPart(seed.parts[0]!.id);

    expect(() =>
      applyMutations(
        seed,
        [good, collides],
        IMPORT_AUDIT,
        { ...ACTOR },
        "imp-0002",
        AT,
        "aud-live-000001",
      ),
    ).toThrow();

    // The seed it was handed is the seed it still is: no part added, no entry
    // written, nothing half-done.
    expect(seed.parts.some((part) => part.id === "prt-imp-1")).toBe(false);
    expect(
      seed.auditEvents.some((event) => event.entityId === "imp-0002"),
    ).toBe(false);
  });

  it("would notice if the refusal stopped happening", () => {
    // The deletion control for the test above. If the collision check were
    // removed from the insert path, the throw would not happen and "leaves the
    // records untouched" would pass for the wrong reason — because nothing was
    // attempted rather than because nothing was kept. This proves the second
    // change really is refused, and that the first one really would have
    // applied on its own.
    expect(() =>
      applyMutations(
        seed,
        [insertPart(seed.parts[0]!.id)],
        IMPORT_AUDIT,
        { ...ACTOR },
        "imp-0003",
        AT,
        "aud-live-000001",
      ),
    ).toThrow();

    const alone = applyMutations(
      seed,
      [insertPart("prt-imp-9")],
      IMPORT_AUDIT,
      { ...ACTOR },
      "imp-0004",
      AT,
      "aud-live-000001",
    );
    expect(alone.parts).toHaveLength(seed.parts.length + 1);
  });

  it("does not change the data it was given", () => {
    const before = seed.parts.length;
    applyMutations(
      seed,
      [insertPart("prt-imp-3")],
      IMPORT_AUDIT,
      { ...ACTOR },
      "imp-0005",
      AT,
      "aud-live-000001",
    );
    expect(seed.parts).toHaveLength(before);
  });

  it("writes nothing at all for an empty list, beyond the entry itself", () => {
    const next = applyMutations(
      seed,
      [],
      IMPORT_AUDIT,
      { ...ACTOR },
      "imp-0006",
      AT,
      "aud-live-000001",
    );
    expect(next.parts).toHaveLength(seed.parts.length);
    expect(next.auditEvents).toHaveLength(seed.auditEvents.length + 1);
  });
});
