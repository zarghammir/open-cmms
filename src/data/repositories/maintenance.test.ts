import { describe, expect, it } from "vitest";
import { buildSeed, type DemoData } from "@/data/seed";
import {
  applyMutation,
  applyMutations,
  type Actor,
  type Mutation,
} from "@/stores/mutations";
import {
  FREQUENCY_DAYS,
  nextDueAfter,
  raisableFrom,
} from "@/domain/constants/maintenance";
import { createWorkOrderRepository } from "./work-order";
import { nextWorkOrderNumber } from "./raise-order";
import {
  createMaintenanceRepository,
  GenerationRefusedError,
} from "./maintenance";
import type { RepositoryContext } from "./types";

/**
 * Raising work from a maintenance plan.
 *
 * Tested through the repository, because that is the only route the calendar
 * and the plan page will have into the records, and because the order, its
 * checklist, the schedule's stamp and the notice are written by one commit
 * path that a screen cannot reach around.
 */

const NOW = new Date("2026-09-12T14:05:00.000Z");
const TODAY = "2026-09-12";
const ACTOR: Actor = { userId: "usr-mbeki", role: "maintenanceCoordinator" };

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
    repository: createMaintenanceRepository(context),
    workOrders: createWorkOrderRepository(context),
    applied,
    get commits() {
      return sequence;
    },
    get data() {
      return data;
    },
  };
}

describe("which visits an order may be raised for", () => {
  it("offers the ones inside their lead time and no others", () => {
    const context = harness();
    const due = context.repository.due(TODAY);

    // A floor: every assertion below is satisfied by an empty list.
    expect(due.length, "the seed has no schedule due today").toBeGreaterThan(0);
    expect(
      due.length,
      "every schedule is due, so the filter proves nothing",
    ).toBeLessThan(context.data.maintenanceSchedules.length);

    for (const schedule of due) {
      const plan = context.repository.planById(schedule.planId)!;
      expect(
        raisableFrom(schedule.nextDueOn, plan.leadTimeDays) <= TODAY,
        `${schedule.id} is not yet inside its lead time`,
      ).toBe(true);
    }
  });

  it("counts a visit due tomorrow as not due when there is no lead time", () => {
    /*
     * The boundary, planted rather than hunted for. `raisableFrom` is the whole
     * rule, and a plan with no lead time is raised on the day — so the day
     * before must not offer it, and the day itself must.
     */
    const seed = buildSeed(NOW);
    const plan = seed.maintenancePlans[0]!;
    const schedule = seed.maintenanceSchedules.find(
      (one) => one.planId === plan.id,
    )!;
    const planted: DemoData = {
      ...seed,
      maintenancePlans: seed.maintenancePlans.map((one) =>
        one.id === plan.id ? { ...one, leadTimeDays: 0 } : one,
      ),
      maintenanceSchedules: seed.maintenanceSchedules.map((one) =>
        one.id === schedule.id
          ? { ...one, nextDueOn: "2026-09-13", workOrderId: null }
          : one,
      ),
    };
    const context = harness(planted);

    const ids = (day: string) =>
      context.repository.due(day).map((one) => one.id);

    expect(ids("2026-09-12")).not.toContain(schedule.id);
    expect(ids("2026-09-13")).toContain(schedule.id);
  });

  it("does not offer a visit that already has an open order", () => {
    const context = harness();
    const schedule = context.repository.due(TODAY)[0]!;

    context.repository.generate(schedule.id, ACTOR);

    expect(context.repository.due(TODAY).map((one) => one.id)).not.toContain(
      schedule.id,
    );
  });
});

describe("raising the order for one visit", () => {
  it("writes the order, its checklist, the stamp and the notice as one act", () => {
    const context = harness();
    const schedule = context.repository.due(TODAY)[0]!;
    const plan = context.repository.planById(schedule.planId)!;
    const beforeAudit = context.data.auditEvents.length;
    const beforeCommits = context.commits;

    const order = context.repository.generate(schedule.id, ACTOR);

    // One act: one entry in the trail, one place in the offline queue.
    expect(context.data.auditEvents.length - beforeAudit).toBe(1);
    expect(context.commits - beforeCommits).toBe(1);

    // The order carries where it came from, which nothing wrote before.
    expect(order.source).toBe("plan");
    expect(order.maintenancePlanId).toBe(plan.id);
    expect(order.type).toBe("preventive");
    expect(order.dueAt).toBe(schedule.nextDueOn);
    expect(order.estimatedMinutes).toBe(plan.estimatedMinutes);

    /*
     * Both languages, and `contentLanguage` null.
     *
     * The words come from a plan authored in English and French, so neither is
     * a translation of the other. A generated order stamped `"en"` would have
     * the detail screen tell a French reader "as written in English" about
     * text that was written in French too.
     */
    expect(order.title).toEqual(plan.name);
    expect(order.description).toEqual(plan.description);
    expect(order.contentLanguage).toBeNull();

    // The checklist the technician will tick, in the plan's order.
    const tasks = context.data.workOrderTasks.filter(
      (task) => task.workOrderId === order.id,
    );
    expect(tasks).toHaveLength(plan.tasks.length);
    expect(tasks.map((task) => task.description)).toEqual([...plan.tasks]);
    expect(tasks.every((task) => !task.done)).toBe(true);

    // The schedule now points at the order, so nothing raises it twice.
    const stamped = context.data.maintenanceSchedules.find(
      (one) => one.id === schedule.id,
    )!;
    expect(stamped.workOrderId).toBe(order.id);

    // And somebody is told.
    const notice = context.data.notifications.find(
      (one) => one.kind === "maintenanceDue" && one.subject.id === order.id,
    );
    expect(notice).toBeDefined();
    expect(notice!.params).toEqual({
      number: order.number,
      asset: context.data.assets.find((a) => a.id === schedule.assetId)!
        .assetTag,
    });
    expect(notice!.forRole).toBe("maintenanceCoordinator");
    expect(notice!.forUserId).toBeNull();
  });

  it("refuses a visit whose order is still open, and names the order", () => {
    const context = harness();
    const schedule = context.repository.due(TODAY)[0]!;
    const first = context.repository.generate(schedule.id, ACTOR);
    const commits = context.commits;

    let refusal: GenerationRefusedError | null = null;
    try {
      context.repository.generate(schedule.id, ACTOR);
    } catch (error) {
      refusal = error as GenerationRefusedError;
    }

    expect(refusal).toBeInstanceOf(GenerationRefusedError);
    expect(refusal!.refusal).toEqual({
      kind: "alreadyRaised",
      scheduleId: schedule.id,
      number: first.number,
    });
    // And it wrote nothing at all, rather than half an act.
    expect(context.commits).toBe(commits);
  });
});

describe("running every due visit at once", () => {
  it("raises one order per due visit, each its own act", () => {
    const context = harness();
    const due = context.repository.due(TODAY);
    expect(
      due.length,
      "nothing due, so the sweep proves nothing",
    ).toBeGreaterThan(1);
    const beforeAudit = context.data.auditEvents.length;

    const result = context.repository.runDue(TODAY, ACTOR);

    expect(result.generated).toHaveLength(due.length);
    expect(result.refused).toEqual([]);
    // One trail entry and one queue place each, not one for the sweep.
    expect(context.data.auditEvents.length - beforeAudit).toBe(due.length);
    expect(context.commits).toBe(due.length);
  });

  it("gives every generated order a different number", () => {
    /*
     * **The control for a batched implementation.**
     *
     * `nextWorkOrderNumber` reads the orders that exist, so orders numbered
     * inside one commit all read the same highest and all take the same number.
     * A sweep written as a single `commitMany` passes every other assertion in
     * this file — the right count of orders, the right stamps, the right
     * notices — and fails only here.
     *
     * The second half of the test proves that is a real hazard rather than a
     * hypothetical one: numbering the same list without committing between
     * really does hand out one number over and over.
     */
    const context = harness();
    const result = context.repository.runDue(TODAY, ACTOR);
    expect(result.generated.length).toBeGreaterThan(1);

    const numbers = result.generated.map((order) => order.number);
    expect(new Set(numbers).size).toBe(numbers.length);

    const batched = result.generated.map(() =>
      nextWorkOrderNumber(context.data.workOrders, 2026),
    );
    expect(
      new Set(batched).size,
      "numbering without committing between should collide, or this control proves nothing",
    ).toBe(1);
  });

  it("writes one notice per visit, and none on a second run", () => {
    /*
     * Once per crossing, not once per sweep. A planner who presses the button
     * twice must not fill the notification centre with the same news, and the
     * schedule's own stamp is what makes the second run find nothing to do.
     */
    const context = harness();
    const before = context.data.notifications.length;

    const first = context.repository.runDue(TODAY, ACTOR);
    const after = context.data.notifications.length - before;
    expect(after).toBe(first.generated.length);

    const second = context.repository.runDue(TODAY, ACTOR);

    expect(second.generated).toEqual([]);
    expect(context.data.notifications.length - before).toBe(after);
  });

  it("names a broken reference instead of skipping it", () => {
    // A schedule whose asset this system cannot read is not "nothing to do":
    // somebody has to look at it, so the sweep says which one.
    const seed = buildSeed(NOW);
    const context = harness(seed);
    const schedule = context.repository.due(TODAY)[0]!;
    const broken: DemoData = {
      ...seed,
      maintenanceSchedules: seed.maintenanceSchedules.map((one) =>
        one.id === schedule.id ? { ...one, assetId: "ast-gone" } : one,
      ),
    };
    const brokenContext = harness(broken);

    const result = brokenContext.repository.runDue(TODAY, ACTOR);

    expect(result.refused).toContainEqual({
      kind: "assetUnreadable",
      scheduleId: schedule.id,
    });
    // The rest still ran — one bad reference does not stop the sweep.
    expect(result.generated.length).toBeGreaterThan(0);
  });
});

describe("a sweep whose context cannot see its own writes", () => {
  /**
   * The harness the browser actually is, until WA-76 lands.
   *
   * Every harness in this repository gives the context a live getter, so the
   * loop sees what it has just committed. `useRepositories` does not: it hands
   * the repositories `data` as a plain value captured in a `useMemo`, and React
   * does not re-render inside a click handler. So the two disagreed about what
   * a repository is handed, and the browser had the losing half — review
   * clicked "Run 13 due" and got **one** order. The second raise threw on a
   * duplicate id, the exception left the click handler, and the remaining
   * twelve were never attempted, so nothing was shown about them.
   *
   * This harness freezes `data` at the moment the repository is built, which is
   * what the browser does, so the sweep is tested on the path a person stands
   * on rather than the one the other tests were written against.
   */
  function frozen(seed: DemoData = buildSeed(NOW)) {
    let data = seed;
    const snapshot = seed;
    let sequence = 0;

    const context: RepositoryContext = {
      // Frozen on purpose. This is the whole point of the harness.
      data: snapshot,
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
      repository: createMaintenanceRepository(context),
      get data() {
        return data;
      },
    };
  }

  it("still raises one order per due visit, each with its own number", () => {
    /*
     * The control for the fix, and it fails without it.
     *
     * With a frozen context every iteration after the first reads the pre-sweep
     * orders, so `nextWorkOrderNumber` returns the same number, the id repeats
     * and `commitMany` throws — the store rejects an insert whose id the
     * collection already holds, and this is a throw rather than a refusal:
     * `GenerationRefusal` has no duplicate-id kind. The sweep carries the orders it
     * has already raised into the allocator, which is what makes it right under
     * either kind of context — and the repository should not have to know which
     * one it was handed.
     */
    const context = frozen();
    const due = context.repository.due(TODAY);
    expect(due.length, "nothing due, so this proves nothing").toBeGreaterThan(
      1,
    );

    const result = context.repository.runDue(TODAY, ACTOR);

    expect(result.generated).toHaveLength(due.length);
    expect(result.refused).toEqual([]);

    const numbers = result.generated.map((order) => order.number);
    expect(new Set(numbers).size).toBe(numbers.length);

    // And the orders are really in the records, not merely returned.
    const raised = context.data.workOrders.filter(
      (order) => order.source === "plan",
    );
    expect(raised).toHaveLength(due.length);
  });
});

describe("finishing a generated visit", () => {
  const COMPLETION = {
    minutes: 45,
    note: "Filters changed, belt tension checked.",
    contentLanguage: "en" as const,
  };

  /**
   * A generated order starts `open`, and the status machine is not bypassed
   * here just because this file is about maintenance.
   *
   * Open → assigned → in progress → completed is the only legal path, so the
   * test walks it. Worth knowing for the ticket's QA step 3: "complete that
   * order" is three moves and a completion, not one button, and a screen that
   * offered Complete on a freshly generated order would be offering a move the
   * repository refuses.
   */
  function finish(
    context: ReturnType<typeof harness>,
    orderId: string,
    user: string,
  ) {
    context.workOrders.assign(orderId, user, ACTOR);
    context.workOrders.transition(orderId, "inProgress", ACTOR);
    return context.workOrders.complete(orderId, COMPLETION, ACTOR);
  }

  it("advances the schedule to its next date, in the same act", () => {
    const context = harness();
    const schedule = context.repository.due(TODAY)[0]!;
    const plan = context.repository.planById(schedule.planId)!;
    const order = context.repository.generate(schedule.id, ACTOR);

    /*
     * Walked to `inProgress` first, then measured around the completion alone.
     *
     * The claim is that *completing* is one act. Measuring across the whole
     * walk counts the assignment and the start too and reads 3 — which is
     * correct about three acts and says nothing about the one under test.
     */
    context.workOrders.assign(order.id, context.data.users[0]!.id, ACTOR);
    context.workOrders.transition(order.id, "inProgress", ACTOR);
    const beforeAudit = context.data.auditEvents.length;
    const beforeCommits = context.commits;

    context.workOrders.complete(order.id, COMPLETION, ACTOR);

    const advanced = context.data.maintenanceSchedules.find(
      (one) => one.id === schedule.id,
    )!;

    // Measured from the day it was **done**, not the day it was due: a visit
    // run late does not owe the next one early.
    expect(advanced.lastCompletedOn).toBe("2026-09-12");
    expect(advanced.nextDueOn).toBe(nextDueAfter("2026-09-12", plan.frequency));
    expect(advanced.nextDueOn).not.toBe(schedule.nextDueOn);
    // The field means "the order raised for the next visit", and the next
    // visit has none yet.
    expect(advanced.workOrderId).toBeNull();

    // One act: completing and advancing are one thing the technician did.
    expect(context.data.auditEvents.length - beforeAudit).toBe(1);
    expect(context.commits - beforeCommits).toBe(1);
  });

  it("moves the date by the plan's own interval", () => {
    // The arithmetic, against the shared map rather than a number typed here —
    // a test carrying its own copy of "quarterly is 91" would agree with itself
    // while the seed and the repository disagreed.
    const context = harness();
    const schedule = context.repository.due(TODAY)[0]!;
    const plan = context.repository.planById(schedule.planId)!;
    const order = context.repository.generate(schedule.id, ACTOR);

    finish(context, order.id, context.data.users[0]!.id);

    const advanced = context.data.maintenanceSchedules.find(
      (one) => one.id === schedule.id,
    )!;
    const days = Math.round(
      (Date.parse(`${advanced.nextDueOn}T00:00:00Z`) -
        Date.parse("2026-09-12T00:00:00Z")) /
        86_400_000,
    );
    expect(days).toBe(FREQUENCY_DAYS[plan.frequency]);
  });

  it("offers the visit again only when its new date comes round", () => {
    /*
     * The outcome a planner would notice, rather than the field. A schedule
     * that advanced but still showed up as due would have the sweep raise the
     * same visit every day.
     */
    const context = harness();
    const schedule = context.repository.due(TODAY)[0]!;
    const plan = context.repository.planById(schedule.planId)!;
    const order = context.repository.generate(schedule.id, ACTOR);
    finish(context, order.id, context.data.users[0]!.id);

    expect(context.repository.due(TODAY).map((one) => one.id)).not.toContain(
      schedule.id,
    );

    const advanced = context.data.maintenanceSchedules.find(
      (one) => one.id === schedule.id,
    )!;
    const raisable = raisableFrom(advanced.nextDueOn, plan.leadTimeDays);
    expect(context.repository.due(raisable).map((one) => one.id)).toContain(
      schedule.id,
    );
  });

  it("leaves an ordinary order's completion alone", () => {
    // Most orders have no schedule pointing at them, so nothing to move.
    const context = harness();
    const manual = context.data.workOrders.find(
      (one) => one.maintenancePlanId === null && one.status === "inProgress",
    )!;
    const before = context.data.maintenanceSchedules;

    // Already in progress, so it completes directly.
    context.workOrders.complete(manual.id, COMPLETION, ACTOR);

    expect(context.data.maintenanceSchedules).toEqual(before);
  });

  it("will not advance a visit from an order that came from no plan", () => {
    /*
     * **The control the previous test only looked like.**
     *
     * Completing an ordinary order leaves schedules alone whether or not the
     * `maintenancePlanId` guard exists, because no schedule points at it and
     * the lookup fails anyway — so that test passes with the guard deleted and
     * proves nothing about it. Measured, not assumed: removing the guard left
     * all 467 green.
     *
     * This is the case that separates them. A schedule pointing at an order
     * that did *not* come from a plan is reachable — a re-pointed schedule, or
     * records that disagree — and its plan resolves perfectly well, so the
     * plan lookup does not save us either. Without the guard, finishing
     * somebody's unrelated repair would move a maintenance visit nobody
     * serviced, and the next service would be a quarter late with nothing
     * saying why.
     */
    const seed = buildSeed(NOW);
    const manual = seed.workOrders.find(
      (one) => one.maintenancePlanId === null && one.status === "inProgress",
    )!;
    const schedule = seed.maintenanceSchedules[0]!;
    const planted: DemoData = {
      ...seed,
      maintenanceSchedules: seed.maintenanceSchedules.map((one) =>
        one.id === schedule.id ? { ...one, workOrderId: manual.id } : one,
      ),
    };
    const context = harness(planted);
    // The plan really does resolve, or this would pass for the wrong reason.
    expect(context.repository.planById(schedule.planId)).toBeDefined();

    context.workOrders.complete(manual.id, COMPLETION, ACTOR);

    const after = context.data.maintenanceSchedules.find(
      (one) => one.id === schedule.id,
    )!;
    expect(after.nextDueOn).toBe(schedule.nextDueOn);
    expect(after.lastCompletedOn).toBe(schedule.lastCompletedOn);
    expect(after.workOrderId).toBe(manual.id);
  });
});
