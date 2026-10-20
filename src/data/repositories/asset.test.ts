import { describe, expect, it } from "vitest";
import { buildSeed, type DemoData } from "@/data/seed";
import {
  applyMutation,
  applyMutations,
  type Actor,
  type Mutation,
} from "@/stores/mutations";
import { createAssetRepository } from "./asset";
import type { RepositoryContext } from "./types";

/**
 * Changing an asset, through the repository rather than through a screen.
 *
 * The screen is not the only door. A hook can be careful and a future importer
 * or keyboard path can call `update` directly, so what is asserted here is that
 * the repository itself refuses to record a change that did not happen — not
 * that the one caller written today happens to check first.
 */

const NOW = new Date("2026-09-12T14:05:00.000Z");
const ACTOR: Actor = { userId: "user-1", role: "administrator" };

/**
 * Kept whole rather than destructured, as in `part.test.ts`: `data` is a getter
 * reporting the current snapshot, and pulling it out with `const { data } = …`
 * reads it once, before the mutation, so every assertion afterwards quietly
 * examines the records as they were.
 */
function harness(seed: DemoData = buildSeed(NOW)) {
  let data = seed;
  let sequence = 0;
  const applied: Mutation[] = [];

  const context: RepositoryContext = {
    get data() {
      return data;
    },
    commit(mutation, at) {
      sequence += 1;
      applied.push(mutation);
      data = applyMutation(
        data,
        mutation,
        at ?? NOW.toISOString(),
        `aud-live-${sequence}`,
      );
    },
    commitMany(mutations, audit, actor, entityId, at) {
      sequence += 1;
      applied.push(...mutations);
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
    repository: createAssetRepository(context),
    applied,
    get data() {
      return data;
    },
  };
}

function auditCount(data: DemoData, assetId: string): number {
  return data.auditEvents.filter(
    (event) => event.entity === "asset" && event.entityId === assetId,
  ).length;
}

describe("changing an asset", () => {
  it("writes one entry naming the field that changed", () => {
    const test = harness();
    const asset = test.data.assets[0]!;
    const before = auditCount(test.data, asset.id);
    const target = asset.criticality === "critical" ? "low" : "critical";

    test.repository.update(asset.id, { criticality: target }, ACTOR);

    expect(auditCount(test.data, asset.id)).toBe(before + 1);
    expect(
      test.data.assets.find((candidate) => candidate.id === asset.id)
        ?.criticality,
    ).toBe(target);

    const entry = test.data.auditEvents.find(
      (event) => event.entity === "asset" && event.entityId === asset.id,
    )!;
    expect(entry.changes).toEqual([
      { field: "criticality", from: asset.criticality, to: target },
    ]);
    expect(entry.actorKind).toBe("person");
    expect(entry.actorKind === "person" && entry.actorUserId).toBe(
      ACTOR.userId,
    );
  });

  it("writes nothing at all when the change agrees with the record", () => {
    // The finding this test exists for. The screen's guard is not the guard:
    // called directly with a value the asset already has, the repository was
    // recording that an asset had been updated and listing no changed field —
    // a trail entry for something that did not happen.
    const test = harness();
    const asset = test.data.assets[0]!;
    const before = auditCount(test.data, asset.id);

    const returned = test.repository.update(
      asset.id,
      { criticality: asset.criticality, model: asset.model },
      ACTOR,
    );

    expect(auditCount(test.data, asset.id)).toBe(before);
    expect(test.applied).toHaveLength(0);
    // It still answers with the asset, so a caller cannot tell the difference
    // between "nothing to do" and a failure by what comes back.
    expect(returned.id).toBe(asset.id);
  });

  it("writes once when only part of the input differs", () => {
    // The case between the two above, and the one a naive guard gets wrong:
    // some fields match, one does not, so there is a change and it is the only
    // one recorded.
    const test = harness();
    const asset = test.data.assets[0]!;
    const target = asset.status === "active" ? "inactive" : "active";

    test.repository.update(
      asset.id,
      { model: asset.model, status: target },
      ACTOR,
    );

    expect(test.applied).toHaveLength(1);
    const entry = test.data.auditEvents.find(
      (event) => event.entity === "asset" && event.entityId === asset.id,
    )!;
    expect(entry.changes.map((change) => change.field)).toEqual(["status"]);
  });

  it("counts what it claims to count", () => {
    // The deletion control. If `auditCount` ever stopped matching asset
    // entries, every assertion above would read zero and agree with itself.
    const test = harness();
    const asset = test.data.assets[0]!;

    expect(auditCount(test.data, asset.id)).toBe(0);
    test.repository.update(asset.id, { model: "changed-on-purpose" }, ACTOR);
    expect(auditCount(test.data, asset.id)).toBe(1);
    // And it is counting this asset, not every asset.
    expect(
      auditCount(test.data, test.data.assets[1]!.id),
      "the count is not filtering by asset",
    ).toBe(0);
  });

  it("refuses an asset it does not hold", () => {
    const test = harness();

    expect(() =>
      test.repository.update("ast-does-not-exist", { model: "x" }, ACTOR),
    ).toThrow();
  });
});
