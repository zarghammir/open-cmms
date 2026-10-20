import { describe, expect, it } from "vitest";
import { buildSeed, type DemoData } from "@/data/seed";
import type { BuiltRecords } from "@/lib/import/build";
import {
  applyMutation,
  applyMutations,
  type Actor,
  type Mutation,
} from "@/stores/mutations";
import { createImportRepository } from "./import";
import type { RepositoryContext } from "./types";

/**
 * Committing an import, and undoing exactly it.
 *
 * "Exactly" is the whole claim. An undo that removes a little too much takes
 * away records somebody entered by hand; one that removes too little leaves
 * half an import behind and no way to tell which half.
 */

const NOW = new Date("2026-09-13T14:05:00.000Z");
const ACTOR: Actor = { userId: "usr-fortin", role: "administrator" };

function harness(seed: DemoData = buildSeed(NOW)) {
  let data = seed;
  let sequence = 0;
  const context: RepositoryContext = {
    get data() {
      return data;
    },
    commit(mutation, at) {
      sequence += 1;
      data = applyMutation(
        data,
        mutation,
        at ?? NOW.toISOString(),
        `aud-live-${sequence}`,
      );
    },
    commitMany(mutations, audit, actor, entityId, at) {
      sequence += 1;
      data = applyMutations(
        data,
        mutations,
        audit,
        actor,
        entityId,
        at ?? NOW.toISOString(),
        `aud-live-${sequence}`,
      );
    },
    now: () => NOW,
  };
  return {
    repository: createImportRepository(context),
    context,
    get data() {
      return data;
    },
  };
}

/**
 * A spreadsheet's worth of records. `mark` distinguishes one import's records
 * from another's, so a test can run two imports whose *only* collision would
 * be the batch id; it defaults to the single import every other test here
 * makes, which keeps those ids exactly what they always were.
 */
function builtFrom(seed: DemoData, mark = "1"): BuiltRecords {
  const asset = seed.assets[0]!;
  const part = seed.parts[0]!;
  const order = seed.workOrders[0]!;
  return {
    assets: [{ ...asset, id: `ast-imp-A${mark}`, assetTag: `IMP-A${mark}` }],
    parts: [{ ...part, id: `prt-imp-P${mark}`, partNumber: `IMP-P${mark}` }],
    workOrders: [
      {
        ...order,
        id: `wko-imp-W${mark}`,
        number: `IMP-W${mark}`,
        assetId: `ast-imp-A${mark}`,
        source: "import",
      },
    ],
    workOrderAssignments: [
      {
        id: `woa-imp-W${mark}`,
        organizationId: seed.organization.id,
        workOrderId: `wko-imp-W${mark}`,
        userId: null,
        crewCode: "NOBODY01",
        assignedAt: NOW.toISOString(),
        assignedByUserId: ACTOR.userId,
      },
    ],
  };
}

describe("committing an import", () => {
  it("writes every record and one trail entry for the act", () => {
    const seed = buildSeed(NOW);
    const test = harness(seed);
    const before = {
      assets: seed.assets.length,
      parts: seed.parts.length,
      orders: seed.workOrders.length,
      audit: seed.auditEvents.length,
    };

    const batch = test.repository.commitImport(
      builtFrom(seed),
      "mp2-export-sample.xlsx",
      ACTOR,
    );

    expect(test.data.assets).toHaveLength(before.assets + 1);
    expect(test.data.parts).toHaveLength(before.parts + 1);
    expect(test.data.workOrders).toHaveLength(before.orders + 1);
    expect(test.data.importBatches).toHaveLength(1);
    // Four records and a batch, but one entry: a person ran one import.
    expect(test.data.auditEvents).toHaveLength(before.audit + 1);
    expect(test.data.auditEvents[0]?.summaryKey).toBe("audit.importCommitted");
    expect(batch.rolledBackAt).toBeNull();
  });

  it("records what it created, per collection", () => {
    const seed = buildSeed(NOW);
    const test = harness(seed);
    const batch = test.repository.commitImport(
      builtFrom(seed),
      "f.xlsx",
      ACTOR,
    );

    expect(batch.created).toEqual([
      { collection: "assets", ids: ["ast-imp-A1"] },
      { collection: "parts", ids: ["prt-imp-P1"] },
      { collection: "workOrders", ids: ["wko-imp-W1"] },
      { collection: "workOrderAssignments", ids: ["woa-imp-W1"] },
    ]);
    expect(test.repository.sizeOf(batch)).toBe(4);
  });

  it("offers the batch as the one that can be undone", () => {
    const seed = buildSeed(NOW);
    const test = harness(seed);
    expect(test.repository.latestUndoable()).toBeUndefined();

    const batch = test.repository.commitImport(
      builtFrom(seed),
      "f.xlsx",
      ACTOR,
    );
    expect(test.repository.latestUndoable()?.id).toBe(batch.id);
  });

  it("commits two imports in one tick, each undoable on its own — WA-73", () => {
    /*
     * The batch id was `imp-${at}` and nothing else, so the second import
     * inside one millisecond built an id the first already had and was refused
     * with `already holds id`. The two imports here carry different records,
     * so the batch id is the only thing that could collide.
     *
     * The clock is frozen, which makes "the same millisecond" the ordinary
     * case rather than a race to provoke — and that is also the real
     * condition, not a contrivance: under the screenshot fixture's pinned
     * clock every import in a session shares one timestamp.
     *
     * Asserted on the records, not on the absence of a throw: a repository
     * that had quietly stopped writing would also not throw. The suffix is
     * never read, because `Id` is opaque by declaration — what is claimed is
     * that the ids differ and that each undo takes only its own records back.
     */
    const seed = buildSeed(NOW);
    const test = harness(seed);

    const morning = test.repository.commitImport(
      builtFrom(seed, "1"),
      "morning.xlsx",
      ACTOR,
    );
    const afternoon = test.repository.commitImport(
      builtFrom(seed, "2"),
      "afternoon.xlsx",
      ACTOR,
    );

    expect(morning.id).not.toBe(afternoon.id);
    expect(test.data.importBatches).toHaveLength(2);
    expect(test.data.assets).toHaveLength(seed.assets.length + 2);
    expect(test.data.assets.some((a) => a.id === "ast-imp-A1")).toBe(true);
    expect(test.data.assets.some((a) => a.id === "ast-imp-A2")).toBe(true);

    // Undoing the first leaves the second alone. That is the claim that
    // matters once two batches share a timestamp and only the id separates
    // them: an undo that went by `at` would take both.
    test.repository.rollback(morning.id, ACTOR);
    expect(test.data.assets.some((a) => a.id === "ast-imp-A1")).toBe(false);
    expect(test.data.assets.some((a) => a.id === "ast-imp-A2")).toBe(true);
    expect(test.data.workOrders.some((o) => o.id === "wko-imp-W2")).toBe(true);
    expect(test.repository.byId(afternoon.id)?.rolledBackAt).toBeNull();

    test.repository.rollback(afternoon.id, ACTOR);
    expect(test.data.assets.some((a) => a.id === "ast-imp-A2")).toBe(false);
    expect(test.data.assets).toHaveLength(seed.assets.length);
  });

  it("offers the later of two same-tick imports as the one to undo", () => {
    /*
     * Reachable only because of the fix above: before it, a second batch in
     * one tick did not exist to be mis-ordered. `list` sorted on `at` alone,
     * and equal timestamps leave insertion order, so the older import came
     * first and `latestUndoable` named it.
     *
     * It reaches a person through the wizard, which falls back to
     * `latestUndoable` whenever it no longer holds the batch it just wrote —
     * after a reload, which is exactly when somebody reaches for undo.
     */
    const seed = buildSeed(NOW);
    const test = harness(seed);
    test.repository.commitImport(builtFrom(seed, "1"), "morning.xlsx", ACTOR);
    const afternoon = test.repository.commitImport(
      builtFrom(seed, "2"),
      "afternoon.xlsx",
      ACTOR,
    );

    expect(test.repository.latestUndoable()?.id).toBe(afternoon.id);
    expect(test.repository.list()[0]?.id).toBe(afternoon.id);
  });
});

describe("undoing an import", () => {
  it("removes exactly the records it created, and nothing else", () => {
    const seed = buildSeed(NOW);
    const test = harness(seed);
    const batch = test.repository.commitImport(
      builtFrom(seed),
      "f.xlsx",
      ACTOR,
    );

    test.repository.rollback(batch.id, ACTOR);

    expect(test.data.assets).toHaveLength(seed.assets.length);
    expect(test.data.parts).toHaveLength(seed.parts.length);
    expect(test.data.workOrders).toHaveLength(seed.workOrders.length);
    expect(
      test.data.workOrderAssignments.some((row) => row.id === "woa-imp-W1"),
    ).toBe(false);
    // Everything that was there before is still there.
    expect(test.data.assets.map((a) => a.id).sort()).toEqual(
      seed.assets.map((a) => a.id).sort(),
    );
  });

  it("leaves a record that merely looks imported alone", () => {
    // The control that matters. An undo written the short way — deleting every
    // id that starts with `ast-imp-` — would pass every assertion above and
    // take this record with it. It is not in the batch, so it must survive.
    const seed = buildSeed(NOW);
    const test = harness(seed);
    const batch = test.repository.commitImport(
      builtFrom(seed),
      "f.xlsx",
      ACTOR,
    );

    const impostor: Mutation = {
      operation: "insert",
      collection: "assets",
      id: "ast-imp-TYPED-BY-HAND",
      record: { ...seed.assets[0]!, id: "x", assetTag: "TYPED-01" },
      actor: ACTOR,
      audit: {
        entity: "asset",
        action: "created",
        summaryKey: "audit.assetUpdated",
        summaryParams: { tag: "TYPED-01" },
      },
    };
    test.context.commit(impostor);

    test.repository.rollback(batch.id, ACTOR);

    expect(
      test.data.assets.some((a) => a.id === "ast-imp-TYPED-BY-HAND"),
      "a record outside the batch was removed: the undo is matching ids, not reading the batch",
    ).toBe(true);
  });

  it("keeps the batch, marked undone, rather than deleting it", () => {
    const seed = buildSeed(NOW);
    const test = harness(seed);
    const batch = test.repository.commitImport(
      builtFrom(seed),
      "f.xlsx",
      ACTOR,
    );

    test.repository.rollback(batch.id, ACTOR);

    // An import that was undone is part of what happened.
    expect(test.data.importBatches).toHaveLength(1);
    expect(test.repository.byId(batch.id)?.rolledBackAt).toBe(
      NOW.toISOString(),
    );
    expect(test.repository.latestUndoable()).toBeUndefined();
    expect(test.data.auditEvents[0]?.summaryKey).toBe("audit.importRolledBack");
  });

  it("refuses to undo the same import twice, or one that is not there", () => {
    const seed = buildSeed(NOW);
    const test = harness(seed);
    const batch = test.repository.commitImport(
      builtFrom(seed),
      "f.xlsx",
      ACTOR,
    );

    test.repository.rollback(batch.id, ACTOR);
    expect(() => test.repository.rollback(batch.id, ACTOR)).toThrow();
    expect(() => test.repository.rollback("imp-nope", ACTOR)).toThrow();
  });

  it("would notice if it had stopped removing anything", () => {
    // The control for "removes exactly": if rollback removed nothing at all,
    // the counts above would still match had the import written nothing. This
    // proves the import really did add records that the undo really did take.
    const seed = buildSeed(NOW);
    const test = harness(seed);
    test.repository.commitImport(builtFrom(seed), "f.xlsx", ACTOR);
    expect(test.data.assets).toHaveLength(seed.assets.length + 1);
  });
});
