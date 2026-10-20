import { describe, expect, it } from "vitest";
import { buildSeed, type DemoData } from "@/data/seed";
import {
  applyMutation,
  applyMutations,
  type Mutation,
} from "@/stores/mutations";
import { createPartRepository } from "./part";
import type { RepositoryContext } from "./types";
import type { Actor } from "@/stores/mutations";

/**
 * Adjusting stock during an inventory verification.
 *
 * Tested through the repository rather than through a screen, because the
 * repository is the only route a count has into the records — and because the
 * audit entry and the transaction are written by the same commit path that a
 * future import would use.
 */

const NOW = new Date("2026-09-12T14:05:00.000Z");
const ACTOR: Actor = { userId: "user-1", role: "technician" };

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
    repository: createPartRepository(context),
    applied,
    /**
     * How many times the repository committed — not how many records it wrote.
     *
     * `sequence` rises once per `commit` or `commitMany` call, and the store
     * gives each of those one place in the offline queue, so this is the queue
     * length the banner would show. `applied` cannot answer that question: it
     * is flattened, so two records written as one act and two written as two
     * acts both read as two.
     */
    get commits() {
      return sequence;
    },
    get data() {
      return data;
    },
  };
}

/**
 * Note the harness is kept whole rather than destructured. `data` is a getter
 * that reports the current snapshot; pulling it out with `const { data } = …`
 * reads it once, before the mutation, and every assertion after that quietly
 * examines the records as they were. Four tests here failed exactly that way.
 */
function anyPart(seed: DemoData) {
  const found = seed.parts[0];
  if (!found) throw new Error("The seed holds no parts");
  return found;
}

/**
 * The adjustment this act wrote, not the first that matches.
 *
 * The seed now holds shelf counts of its own — WA-12 seeds them so the ledger
 * has something to draw — so `find(kind === "adjustment")` returns a seeded
 * movement and the assertion silently measures the wrong record. The same trap
 * the WA-57 test names two describes further down. Taking the ids before the
 * act and filtering to what is new is the version that cannot drift.
 */
function adjustmentWrittenBy<
  T extends { id: string; kind: string; partId: string },
>(before: readonly { id: string }[], after: readonly T[], partId: string) {
  const had = new Set(before.map((one) => one.id));
  const written = after.filter(
    (one) => !had.has(one.id) && one.partId === partId,
  );
  return written.find((one) => one.kind === "adjustment");
}

describe("adjusting a part to a counted quantity", () => {
  it("writes the new count and a transaction for the difference", () => {
    const seed = buildSeed(NOW);
    const part = anyPart(seed);
    const context = harness(seed);

    const existing = context.data.inventoryTransactions;
    const counted = part.quantityOnHand + 3;
    const returned = context.repository.adjust(part.id, counted, ACTOR);

    expect(returned.quantityOnHand).toBe(counted);
    expect(context.repository.byId(part.id)?.quantityOnHand).toBe(counted);

    const movement = adjustmentWrittenBy(
      existing,
      context.data.inventoryTransactions,
      part.id,
    );
    expect(movement?.quantity).toBe(3);
    expect(movement?.workOrderId).toBeNull();
    expect(context.applied).toHaveLength(2);
  });

  it("records a shortfall as a negative movement", () => {
    const seed = buildSeed(NOW);
    const part = seed.parts.find((candidate) => candidate.quantityOnHand >= 2);
    if (!part) throw new Error("The seed holds no part with stock to lose");
    const context = harness(seed);

    const existing = context.data.inventoryTransactions;
    context.repository.adjust(part.id, part.quantityOnHand - 2, ACTOR);

    const movement = adjustmentWrittenBy(
      existing,
      context.data.inventoryTransactions,
      part.id,
    );
    expect(movement?.quantity).toBe(-2);
  });

  it("writes an audit entry naming both counts", () => {
    const seed = buildSeed(NOW);
    const part = anyPart(seed);
    const before = part.quantityOnHand;
    const context = harness(seed);

    context.repository.adjust(
      part.id,
      before + 1,
      ACTOR,
      "Counted on the shelf",
    );

    const entry = context.data.auditEvents.find(
      (event) => event.summaryKey === "audit.partAdjusted",
    );
    expect(entry).toBeDefined();
    expect(entry?.summaryParams).toMatchObject({
      partNumber: part.partNumber,
      from: before,
      to: before + 1,
    });
  });

  it("keeps the note the counter typed", () => {
    const seed = buildSeed(NOW);
    const part = anyPart(seed);
    const context = harness(seed);

    const existing = context.data.inventoryTransactions;
    context.repository.adjust(
      part.id,
      part.quantityOnHand + 1,
      ACTOR,
      "Two boxes hidden behind the door",
    );

    const movement = adjustmentWrittenBy(
      existing,
      context.data.inventoryTransactions,
      part.id,
    );
    expect(movement?.note).toBe("Two boxes hidden behind the door");
  });

  it("writes nothing when the count agrees with the record", () => {
    const seed = buildSeed(NOW);
    const part = anyPart(seed);
    const context = harness(seed);

    const existing = context.data.inventoryTransactions;
    const returned = context.repository.adjust(
      part.id,
      part.quantityOnHand,
      ACTOR,
    );

    expect(returned.quantityOnHand).toBe(part.quantityOnHand);
    expect(context.applied).toEqual([]);
    // No *new* movement. The seed holds shelf counts of its own now, so
    // "there are no adjustments anywhere" is no longer the claim — and it was
    // never the claim this test meant to make.
    expect(
      adjustmentWrittenBy(
        existing,
        context.data.inventoryTransactions,
        part.id,
      ),
    ).toBeUndefined();
  });

  it("would notice — the same call with a different count does write", () => {
    // The control. Without it, "writes nothing" would pass just as well if
    // `adjust` had stopped writing altogether.
    const seed = buildSeed(NOW);
    const part = anyPart(seed);
    const { repository, applied } = harness(seed);

    repository.adjust(part.id, part.quantityOnHand + 1, ACTOR);
    expect(applied).toHaveLength(2);
  });

  it("refuses a count that is not a whole number, or is below zero", () => {
    const seed = buildSeed(NOW);
    const part = anyPart(seed);
    const { repository, applied } = harness(seed);

    expect(() => repository.adjust(part.id, -1, ACTOR)).toThrow();
    expect(() => repository.adjust(part.id, 2.5, ACTOR)).toThrow();
    // A refusal leaves nothing behind: no stock change, no transaction.
    expect(applied).toEqual([]);
    expect(repository.byId(part.id)?.quantityOnHand).toBe(part.quantityOnHand);
  });

  it("refuses a part that is not there", () => {
    const { repository } = harness();
    expect(() => repository.adjust("part-nope", 4, ACTOR)).toThrow();
  });

  it("counting to zero is a real count, not a refusal", () => {
    const seed = buildSeed(NOW);
    const part = seed.parts.find((candidate) => candidate.quantityOnHand > 0);
    if (!part) throw new Error("The seed holds no part with stock");
    const { repository } = harness(seed);

    expect(repository.adjust(part.id, 0, ACTOR).quantityOnHand).toBe(0);
  });
});

/**
 * Taking stock out to a job.
 *
 * The count and the movement that explains it are one act. This block exists
 * because nothing held that: reverting `issue` to its old two-commit form left
 * the whole unit suite green, and `grep -rn '\.issue(' src tests` found no
 * caller anywhere. A path with a rule and no test is a path that keeps the rule
 * until the day somebody tidies it away.
 */
describe("issuing a part to a job", () => {
  function partWithStock(seed: DemoData, atLeast: number) {
    const found = seed.parts.find(
      (candidate) => candidate.quantityOnHand >= atLeast,
    );
    if (!found)
      throw new Error(`The seed holds no part with ${atLeast} on hand`);
    return found;
  }

  it("writes one entry and takes one place in the queue, not two of each", () => {
    const seed = buildSeed(NOW);
    const part = partWithStock(seed, 2);
    const order = seed.workOrders[0]!;
    const context = harness(seed);
    const before = context.data.auditEvents.length;
    const existing = new Set(
      context.data.inventoryTransactions.map((entry) => entry.id),
    );

    context.repository.issue(part.id, 2, order.id, ACTOR);

    // Both halves of the claim, because the trail and the queue are two
    // different counts and a fix to one would not show in the other.
    expect(context.data.auditEvents.length - before).toBe(1);
    expect(context.commits).toBe(1);

    // And the work still happened: the count moved and the movement explaining
    // it is there. A single entry written by a method that had stopped doing
    // half its job would satisfy the counts above on its own.
    expect(context.repository.byId(part.id)?.quantityOnHand).toBe(
      part.quantityOnHand - 2,
    );
    /*
     * The one this act wrote, not the first that matches. The seed already
     * holds issue movements against this part — the first version of this
     * assertion read one of those and failed against -4, which is a useful
     * reminder that "find the movement" and "find the movement I just made"
     * are different questions.
     */
    const written = context.data.inventoryTransactions.filter(
      (entry) => !existing.has(entry.id),
    );
    expect(written).toHaveLength(1);
    expect(written[0]?.partId).toBe(part.id);
    expect(written[0]?.kind).toBe("issue");
    expect(written[0]?.quantity).toBe(-2);
    expect(written[0]?.workOrderId).toBe(order.id);
  });

  it("would notice — two hand-outs are two entries and two places", () => {
    /*
     * The floor under the test above. One entry for one act is the same
     * number a repository that had stopped writing after the first record
     * would produce, and the same number a queue that dropped everything
     * after the first entry would produce. Two acts have to read as two.
     */
    const seed = buildSeed(NOW);
    /*
     * The **same** part twice, which is what this control always wanted.
     *
     * It used to issue two different parts, with a comment explaining that one
     * part twice inside a tick collided on its id and threw — the workaround
     * WA-57 existed to remove. The collision is gone, so the comment goes with
     * it and the control becomes the stronger version: two acts against one
     * record, where a repository that wrote only the first would be caught by
     * the quantity as well as by the count.
     */
    const part = partWithStock(seed, 3);
    const order = seed.workOrders[0]!;
    const context = harness(seed);
    const before = context.data.auditEvents.length;

    context.repository.issue(part.id, 1, order.id, ACTOR);
    context.repository.issue(part.id, 2, order.id, ACTOR);

    expect(context.data.auditEvents.length - before).toBe(2);
    expect(context.commits).toBe(2);
    expect(context.repository.byId(part.id)?.quantityOnHand).toBe(
      part.quantityOnHand - 3,
    );
  });

  it("two movements of one part in a single tick both land — WA-57", () => {
    /*
     * The regression. A movement's id was the clock and the part number, and
     * the store refuses an insert whose id is present, so the second of two in
     * one millisecond threw `already holds id` and the whole act failed.
     *
     * The clock here is frozen, so "the same millisecond" is the ordinary case
     * rather than a race to provoke — which is what makes this testable at all.
     *
     * Asserted on the **records**, and on the outcome a person would notice:
     * both movements happened and both are there. Not on the absence of a
     * throw — a repository that had stopped writing after the first would also
     * not throw — and not on the ids being different, which the collection
     * already guarantees: two records present means two distinct ids, so that
     * assertion would restate the mechanism rather than test the outcome.
     *
     * That entailment is a **coupling**, and it is worth naming where it is
     * leaned on. It holds because `applyMutation` refuses an insert whose id
     * is already present. If that guard ever became an upsert, "two records
     * present" would quietly stop meaning "the ids differed" — the second
     * write would replace the first and the count would read one, so this test
     * would go red rather than pass falsely. `ids.test.ts` covers the helper
     * directly, so the mechanism is not argued only from here.
     */
    const seed = buildSeed(NOW);
    const part = partWithStock(seed, 3);
    const order = seed.workOrders[0]!;
    const context = harness(seed);
    const existing = new Set(
      context.data.inventoryTransactions.map((entry) => entry.id),
    );

    context.repository.issue(part.id, 1, order.id, ACTOR);
    context.repository.issue(part.id, 2, order.id, ACTOR);

    const written = context.data.inventoryTransactions.filter(
      (entry) => !existing.has(entry.id),
    );
    expect(written).toHaveLength(2);
    // A numeric comparator: bare `sort()` orders lexicographically, so -1
    // sorts before -2 and the assertion fails for a reason that has nothing to
    // do with the records.
    expect(
      written.map((entry) => entry.quantity).sort((a, b) => a - b),
    ).toEqual([-2, -1]);
    expect(context.repository.byId(part.id)?.quantityOnHand).toBe(
      part.quantityOnHand - 3,
    );
  });

  it("two counts of one part in a single tick both land — WA-57", () => {
    // `adjust` carried the same id scheme as `issue`, so it had the same
    // defect. Counting a part, correcting the count, and counting again is an
    // ordinary thing to do in one breath during a verification.
    const seed = buildSeed(NOW);
    const part = partWithStock(seed, 2);
    const context = harness(seed);
    const existing = new Set(
      context.data.inventoryTransactions.map((entry) => entry.id),
    );

    context.repository.adjust(part.id, part.quantityOnHand + 5, ACTOR);
    context.repository.adjust(part.id, part.quantityOnHand + 9, ACTOR);

    const written = context.data.inventoryTransactions.filter(
      (entry) => !existing.has(entry.id),
    );
    expect(written).toHaveLength(2);
    expect(context.repository.byId(part.id)?.quantityOnHand).toBe(
      part.quantityOnHand + 9,
    );
  });

  it("refuses more than is on hand, and leaves nothing behind", () => {
    const seed = buildSeed(NOW);
    const part = partWithStock(seed, 1);
    const order = seed.workOrders[0]!;
    const context = harness(seed);

    expect(() =>
      context.repository.issue(
        part.id,
        part.quantityOnHand + 1,
        order.id,
        ACTOR,
      ),
    ).toThrow();

    expect(context.commits).toBe(0);
    expect(context.applied).toEqual([]);
    expect(context.repository.byId(part.id)?.quantityOnHand).toBe(
      part.quantityOnHand,
    );
  });
});

describe("telling somebody the shelf is running out", () => {
  function atOrAboveMinimum(seed: DemoData) {
    const found = seed.parts.find(
      (part) =>
        part.quantityOnHand >= part.reorderPoint && part.reorderPoint > 0,
    );
    if (!found)
      throw new Error("The seed holds no part at or above its minimum");
    return found;
  }

  function alreadyBelowMinimum(seed: DemoData) {
    const found = seed.parts.find(
      (part) => part.quantityOnHand < part.reorderPoint,
    );
    if (!found) throw new Error("The seed holds no part below its minimum");
    return found;
  }

  /**
   * The notices this act added, whatever the seed already held.
   *
   * Generic, so the records keep their type. Written with a
   * `readonly { id: string }[]` parameter it compiled and ran green under
   * Vitest — which does not typecheck — while every assertion on a returned
   * record was reaching for a property the narrowed type did not have.
   */
  function noticesAdded<T extends { id: string }>(
    before: readonly T[],
    after: readonly T[],
  ): T[] {
    const had = new Set(before.map((one) => one.id));
    return after.filter((one) => !had.has(one.id));
  }

  it("issuing the stock that takes a part under its minimum writes one notice", () => {
    const seed = buildSeed(NOW);
    const part = atOrAboveMinimum(seed);
    const order = seed.workOrders[0]!;
    const context = harness(seed);
    const before = context.data.notifications;

    // Exactly one past the line, so the crossing is the only thing under test.
    const toCross = part.quantityOnHand - part.reorderPoint + 1;
    context.repository.issue(part.id, toCross, order.id, ACTOR);

    const written = noticesAdded(before, context.data.notifications);
    expect(written).toHaveLength(1);
    const notice = written[0]!;
    expect(notice.kind).toBe("partBelowMinimum");
    expect(notice.messageKey).toBe("notifications.partBelowMinimum");
    // A key and its arguments, never a built sentence: this has to read in
    // French too.
    expect(notice.params).toEqual({
      partNumber: part.partNumber,
      onHand: part.reorderPoint - 1,
    });
    expect(notice.subject).toEqual({ entity: "part", id: part.id });
    expect(notice.readAt).toBeNull();
    /*
     * To the role, not to a person. A part below its minimum is not news for
     * whoever happened to take the last one — it is for whoever reorders.
     */
    expect(notice.forUserId).toBeNull();
    expect(notice.forRole).toBe("maintenanceCoordinator");

    // And the crossing really happened, so the assertions above are not about
    // a notice written for a part that is still fine.
    expect(context.repository.byId(part.id)!.quantityOnHand).toBeLessThan(
      part.reorderPoint,
    );
  });

  it("a second movement against an already-low part writes no second notice", () => {
    /*
     * The half of the rule that is easy to leave out, and the one a storekeeper
     * would notice: a notice on every movement while a part stays low turns the
     * notification centre into noise, and noise is where a real warning goes to
     * be missed. Once per **downward crossing**, not once per movement.
     *
     * The second movement is a shelf count rather than a second issue, and the
     * reason is worth recording. Written as two issues, this test fails with
     * `inventoryTransactions already holds id inv-live-…` — both movements are
     * in the same frozen millisecond and the id is built from the clock and the
     * part number. That is WA-57 exactly, and it is unmerged at this branch's
     * base, so the two-issues form of this test lands when this branch catches
     * up with it. A count crosses no such wire: its id carries a different
     * prefix. The rule under test is the same either way, and coming at it
     * through a *different* method is the stronger version — a guard written
     * inside `issue` alone would pass the two-issues form and fail this one.
     */
    const seed = buildSeed(NOW);
    const part = atOrAboveMinimum(seed);
    const order = seed.workOrders[0]!;
    const context = harness(seed);
    const before = context.data.notifications;

    context.repository.issue(
      part.id,
      part.quantityOnHand - part.reorderPoint + 1,
      order.id,
      ACTOR,
    );
    const afterFirst = noticesAdded(before, context.data.notifications).length;
    expect(afterFirst, "the first movement did not cross").toBe(1);

    // Still below the line, and a different number, so a movement is written.
    const remaining = context.repository.byId(part.id)!.quantityOnHand;
    expect(
      remaining,
      "no room for a second movement below the line",
    ).toBeGreaterThan(0);
    context.repository.adjust(part.id, remaining - 1, ACTOR);

    expect(noticesAdded(before, context.data.notifications)).toHaveLength(1);
    // The movement itself still happened — a repository that had stopped
    // writing would also write no second notice.
    expect(context.repository.byId(part.id)!.quantityOnHand).toBe(
      remaining - 1,
    );
  });

  it("a second issue against an already-low part writes no second notice", () => {
    /*
     * The form this test wanted from the start, and could not have until now.
     *
     * Written before WA-57 merged it failed with `inventoryTransactions
     * already holds id inv-live-…`: both issues land in the same frozen
     * millisecond and the movement id was built from the clock and the part
     * number. That is WA-57's defect, not this one's, and the id now asks the
     * collection instead — so two issues in one tick both land and the rule
     * under test is reachable directly.
     *
     * The cross-method version above stays rather than being replaced by this.
     * They fail differently on purpose: a guard written inside `issue` alone
     * passes this one and fails that one, and a guard that keyed on the method
     * rather than on the crossing would pass that one and fail this.
     */
    const seed = buildSeed(NOW);
    const part = atOrAboveMinimum(seed);
    const order = seed.workOrders[0]!;
    const context = harness(seed);
    const before = context.data.notifications;

    context.repository.issue(
      part.id,
      part.quantityOnHand - part.reorderPoint + 1,
      order.id,
      ACTOR,
    );
    expect(
      noticesAdded(before, context.data.notifications),
      "the first issue did not cross the minimum",
    ).toHaveLength(1);

    const remaining = context.repository.byId(part.id)!.quantityOnHand;
    expect(remaining, "no stock left for a second issue").toBeGreaterThan(0);
    context.repository.issue(part.id, 1, order.id, ACTOR);

    expect(noticesAdded(before, context.data.notifications)).toHaveLength(1);
    // Both movements really happened — a repository that had stopped writing
    // after the first would also write no second notice.
    expect(context.repository.byId(part.id)!.quantityOnHand).toBe(
      remaining - 1,
    );
    expect(
      context.data.inventoryTransactions.filter(
        (one) => one.partId === part.id && one.kind === "issue",
      ).length,
      "the second issue did not land",
    ).toBeGreaterThan(1);
  });

  it("a shelf count that takes a part under its minimum writes one notice", () => {
    const seed = buildSeed(NOW);
    const part = atOrAboveMinimum(seed);
    const context = harness(seed);
    const before = context.data.notifications;

    context.repository.adjust(part.id, part.reorderPoint - 1, ACTOR);

    const written = noticesAdded(before, context.data.notifications);
    expect(written).toHaveLength(1);
    expect(written[0]!.params).toEqual({
      partNumber: part.partNumber,
      onHand: part.reorderPoint - 1,
    });
  });

  it("three counts of one part in one tick all land — the notice id too", () => {
    /*
     * The regression this ticket shipped and review caught.
     *
     * The notice's id was `ntf-low-${partNumber}-${at}` — built from the clock,
     * which is WA-57's defect, written a hundred and twenty lines above two
     * `freeId` calls in the same file that get it right. Two crossings of one
     * part inside a millisecond produced the same id and `applyMutation`
     * refused the insert, so the whole third act failed.
     *
     * It is reachable by ordinary work, not by a contrived race: a count that
     * finds the shelf short, a delivery counted in, and a second count that
     * finds it short again. What the storekeeper saw was "count refused" —
     * untrue, and exactly the lie WA-57 singled `adjust` out for.
     *
     * Asserted on the records rather than on the absence of a throw, because a
     * repository that had stopped writing would also not throw.
     */
    const seed = buildSeed(NOW);
    const part = seed.parts.find(
      (candidate) =>
        candidate.quantityOnHand >= candidate.reorderPoint &&
        candidate.reorderPoint > 1,
    );
    if (!part)
      throw new Error("The seed holds no part at or above a minimum above one");
    const context = harness(seed);
    const before = context.data.notifications;

    context.repository.adjust(part.id, part.reorderPoint - 1, ACTOR);
    context.repository.adjust(part.id, part.reorderPoint + 2, ACTOR);
    context.repository.adjust(part.id, part.reorderPoint - 1, ACTOR);

    // Two downward crossings, so two notices, and the count ends where the
    // third act left it.
    expect(noticesAdded(before, context.data.notifications)).toHaveLength(2);
    expect(context.repository.byId(part.id)!.quantityOnHand).toBe(
      part.reorderPoint - 1,
    );
    // Distinct ids, which is the thing that failed.
    const ids = noticesAdded(before, context.data.notifications).map(
      (one) => one.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("a count that puts stock back over the line writes nothing", () => {
    // The other direction, and it is not symmetry for its own sake: a guard
    // written as "is it low now" rather than "did it just become low" would
    // write a notice here, on a part somebody has just restocked.
    const seed = buildSeed(NOW);
    const part = alreadyBelowMinimum(seed);
    const context = harness(seed);
    const before = context.data.notifications;

    context.repository.adjust(part.id, part.reorderPoint + 5, ACTOR);

    expect(noticesAdded(before, context.data.notifications)).toEqual([]);
    expect(context.repository.byId(part.id)!.quantityOnHand).toBe(
      part.reorderPoint + 5,
    );
  });

  it("a count that leaves a low part low writes nothing either", () => {
    const seed = buildSeed(NOW);
    const part = alreadyBelowMinimum(seed);
    const context = harness(seed);
    const before = context.data.notifications;
    expect(
      part.reorderPoint,
      "need room to move below the line",
    ).toBeGreaterThan(1);

    // A different number, so a movement is written; still under the minimum,
    // so it is not a crossing.
    const counted = part.quantityOnHand === 0 ? 1 : 0;
    context.repository.adjust(part.id, counted, ACTOR);

    expect(noticesAdded(before, context.data.notifications)).toEqual([]);
  });

  it("a shelf count is one entry and one place in the queue, notice included", () => {
    /*
     * `adjust` used to call `commit` twice, so counting a shelf wrote two lines
     * in the trail and took two places in the offline queue for one thing a
     * person did — and the second could in principle be queued without the
     * first. Adding the notice as a third would have made it three. It is one
     * `commitMany` now, the shape `issue` already had.
     */
    const seed = buildSeed(NOW);
    const part = atOrAboveMinimum(seed);
    const context = harness(seed);
    const before = context.data.auditEvents.length;

    context.repository.adjust(part.id, part.reorderPoint - 1, ACTOR);

    expect(context.data.auditEvents.length - before).toBe(1);
    expect(context.commits).toBe(1);
    // Three records in that one act: the count, the movement, the notice.
    expect(context.repository.byId(part.id)!.quantityOnHand).toBe(
      part.reorderPoint - 1,
    );
  });
});

describe("finding one part by its stock number", () => {
  it("finds the part a URL or a scan names", () => {
    const seed = buildSeed(NOW);
    const part = seed.parts[0]!;
    const context = harness(seed);

    expect(context.repository.byNumber(part.partNumber)?.id).toBe(part.id);
  });

  it("reads a number that was retyped in the wrong case, or with a space", () => {
    /*
     * A scanned code arrives as whatever was printed and a typed one as
     * whatever was typed. `workOrders.byNumber` has always folded both; this
     * one matched exactly, so `flt-2101` from a URL resolved to nothing and the
     * screen would have said, correctly and unhelpfully, that no such part
     * exists.
     */
    const seed = buildSeed(NOW);
    const part = seed.parts[0]!;
    const context = harness(seed);

    expect(context.repository.byNumber(part.partNumber.toLowerCase())?.id).toBe(
      part.id,
    );
    expect(context.repository.byNumber(`  ${part.partNumber}  `)?.id).toBe(
      part.id,
    );
  });

  it("answers unknown for a number this system does not hold", () => {
    // The control beside the two above: a lookup that returned the first part
    // whatever it was asked would pass both of them.
    const context = harness();

    expect(context.repository.byNumber("NOT-A-PART")).toBeUndefined();
    // And an empty string is not a match either, which is the shape that turns
    // a blank field into "here is a part".
    expect(context.repository.byNumber("   ")).toBeUndefined();
  });
});
