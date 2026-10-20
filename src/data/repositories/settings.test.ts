import { describe, expect, it } from "vitest";
import { buildSeed, type DemoData } from "@/data/seed";
import {
  applyMutation,
  applyMutations,
  type Mutation,
} from "@/stores/mutations";
import { TransitionRefusedError } from "@/domain/constants/work-order-status";
import { createSettingsRepository } from "./settings";
import { createWorkOrderRepository } from "./work-order";
import type { RepositoryContext } from "./types";

/**
 * Changing a rule, and the rule being obeyed.
 *
 * Two claims and they are not the same one. The repository's own test proves a
 * status guard is *reached* rather than merely reachable; this proves the same
 * for a guard whose answer now comes from a record an administrator edits — so
 * the path runs settings → store → work orders, through the real mutation
 * layer, rather than asserting the rule object in isolation.
 */

const NOW = new Date("2026-09-12T14:05:00.000Z");
const ACTOR = { userId: "usr-1", role: "administrator" as const };

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
    settings: createSettingsRepository(context),
    workOrders: createWorkOrderRepository(context),
    applied,
    get data() {
      return data;
    },
  };
}

/** An order that can still be worked, picked from the screen's own records. */
function liveOrder(data: DemoData) {
  const found = data.workOrders.find((order) => order.status === "inProgress");
  if (!found) throw new Error("the seed holds no order in progress");
  return found;
}

describe("a rule an administrator changes", () => {
  it("is obeyed by the next write, not after a reload", () => {
    const h = harness();
    const order = liveOrder(h.data);

    // The floor: the move is allowed before the rule changes. Without it a
    // refusal below would prove nothing — it could have been refused all along.
    expect(() =>
      h.workOrders.transition(order.id, "completed", ACTOR),
    ).not.toThrow();

    const another = h.data.workOrders.find(
      (one) => one.status === "inProgress" && one.id !== order.id,
    )!;
    h.settings.setTransitionEnabled("inProgress", "completed", false, ACTOR);

    expect(() =>
      h.workOrders.transition(another.id, "completed", ACTOR),
    ).toThrow(TransitionRefusedError);
  });

  it("refuses with the rule's reason, not the flow's", () => {
    /*
     * The sentence a person is shown. "This order cannot do that" and
     * "somebody turned that off" are different answers, and a screen showing
     * the first when the second is true sends a technician looking for a fault
     * in the work order.
     */
    const h = harness();
    const order = liveOrder(h.data);
    h.settings.setTransitionEnabled("inProgress", "completed", false, ACTOR);

    try {
      h.workOrders.transition(order.id, "completed", ACTOR);
      throw new Error("the transition was not refused");
    } catch (error) {
      expect(error).toBeInstanceOf(TransitionRefusedError);
      expect((error as TransitionRefusedError).reasonKey).toBe(
        "workOrderStatus.refusedByRule",
      );
    }

    // And the flow's own refusal still says the flow, so the two are
    // distinguishable rather than one having swallowed the other.
    const done = h.data.workOrders.find((one) => one.status === "completed")!;
    try {
      h.workOrders.transition(done.id, "inProgress", ACTOR);
      throw new Error("the transition was not refused");
    } catch (error) {
      expect((error as TransitionRefusedError).reasonKey).toBe(
        "workOrderStatus.refused",
      );
    }
  });

  it("lets a completion through without a note once the rule is off", () => {
    const h = harness();
    const order = liveOrder(h.data);

    expect(() =>
      h.workOrders.complete(
        order.id,
        { minutes: 30, note: "   ", contentLanguage: "en" },
        ACTOR,
      ),
    ).toThrow();

    h.settings.setRequireCompletionNote(false, ACTOR);

    expect(() =>
      h.workOrders.complete(
        order.id,
        { minutes: 30, note: "", contentLanguage: "en" },
        ACTOR,
      ),
    ).not.toThrow();
  });
});

describe("the trail of a rule change", () => {
  it("records who changed what, once per change", () => {
    const h = harness();
    const before = h.data.auditEvents.length;

    h.settings.setTransitionEnabled("inProgress", "completed", false, ACTOR);
    h.settings.setRequireCompletionNote(false, ACTOR);

    expect(h.data.auditEvents.length - before).toBe(2);

    const entries = h.data.auditEvents.slice(0, 2);
    expect(entries.map((one) => one.summaryKey).sort()).toEqual([
      "audit.completionNoteOptional",
      "audit.workflowMoveDisabled",
    ]);
    for (const entry of entries) {
      /*
       * Narrowed rather than asserted through: `AuditEvent` is two shapes, and
       * a system entry has nowhere to put a user. Reading `actorUserId` off the
       * union is what the compiler refuses, and it is right to — an entry the
       * application wrote would carry no name at all.
       */
      expect(entry.actorKind).toBe("person");
      if (entry.actorKind !== "person") continue;
      expect(entry.actorUserId).toBe(ACTOR.userId);
    }
  });

  it("says nothing when nothing changed", () => {
    /*
     * Setting a switch to what it already is is not an act. An entry for it
     * would be a record of something nobody did, and a trail that fills with
     * those is a trail nobody reads.
     */
    const h = harness();
    const before = h.data.auditEvents.length;

    h.settings.setRequireCompletionNote(true, ACTOR);
    h.settings.setTransitionEnabled("inProgress", "completed", true, ACTOR);
    h.settings.setWaitingForParts(true, ACTOR);

    expect(h.data.auditEvents.length).toBe(before);
    expect(h.applied).toHaveLength(0);
  });

  it("closes both directions of Waiting for parts as one act", () => {
    const h = harness();
    const before = h.data.auditEvents.length;

    h.settings.setWaitingForParts(false, ACTOR);

    // One entry, two edges. A stage a person can enter and not leave would
    // strand an order where nothing can move it.
    expect(h.data.auditEvents.length - before).toBe(1);
    expect(h.data.workflowRules[0]!.disabledTransitions).toHaveLength(2);
    expect(h.data.auditEvents[0]!.summaryKey).toBe(
      "audit.waitingForPartsDisabled",
    );
  });

  it("names the statuses as values the catalogue can translate", () => {
    // Not a built sentence and not an English word: `fromStatus` and
    // `toStatus` hold domain values, and `auditSummaryParams` turns them into
    // words at the moment of reading, in whichever language is being read.
    const h = harness();
    h.settings.setTransitionEnabled("inProgress", "completed", false, ACTOR);

    expect(h.data.auditEvents[0]!.summaryParams).toEqual({
      fromStatus: "inProgress",
      toStatus: "completed",
    });
  });
});

describe("the demonstration reset", () => {
  it("puts the rules back, because they are records like any other", async () => {
    /*
     * Through the store rather than by rebuilding the seed here, because the
     * claim is about `resetDemo` — the ruling's whole argument for putting the
     * rules in `DemoData` was that the reset restores them for free, and "for
     * free" is exactly the kind of thing that is true until it is not.
     *
     * The floor first: the rule really was changed, so a reset that did
     * nothing at all would not be mistaken for one that worked.
     */
    const { useDemoStore } = await import("@/stores/demo-store");
    const today = new Date("2026-09-12T00:00:00.000Z");

    useDemoStore.getState().ensureSeeded(today);
    const repositories = await import("./index");
    const store = useDemoStore.getState();

    const settings = repositories.createRepositories({
      get data() {
        return useDemoStore.getState().data!;
      },
      commit: (mutation, at) => store.commit(mutation, at),
      commitMany: (mutations, audit, actor, entityId, at) =>
        store.commitMany(mutations, audit, actor, entityId, at),
      now: () => today,
    }).settings;

    settings.setRequireCompletionNote(false, ACTOR);
    settings.setWaitingForParts(false, ACTOR);
    expect(
      useDemoStore.getState().data!.workflowRules[0]!.requireCompletionNote,
    ).toBe(false);
    expect(
      useDemoStore.getState().data!.workflowRules[0]!.disabledTransitions,
    ).toHaveLength(2);

    useDemoStore.getState().resetDemo(today, ACTOR);

    const after = useDemoStore.getState().data!;
    expect(after.workflowRules[0]!.requireCompletionNote).toBe(true);
    expect(after.workflowRules[0]!.disabledTransitions).toEqual([]);
    expect(
      after.notificationDefaults.every((one) => one.inApp && one.email),
    ).toBe(true);

    // And the trail says a reset happened, rather than the rules quietly
    // changing back under somebody who would have no way to know why.
    expect(after.auditEvents[0]!.summaryKey).toBe("audit.demoReset");
  });
});
