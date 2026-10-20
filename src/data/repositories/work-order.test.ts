import { describe, expect, it } from "vitest";
import { buildSeed, type DemoData } from "@/data/seed";
import {
  applyMutation,
  applyMutations,
  type Mutation,
} from "@/stores/mutations";
import { createPartRepository } from "./part";
import { createWorkOrderRepository } from "./work-order";
import { TransitionRefusedError } from "@/domain/constants/work-order-status";
import type { RepositoryContext } from "./types";

/**
 * The status rules are tested through the repository, not through
 * `canTransition`.
 *
 * The map has its own test. What matters here is that the only route a screen
 * has into a work order actually consults it — a guard that is reachable is
 * not the same as a guard that is reached.
 */

const NOW = new Date("2026-09-12T14:05:00.000Z");

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
    repository: createWorkOrderRepository(context),
    applied,
    /**
     * The same context, so another repository can be built on it. The
     * one-act-one-entry claim spans three write paths and two repositories,
     * and a total that only counts this one's acts is not the claim.
     */
    context,
    get data() {
      return data;
    },
  };
}

function firstWith(seed: DemoData, status: string) {
  const found = seed.workOrders.find((order) => order.status === status);
  if (!found) throw new Error(`The seed holds no ${status} work order`);
  return found;
}

/**
 * An order nobody and no crew is holding, so a first assignment is a first one.
 *
 * `firstWith(seed, "open")` is not that. Three of the seed's open orders carry
 * a crew assignment with no person — `userId: null, crewCode: "CONT01"` — and
 * one of them sorts first, which is how the original version of the handover
 * test below was quietly exercising the contractor case while claiming to test
 * a first assignment.
 */
function unheld(seed: DemoData) {
  const held = new Set(
    seed.workOrderAssignments.map((assignment) => assignment.workOrderId),
  );
  const found = seed.workOrders.find(
    (order) => order.status === "open" && !held.has(order.id),
  );
  if (!found) throw new Error("The seed holds no open, unheld work order");
  return found;
}

/** An order a crew holds with no person on it, which is the defect's case. */
function heldByCrew(seed: DemoData) {
  const assignment = seed.workOrderAssignments.find(
    (candidate) => candidate.userId === null && candidate.crewCode !== null,
  );
  if (!assignment) throw new Error("The seed holds no crew-only assignment");
  const order = seed.workOrders.find(
    (candidate) => candidate.id === assignment.workOrderId,
  );
  if (!order) throw new Error("A crew assignment names no work order");
  return { order, crewCode: assignment.crewCode as string };
}

describe("moving a work order through the repository", () => {
  it("refuses a move the rules do not allow", () => {
    const seed = buildSeed(NOW);
    const { repository, applied } = harness(seed);
    const open = firstWith(seed, "open");

    expect(() =>
      repository.transition(open.id, "completed", {
        userId: "usr-raman",
        role: "maintenanceCoordinator",
      }),
    ).toThrow(TransitionRefusedError);

    // A refusal that still wrote something would be worse than no guard.
    expect(applied).toEqual([]);
  });

  it("refuses to cancel without a reason, and says which rule it is", () => {
    const seed = buildSeed(NOW);
    const { repository, applied } = harness(seed);
    const open = firstWith(seed, "open");

    try {
      repository.transition(open.id, "cancelled", {
        userId: "usr-raman",
        role: "maintenanceCoordinator",
      });
      expect.unreachable("cancelling without a reason should be refused");
    } catch (error) {
      expect(error).toBeInstanceOf(TransitionRefusedError);
      expect((error as TransitionRefusedError).reasonKey).toBe(
        "workOrderStatus.reasonRequired",
      );
    }

    expect(applied).toEqual([]);
  });

  it("cancels with a reason, and keeps the reason", () => {
    const seed = buildSeed(NOW);
    const test = harness(seed);
    const open = firstWith(seed, "open");

    test.repository.transition(
      open.id,
      "cancelled",
      { userId: "usr-raman", role: "maintenanceCoordinator" },
      { key: "notRecordedInSource", note: null },
    );

    const after = test.data.workOrders.find((order) => order.id === open.id);
    expect(after?.status).toBe("cancelled");
    expect(after?.cancellationReason?.key).toBe("notRecordedInSource");
    expect(after?.cancelledAt).toBe(NOW.toISOString());
  });

  it("records the move in the history and in the trail, with who and when", () => {
    const seed = buildSeed(NOW);
    const test = harness(seed);
    const assigned = firstWith(seed, "assigned");
    const historyBefore = test.repository.historyFor(assigned.id).length;
    const auditBefore = seed.auditEvents.length;

    test.repository.transition(assigned.id, "inProgress", {
      userId: "usr-mbeki",
      role: "technician",
    });

    const history = test.repository.historyFor(assigned.id);
    expect(history).toHaveLength(historyBefore + 1);
    expect(history.at(-1)?.from).toBe("assigned");
    expect(history.at(-1)?.to).toBe("inProgress");

    const events = test.data.auditEvents;
    expect(events.length).toBeGreaterThan(auditBefore);
    const first = events[0];
    expect(first?.actorKind).toBe("person");
    expect(first?.actorKind === "person" && first.actorUserId).toBe(
      "usr-mbeki",
    );
    expect(first?.actorKind === "person" && first.actorRole).toBe("technician");
    expect(events[0]?.at).toBe(NOW.toISOString());
  });

  it("stamps the moment work started, once", () => {
    const seed = buildSeed(NOW);
    const test = harness(seed);
    const assigned = firstWith(seed, "assigned");

    test.repository.transition(assigned.id, "inProgress", {
      userId: "usr-mbeki",
      role: "technician",
    });
    const startedAt = test.data.workOrders.find(
      (order) => order.id === assigned.id,
    )?.startedAt;
    expect(startedAt).toBe(NOW.toISOString());

    test.repository.transition(assigned.id, "waitingForParts", {
      userId: "usr-mbeki",
      role: "technician",
    });
    test.repository.transition(assigned.id, "inProgress", {
      userId: "usr-mbeki",
      role: "technician",
    });

    // Going back for parts and returning does not restart the clock.
    expect(
      test.data.workOrders.find((order) => order.id === assigned.id)?.startedAt,
    ).toBe(startedAt);
  });
});

describe("raising a work order", () => {
  it("takes the next free number and starts it open", () => {
    const seed = buildSeed(NOW);
    const test = harness(seed);
    const asset = seed.assets[0]!;

    const created = test.repository.create(
      {
        title: "Replace the belt",
        description: "Squealing on start",
        contentLanguage: "en",
        assetId: asset.id,
        type: "corrective",
        priority: "high",
        dueOn: "2026-09-20",
        estimatedMinutes: 90,
        assignedUserId: null,
      },
      { userId: "usr-raman", role: "maintenanceCoordinator" },
    );

    expect(created.number).toBe("WO-2026-0041");
    expect(created.status).toBe("open");
    // What was typed, in both slots, and a note of which language it is.
    // Nothing was translated and nothing is presented as though it had been.
    expect(created.title).toEqual({
      en: "Replace the belt",
      fr: "Replace the belt",
    });
    expect(created.contentLanguage).toBe("en");
    expect(created.facilityId).toBe(asset.facilityId);
    expect(test.data.workOrders).toHaveLength(seed.workOrders.length + 1);
    expect(test.repository.historyFor(created.id)).toHaveLength(1);
    expect(test.repository.historyFor(created.id)[0]?.from).toBeNull();
  });

  it("assigning an open order moves it to assigned", () => {
    const seed = buildSeed(NOW);
    const test = harness(seed);
    const open = firstWith(seed, "open");

    test.repository.assign(open.id, "usr-mbeki", {
      userId: "usr-raman",
      role: "maintenanceCoordinator",
    });

    expect(
      test.data.workOrders.find((order) => order.id === open.id)?.status,
    ).toBe("assigned");
    expect(test.repository.assignmentFor(open.id)?.userId).toBe("usr-mbeki");
  });

  /**
   * A handover is not an assignment, and the trail has to be able to tell.
   *
   * "WO-… assigned to Beaulieu" is true of both, and only one of them is the
   * whole truth: recorded that way, a reassignment loses the person who held
   * the work until that moment. Until WA-88 nothing rendered a control for
   * assigning, so nobody but the seed could reassign anything and the
   * distinction had never been reachable.
   *
   * Both entries are asserted, not only the second. Asserting the reassignment
   * alone would pass on an implementation that wrote "reassigned from" the
   * first time too, naming a person who never had it.
   */
  it("records a first assignment and a handover as different facts", () => {
    const seed = buildSeed(NOW);
    const test = harness(seed);
    // Unheld, deliberately. This test used `firstWith(seed, "open")` and was
    // therefore assigning over a crew — asserting "first assignment" on the
    // very case that turned out to be a handover.
    const open = unheld(seed);
    const actor = {
      userId: "usr-raman",
      role: "maintenanceCoordinator" as const,
    };

    test.repository.assign(open.id, "usr-mbeki", actor);
    const first = test.data.auditEvents[0];
    expect(first?.summaryKey).toBe("audit.workOrderAssigned");
    expect(first?.summaryParams).toMatchObject({ user: "Mbeki" });

    test.repository.assign(open.id, "usr-beaulieu", actor);
    const second = test.data.auditEvents[0];
    expect(second?.summaryKey).toBe("audit.workOrderReassigned");
    expect(second?.summaryParams).toMatchObject({
      from: "Mbeki",
      to: "Beaulieu",
    });

    expect(test.repository.assignmentFor(open.id)?.userId).toBe("usr-beaulieu");
  });

  /**
   * Handing it to the person already holding it is not a handover.
   *
   * It is the press of a button that changes nothing, and a trail that
   * reported "reassigned from Mbeki to Mbeki" would be recording a fact that
   * did not happen.
   */
  /**
   * The case the reviewer found, and the reason this ticket needed a second
   * pass.
   *
   * `WorkOrderAssignment.userId` is `Id | null`, and the seed gives three open
   * orders to crew CONT01 with no person on them — one each at three of the
   * five sites, near the top of the queue, which is where a demonstration
   * clicks first. Looking the
   * previous holder up among users and treating "not found" as "nobody" wrote
   * "assigned to Mbeki" and lost CONT01 without a word: an absent value
   * collapsed into the wrong state, on exactly the orders most likely to be
   * shown.
   */
  it("records a handover from a crew, naming the crew", () => {
    const seed = buildSeed(NOW);
    const test = harness(seed);
    const { order, crewCode } = heldByCrew(seed);

    test.repository.assign(order.id, "usr-mbeki", {
      userId: "usr-raman",
      role: "maintenanceCoordinator",
    });

    const entry = test.data.auditEvents[0];
    expect(entry?.summaryKey).toBe("audit.workOrderReassignedFromCrew");
    expect(entry?.summaryParams).toMatchObject({
      crew: crewCode,
      to: "Mbeki",
    });
  });

  /**
   * Somebody held it and this system cannot say who.
   *
   * A third answer rather than the fourth: reporting it as a first assignment
   * would be the trail asserting the work was unheld, which is the one thing
   * it must not claim falsely. Reached by pointing an assignment at a user id
   * the records do not hold, which is what a half-imported or hand-edited
   * store looks like.
   */
  it("records a handover from a holder it cannot read, without claiming nobody held it", () => {
    const seed = buildSeed(NOW);
    const test = harness(seed);
    const open = unheld(seed);

    const actor = {
      userId: "usr-raman",
      role: "maintenanceCoordinator" as const,
    };
    test.repository.assign(open.id, "usr-mbeki", actor);
    // Point the assignment at somebody the records do not hold.
    const assignment = test.data.workOrderAssignments.find(
      (candidate) => candidate.workOrderId === open.id,
    )!;
    assignment.userId = "usr-nobody";

    test.repository.assign(open.id, "usr-beaulieu", actor);

    const entry = test.data.auditEvents[0];
    expect(entry?.summaryKey).toBe("audit.workOrderReassignedFromUnreadable");
    expect(entry?.summaryParams).toMatchObject({ to: "Beaulieu" });
  });

  it("assigning to the same person again is not recorded as a handover", () => {
    const seed = buildSeed(NOW);
    const test = harness(seed);
    const open = unheld(seed);
    const actor = {
      userId: "usr-raman",
      role: "maintenanceCoordinator" as const,
    };

    test.repository.assign(open.id, "usr-mbeki", actor);
    test.repository.assign(open.id, "usr-mbeki", actor);

    expect(test.data.auditEvents[0]?.summaryKey).toBe(
      "audit.workOrderAssigned",
    );
  });
});

describe("reading work orders", () => {
  it("an unknown id is not found, and not an empty order", () => {
    const { repository } = harness();
    expect(repository.byId("wko-nope")).toBeUndefined();
  });

  it("filters without inventing matches", () => {
    const seed = buildSeed(NOW);
    const { repository } = harness(seed);

    const open = repository.list({ status: ["open"] });
    expect(open.length).toBe(
      seed.workOrders.filter((order) => order.status === "open").length,
    );
    expect(open.every((order) => order.status === "open")).toBe(true);
    expect(repository.list()).toHaveLength(seed.workOrders.length);
  });
});

describe("finding one order by its number", () => {
  it("finds the order a URL names", () => {
    const seed = buildSeed(NOW);
    const { repository } = harness(seed);
    const wanted = seed.workOrders[3]!;

    expect(repository.byNumber(wanted.number)?.id).toBe(wanted.id);
  });

  it("reads a number that was retyped in the wrong case, or with a space", () => {
    // An address is pasted, retyped and read off a phone screen. None of those
    // change which order somebody meant.
    const seed = buildSeed(NOW);
    const { repository } = harness(seed);
    const wanted = seed.workOrders[0]!;

    expect(repository.byNumber(wanted.number.toLowerCase())?.id).toBe(
      wanted.id,
    );
    expect(repository.byNumber(`  ${wanted.number}  `)?.id).toBe(wanted.id);
  });

  it("answers unknown for a number this system does not hold", () => {
    /*
     * The third state, and the reason the lookup lives here rather than in the
     * screen. A number that resolves to nothing is not the nearest order and
     * not an empty one — and a prefix of a real number is the case a lookup
     * written as `startsWith` would get wrong, so it is the one asserted.
     */
    const seed = buildSeed(NOW);
    const { repository } = harness(seed);
    const real = seed.workOrders[0]!.number;

    expect(repository.byNumber("WO-1999-0001")).toBeUndefined();
    expect(repository.byNumber(real.slice(0, real.length - 1))).toBeUndefined();
    expect(repository.byNumber("")).toBeUndefined();
    expect(repository.byNumber("   ")).toBeUndefined();

    // The control: the same harness does find a number it holds, so the four
    // answers above are the lookup refusing rather than the lookup being dead.
    expect(repository.byNumber(real)).toBeDefined();
  });
});

const ACTOR = {
  userId: "usr-mbeki",
  role: "maintenanceCoordinator",
} as const;

describe("one act is one entry in the trail", () => {
  /*
   * The count is the claim, so the count is what is asserted.
   *
   * Before this ticket, measured against the base commit rather than recalled:
   * moving an order wrote 2 entries (the order, its history row); assigning
   * wrote 1 and then moved an open order through `transition` for 2 more — 3
   * for one act; and issuing a part wrote 2. Seven entries for three things a
   * person did, and three after.
   *
   * The first version of this comment said 4 for the assignment and 8 for the
   * total, while describing the mechanism that adds up to 3. The arithmetic in
   * the sentence was the tell; the numbers here now come from running the base
   * code, on two different open orders, and both read 3.
   *
   * That is not only a wordy trail. Each `commit` is also one place in the
   * offline queue, so handing out a single job while disconnected put three
   * changes in the pending banner — the defect `create` was already fixed for,
   * still present in every other write path.
   */
  function auditsWritten(before: DemoData, after: DemoData): number {
    return after.auditEvents.length - before.auditEvents.length;
  }

  it("writes one entry for a status move, not one per record", () => {
    const seed = buildSeed(NOW);
    const context = harness(seed);
    const order = firstWith(seed, "assigned");
    const before = context.data;

    context.repository.transition(order.id, "inProgress", ACTOR);

    expect(auditsWritten(before, context.data)).toBe(1);
    // Both records still moved: the entry count went down, the work did not.
    expect(context.repository.byId(order.id)?.status).toBe("inProgress");
    expect(context.repository.historyFor(order.id)).toHaveLength(
      before.workOrderStatusHistory.filter(
        (entry) => entry.workOrderId === order.id,
      ).length + 1,
    );
  });

  it("writes one entry for an assignment that also moves the order", () => {
    // The four-record case: assignment, notification, order, history row. Four
    // records, one act — so one entry, which is what is asserted below.
    const seed = buildSeed(NOW);
    const context = harness(seed);
    const order = firstWith(seed, "open");
    const technician = seed.users.find((user) => user.role === "technician")!;
    const before = context.data;

    context.repository.assign(order.id, technician.id, ACTOR);

    expect(auditsWritten(before, context.data)).toBe(1);
    expect(context.repository.byId(order.id)?.status).toBe("assigned");
    expect(context.repository.assignmentFor(order.id)?.userId).toBe(
      technician.id,
    );
  });

  it("adds up to three entries for three acts, where it used to be seven", () => {
    /*
     * The whole claim in one place. A coordinator moves an order, hands out a
     * job and issues a part: three things, three lines in the trail.
     *
     * Asserted as a total rather than three separate ones, because the defect
     * was never in a single path — it was that every path wrote per record, and
     * a total is the shape that stays true when a fourth path is added.
     *
     * It now performs all three. It used to perform two and assert 2 under a
     * name that promised three, which is worse than a wrong number: a reader
     * checking whether the third path was covered would have found this test
     * and stopped looking. The part path had no test at all, in this file or
     * any other.
     */
    const seed = buildSeed(NOW);
    const context = harness(seed);
    const parts = createPartRepository(context.context);
    const before = context.data;

    const moving = firstWith(seed, "assigned");
    const opening = firstWith(seed, "open");
    const technician = seed.users.find((user) => user.role === "technician")!;
    const part = seed.parts.find((candidate) => candidate.quantityOnHand >= 1)!;

    context.repository.transition(moving.id, "inProgress", ACTOR);
    context.repository.assign(opening.id, technician.id, ACTOR);
    parts.issue(part.id, 1, moving.id, ACTOR);

    expect(auditsWritten(before, context.data)).toBe(3);
  });
});

describe("finishing an order", () => {
  it("a completion and a logged hour in one tick both land — WA-57", () => {
    /*
     * The collision a reader would not predict, because it is between two
     * **different** methods. `complete` writes a labour entry and `logLabour`
     * writes a labour entry, and both built the id from the clock and the order
     * number — so completing an order and logging time against it inside one
     * millisecond threw `already holds id` and the second act failed outright.
     *
     * WA-57 named the two sites in `part.ts`. This is why the fix went to all
     * six: a helper that is not used where the defect lives is not a fix.
     *
     * The clock is frozen, so "the same millisecond" is the ordinary case here
     * rather than a race to provoke. Asserted on the entries, not on the
     * absence of a throw — a repository that had stopped writing would also
     * not throw.
     */
    const seed = buildSeed(NOW);
    const context = harness(seed);
    const order = firstWith(seed, "inProgress");
    const before = new Set(context.data.labourEntries.map((entry) => entry.id));

    context.repository.logLabour(order.id, { minutes: 30 }, ACTOR);
    context.repository.complete(
      order.id,
      { minutes: 90, note: "Belt replaced.", contentLanguage: "en" },
      ACTOR,
    );

    const written = context.data.labourEntries.filter(
      (entry) => !before.has(entry.id),
    );
    expect(written).toHaveLength(2);
    expect(written.map((entry) => entry.minutes).sort((a, b) => a - b)).toEqual(
      [30, 90],
    );
  });

  it("records the status, the time and the note as one act", () => {
    const seed = buildSeed(NOW);
    const context = harness(seed);
    const order = firstWith(seed, "inProgress");
    const before = context.data;

    context.repository.complete(
      order.id,
      {
        minutes: 90,
        note: "Belt replaced, tension checked.",
        contentLanguage: "en",
      },
      ACTOR,
    );

    // Four records moved, one line in the trail.
    expect(context.data.auditEvents.length - before.auditEvents.length).toBe(1);
    expect(context.repository.byId(order.id)?.status).toBe("completed");
    expect(context.repository.labourFor(order.id).at(-1)?.minutes).toBe(90);
    expect(context.repository.commentsFor(order.id)[0]?.body).toBe(
      "Belt replaced, tension checked.",
    );
    expect(context.repository.historyFor(order.id).at(-1)?.to).toBe(
      "completed",
    );
  });

  it("refuses without a note, and writes nothing at all", () => {
    /*
     * "Completed" with nothing beside it is the record a maintenance system is
     * asked for six months later and cannot answer from. The second half of the
     * assertion is the one that matters: a refusal that had already written the
     * labour entry would leave time logged against work the records still call
     * unfinished.
     */
    const seed = buildSeed(NOW);
    const context = harness(seed);
    const order = firstWith(seed, "inProgress");
    const before = context.data;

    expect(() =>
      context.repository.complete(
        order.id,
        { minutes: 90, note: "   ", contentLanguage: "en" },
        ACTOR,
      ),
    ).toThrow();

    expect(context.data.auditEvents.length).toBe(before.auditEvents.length);
    expect(context.data.labourEntries.length).toBe(before.labourEntries.length);
    expect(context.repository.byId(order.id)?.status).toBe("inProgress");
  });

  it("refuses when the status rules refuse, and writes nothing at all", () => {
    // The guard is `planStatusChange`, reached through this path as well as
    // through `transition`. A completed order cannot be completed again, and
    // the labour entry must not be written on the way to finding that out.
    const seed = buildSeed(NOW);
    const context = harness(seed);
    const order = firstWith(seed, "completed");
    const before = context.data;

    expect(() =>
      context.repository.complete(
        order.id,
        { minutes: 30, note: "Again.", contentLanguage: "en" },
        ACTOR,
      ),
    ).toThrow(TransitionRefusedError);

    expect(context.data.labourEntries.length).toBe(before.labourEntries.length);
    expect(context.data.workOrderComments.length).toBe(
      before.workOrderComments.length,
    );
  });

  it("refuses minutes that are not a positive number", () => {
    const seed = buildSeed(NOW);
    const context = harness(seed);
    const order = firstWith(seed, "inProgress");

    for (const minutes of [0, -30, Number.NaN]) {
      expect(() =>
        context.repository.complete(
          order.id,
          { minutes, note: "Done.", contentLanguage: "en" },
          ACTOR,
        ),
      ).toThrow();
    }

    // The control: the same call with real minutes is accepted, so the four
    // refusals above are the guard and not a method that never works.
    expect(() =>
      context.repository.complete(
        order.id,
        { minutes: 45, note: "Done.", contentLanguage: "en" },
        ACTOR,
      ),
    ).not.toThrow();
  });
});

describe("ticking a task", () => {
  it("records who finished it and when", () => {
    const seed = buildSeed(NOW);
    const context = harness(seed);
    const task = seed.workOrderTasks.find((candidate) => !candidate.done)!;

    const ticked = context.repository.tickTask(task.id, true, ACTOR);

    expect(ticked.done).toBe(true);
    expect(ticked.completedAt).toBe(NOW.toISOString());
    expect(ticked.completedByUserId).toBe(ACTOR.userId);
  });

  it("clears both when it is unticked", () => {
    /*
     * A technician working one-handed in a plant room mis-taps. A checklist
     * that only goes one way turns that into a record of work nobody did, which
     * is worse than no checklist — and leaving a name and a time behind on an
     * unticked task would say somebody finished work the record now calls
     * unfinished.
     */
    const seed = buildSeed(NOW);
    const context = harness(seed);
    const task = seed.workOrderTasks.find((candidate) => candidate.done)!;

    const unticked = context.repository.tickTask(task.id, false, ACTOR);

    expect(unticked.done).toBe(false);
    expect(unticked.completedAt).toBeNull();
    expect(unticked.completedByUserId).toBeNull();
  });
});

describe("logging time", () => {
  it("refuses anything that is not a positive number of minutes", () => {
    // Zero is the one that matters: `loggedMinutes` returns null for an order
    // with no entries, and a zero-minute entry would make it return 0 — the one
    // thing that selector exists never to say.
    const seed = buildSeed(NOW);
    const context = harness(seed);
    const order = firstWith(seed, "inProgress");

    for (const minutes of [0, -5, Number.NaN]) {
      expect(() =>
        context.repository.logLabour(order.id, { minutes }, ACTOR),
      ).toThrow();
    }

    expect(
      context.repository.logLabour(order.id, { minutes: 20 }, ACTOR).minutes,
    ).toBe(20);
  });

  it("keeps when the work happened apart from when it was written down", () => {
    // A technician logs Friday's job on Monday morning.
    const seed = buildSeed(NOW);
    const context = harness(seed);
    const order = firstWith(seed, "inProgress");

    const entry = context.repository.logLabour(
      order.id,
      { minutes: 45, workedAt: "2026-09-11T09:00:00.000Z" },
      ACTOR,
    );

    expect(entry.workedAt).toBe("2026-09-11T09:00:00.000Z");
    expect(entry.workedAt).not.toBe(NOW.toISOString());
  });
});

describe("telling the person who now holds the work", () => {
  it("writes the notice in the same act as the assignment", () => {
    /*
     * In the same commit, so a technician cannot end up holding work nobody
     * told them about because a second write failed. WA-18 inherits this shape:
     * a notification is written by whatever act caused it.
     */
    const seed = buildSeed(NOW);
    const context = harness(seed);
    const order = firstWith(seed, "open");
    const technician = seed.users.find((user) => user.role === "technician")!;
    const before = context.data;

    context.repository.assign(order.id, technician.id, ACTOR);

    const written = context.data.notifications.filter(
      (notification) =>
        !before.notifications.some((old) => old.id === notification.id),
    );
    expect(written).toHaveLength(1);
    expect(context.data.auditEvents.length - before.auditEvents.length).toBe(1);

    const notice = written[0]!;
    // Addressed to the person, not to everyone holding their job title.
    expect(notice.forUserId).toBe(technician.id);
    expect(notice.forRole).toBeNull();
    expect(notice.subject).toEqual({ entity: "workOrder", id: order.id });
    expect(notice.readAt).toBeNull();
    // A key and its arguments, never a built sentence: the same notice has to
    // read in French.
    expect(notice.messageKey).toBe("notifications.workOrderAssigned");
    expect(notice.params).toEqual({ number: order.number });
  });

  it("two assignments of one order in a single tick both land — WA-57", () => {
    /*
     * The sixth site, and the one the other five did not imply.
     *
     * `assign` updates the existing assignment but **inserts a fresh
     * notification every time**, so reassigning one order twice inside a tick
     * collided on `ntf-asg-${at}-${number}` and the second assignment failed
     * outright — a double-click on a reassign, told to the coordinator as a
     * refusal of something they had every right to do.
     *
     * Review wrote this rather than asserting the gap existed, which is the
     * right way round: the reds from the other four name `inv-live`,
     * `inv-count` and the two `lab-live` paths, so this site was fixed and
     * untested until now.
     */
    const h = harness();
    const order = h.data.workOrders.find((o) => o.status === "open")!;
    const users = h.data.users.slice(0, 2);
    expect(users.length, "need two users to reassign between").toBe(2);

    const before = h.data.notifications.length;
    h.repository.assign(order.id, users[0]!.id, ACTOR);
    h.repository.assign(order.id, users[1]!.id, ACTOR);

    const ids = h.data.notifications.map((n) => n.id);
    expect(new Set(ids).size, "notification ids are not unique").toBe(
      ids.length,
    );
    expect(
      h.data.notifications.length - before,
      "both assignment notices should land",
    ).toBe(2);
  });
});

describe("the trail says what happened, not just that something did", () => {
  /*
   * These assert the key the repository *writes*, which nothing else does.
   *
   * `audit-keys.test.ts` checks that every key written is registered — it stays
   * green if a key stops being written at all. The hook's test phrases every
   * registered key from a synthetic entry — it never asks which key a given act
   * produces. So between them, dropping `workOrderCancelled` and letting
   * cancelling fall back to `statusChanged` was invisible: both suites passed
   * while the reason a job was called off stopped being recorded.
   *
   * Found by running that mutation as a deletion control and watching nothing
   * go red.
   */
  function newestEntry(data: DemoData) {
    return data.auditEvents[0];
  }

  it("records why an order was cancelled, not merely that it was", () => {
    const seed = buildSeed(NOW);
    const context = harness(seed);
    const order = firstWith(seed, "open");

    context.repository.transition(order.id, "cancelled", ACTOR, {
      key: "noLongerRequired",
      note: null,
    });

    const entry = newestEntry(context.data);
    expect(entry?.summaryKey).toBe("audit.workOrderCancelled");
    expect(entry?.summaryParams.reason).toBe("noLongerRequired");
    // The generic key would have lost the reason, which is the half a reader
    // needs six months later.
    expect(entry?.summaryKey).not.toBe("audit.statusChanged");
  });

  it("records how long a completed order took", () => {
    const seed = buildSeed(NOW);
    const context = harness(seed);
    const order = firstWith(seed, "inProgress");

    context.repository.complete(
      order.id,
      { minutes: 75, note: "Done.", contentLanguage: "en" },
      ACTOR,
    );

    const entry = newestEntry(context.data);
    expect(entry?.summaryKey).toBe("audit.workOrderCompleted");
    expect(entry?.summaryParams.minutes).toBe(75);
    expect(entry?.summaryKey).not.toBe("audit.statusChanged");
  });

  it("still uses the generic key for a move that is only a move", () => {
    // The control on the two above: if every transition had been given a
    // special key, they would pass while `statusChanged` had quietly died.
    const seed = buildSeed(NOW);
    const context = harness(seed);
    const order = firstWith(seed, "assigned");

    context.repository.transition(order.id, "inProgress", ACTOR);

    expect(newestEntry(context.data)?.summaryKey).toBe("audit.statusChanged");
  });

  it("names the task that was ticked, and says which way", () => {
    const seed = buildSeed(NOW);
    const context = harness(seed);
    const undone = seed.workOrderTasks.find((task) => !task.done)!;
    const done = seed.workOrderTasks.find((task) => task.done)!;

    context.repository.tickTask(undone.id, true, ACTOR);
    expect(newestEntry(context.data)?.summaryKey).toBe("audit.taskTicked");

    context.repository.tickTask(done.id, false, ACTOR);
    expect(newestEntry(context.data)?.summaryKey).toBe("audit.taskUnticked");
  });
});
