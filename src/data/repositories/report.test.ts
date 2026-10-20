import { describe, expect, it } from "vitest";
import { buildSeed, type DemoData } from "@/data/seed";
import { applyMutation, applyMutations, type Actor } from "@/stores/mutations";
import { createReportRepository } from "./report";
import type { RepositoryContext } from "./types";

/**
 * Taking data out leaves a mark, and changes nothing else.
 *
 * Both halves matter. A trail that forgot exports would let somebody walk away
 * with a file and leave no trace, which is the opposite of what an audit trail
 * is for. And a "write" that quietly altered a record while claiming to export
 * would be worse than either.
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
        `aud-${sequence}`,
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
        `aud-${sequence}`,
      );
    },
    now: () => NOW,
  };
  return {
    repository: createReportRepository(context),
    get data() {
      return data;
    },
  };
}

describe("recording an export", () => {
  it("writes one trail entry naming the report and the row count", () => {
    const test = harness();
    const before = test.data.auditEvents.length;

    test.repository.recordExport("inventory", 25, ACTOR);

    expect(test.data.auditEvents).toHaveLength(before + 1);
    const entry = test.data.auditEvents[0]!;
    expect(entry.summaryKey).toBe("audit.reportExported");
    expect(entry.summaryParams).toEqual({ report: "inventory", rows: 25 });

    // Attributed to a person, and narrowed rather than asserted through: an
    // `AuditEvent` is a union and a system event carries no user at all, so
    // reading the field without asking which kind it is does not compile.
    expect(entry.actorKind).toBe("person");
    if (entry.actorKind === "person") {
      expect(entry.actorUserId).toBe(ACTOR.userId);
    }
  });

  it("changes no record at all", () => {
    /*
     * The control beside it, and the reason this repository writes through
     * `commitMany` with an empty mutation list rather than inventing a record
     * to touch. Asserted per collection: a check on one collection would pass
     * while another moved.
     */
    const seed = buildSeed(NOW);
    const test = harness(seed);

    test.repository.recordExport("aging", 4, ACTOR);

    for (const key of Object.keys(seed) as (keyof DemoData)[]) {
      if (key === "auditEvents") continue;
      expect(test.data[key], `${key} moved during an export`).toEqual(
        seed[key],
      );
    }
  });
});
