import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "@/data/seed";
import { createRepositories } from "@/data/repositories";
import { useDemoStore } from "./demo-store";
import type { Mutation } from "./mutations";

/**
 * The queue, end to end, without a browser.
 *
 * A separate file from `demo-store.test.ts` rather than a merge of the two.
 * Both arrived with the same name in the same merge and test different things
 * — that one covers `commitMany` being all-or-nothing, this one covers the
 * offline queue — and splicing two sets of fixtures together to share a
 * filename would have made both harder to read for no gain.
 *
 * Offline mode is the one requirement in this tender that a reviewer is asked
 * to watch rather than read about, so the browser tests matter — but the
 * ordering, the refusal and the resolution are decisions, and decisions are
 * cheaper and sharper to test here than through a click.
 */

const TODAY = new Date("2026-09-13T00:00:00.000Z");
const ACTOR = { userId: "usr-raman", role: "maintenanceCoordinator" } as const;

function seedStore() {
  const seed = buildSeed(TODAY);
  useDemoStore.setState({
    data: seed,
    status: "ready",
    seededOn: "2026-09-13",
    auditSequence: 0,
    online: true,
    outbox: [],
    serverVersions: {},
    syncLog: [],
    conflictPlanted: false,
    pendingConflict: null,
  });
  return seed;
}

function statusChange(orderId: string, to: string): Mutation {
  return {
    operation: "update",
    collection: "workOrders",
    id: orderId,
    changes: { status: to },
    actor: { ...ACTOR },
    audit: {
      entity: "workOrder",
      action: "statusChanged",
      summaryKey: "audit.statusChanged",
      summaryParams: { number: orderId, status: to },
    },
  };
}

describe("changes made with no connection", () => {
  beforeEach(() => {
    seedStore();
  });

  it("has work orders to change", () => {
    // Without this, a store seeded with nothing would satisfy everything below.
    expect(useDemoStore.getState().data?.workOrders.length).toBeGreaterThan(10);
  });

  it("lands in the records immediately and waits in the queue", () => {
    const store = useDemoStore.getState();
    const order = store.data!.workOrders.find((o) => o.status === "open")!;

    store.setOnline(false);
    store.commit(statusChange(order.id, "assigned"));

    const after = useDemoStore.getState();
    // Seen by the person who made it...
    expect(after.data!.workOrders.find((o) => o.id === order.id)!.status).toBe(
      "assigned",
    );
    // ...and still owed to the server.
    expect(after.outbox).toHaveLength(1);
    expect(after.outbox[0]!.queuedOffline).toBe(true);
    expect(after.outbox[0]!.label).toBe(order.number);
  });

  it("queues three changes and sends nothing until the connection returns", () => {
    const store = useDemoStore.getState();
    const orders = store.data!.workOrders.filter((o) => o.status === "open");
    expect(orders.length).toBeGreaterThanOrEqual(3);

    store.setOnline(false);
    for (const order of orders.slice(0, 3)) {
      useDemoStore.getState().commit(statusChange(order.id, "assigned"));
    }

    expect(useDemoStore.getState().outbox).toHaveLength(3);
    expect(useDemoStore.getState().syncLog).toHaveLength(0);
  });

  it("stops at the planted conflict rather than overwriting", () => {
    const store = useDemoStore.getState();
    const orders = store.data!.workOrders.filter((o) => o.status === "open");

    store.setOnline(false);
    for (const order of orders.slice(0, 3)) {
      useDemoStore.getState().commit(statusChange(order.id, "assigned"));
    }
    useDemoStore.getState().setOnline(true);

    const after = useDemoStore.getState();
    expect(after.pendingConflict).not.toBeNull();
    expect(after.pendingConflict!.server.value).toBe("waitingForParts");
    // The rest of the queue is still waiting: replaying past a record whose
    // state is in dispute would build on an answer nobody has given.
    expect(after.outbox).toHaveLength(3);
    expect(after.syncLog[0]!.outcome).toBe("conflicted");
  });

  it("drains the rest in order once the conflict is answered", () => {
    const store = useDemoStore.getState();
    const orders = store
      .data!.workOrders.filter((o) => o.status === "open")
      .slice(0, 3);

    store.setOnline(false);
    for (const order of orders) {
      useDemoStore.getState().commit(statusChange(order.id, "assigned"));
    }
    useDemoStore.getState().setOnline(true);
    useDemoStore.getState().resolveConflict("mine", { ...ACTOR });

    const after = useDemoStore.getState();
    expect(after.pendingConflict).toBeNull();
    expect(after.outbox).toHaveLength(0);

    // Newest first, so reversing gives the order they were written in.
    const sent = [...after.syncLog].reverse().map((e) => e.label);
    expect(sent).toEqual([
      orders[0]!.number,
      orders[0]!.number,
      orders[1]!.number,
      orders[2]!.number,
    ]);
    expect(after.syncLog.find((e) => e.outcome === "keptMine")).toBeDefined();
  });

  it("keeping the server's version writes it here and says so", () => {
    const store = useDemoStore.getState();
    const order = store.data!.workOrders.find((o) => o.status === "open")!;

    store.setOnline(false);
    useDemoStore.getState().commit(statusChange(order.id, "assigned"));
    useDemoStore.getState().setOnline(true);
    useDemoStore.getState().resolveConflict("theirs", { ...ACTOR });

    const after = useDemoStore.getState();
    expect(after.data!.workOrders.find((o) => o.id === order.id)!.status).toBe(
      "waitingForParts",
    );
    expect(after.syncLog[0]!.outcome).toBe("keptTheirs");
    expect(
      after.data!.auditEvents.some(
        (e) => e.summaryKey === "audit.conflictKeptTheirs",
      ),
    ).toBe(true);
    // The resolution is recorded here; it is not queued back to the server,
    // which already holds its own version.
    expect(after.outbox).toHaveLength(0);
  });

  it("labels a newly created record by its number, not its id", () => {
    // The conflict screen and the log both show this label. An insert is not in
    // the snapshot the change was made against, so reading it from there gave
    // the opaque id — which a screenshot showed and no test did.
    const store = useDemoStore.getState();
    const asset = store.data!.assets[0]!;

    store.setOnline(false);
    useDemoStore.getState().commit({
      operation: "insert",
      collection: "workOrders",
      id: "wko-WO-2026-9999",
      record: {
        ...store.data!.workOrders[0]!,
        id: "wko-WO-2026-9999",
        number: "WO-2026-9999",
        assetId: asset.id,
      },
      actor: { ...ACTOR },
      audit: {
        entity: "workOrder",
        action: "created",
        summaryKey: "audit.workOrderCreated",
        summaryParams: { number: "WO-2026-9999" },
      },
    });

    const entry = useDemoStore.getState().outbox[0]!;
    expect(entry.label).toBe("WO-2026-9999");
    expect(entry.label).not.toContain("wko-");
  });

  it("counts a batch as the one act it was", () => {
    // The whole reason the `many` kind exists. Raising an order writes two
    // records; a person did one thing. Written as two commits the banner said
    // six when three orders had been raised.
    const store = useDemoStore.getState();
    const order = store.data!.workOrders[0]!;

    store.setOnline(false);
    useDemoStore.getState().commitMany(
      [
        {
          operation: "update",
          collection: "workOrders",
          id: order.id,
          changes: { status: "assigned" },
          actor: { ...ACTOR },
          audit: {
            entity: "workOrder",
            action: "statusChanged",
            summaryKey: "audit.statusChanged",
            summaryParams: { number: order.number, status: "assigned" },
          },
        },
        {
          operation: "insert",
          collection: "workOrderStatusHistory",
          id: "wkh-batch-1",
          organizationId: store.data!.organization.id,
          actor: { ...ACTOR },
          record: {
            organizationId: store.data!.organization.id,
            workOrderId: order.id,
            from: "open",
            to: "assigned",
            at: "2026-09-13T10:00:00.000Z",
            byUserId: ACTOR.userId,
            reason: null,
          },
          audit: {
            entity: "workOrder",
            action: "statusChanged",
            summaryKey: "audit.statusChanged",
            summaryParams: { number: order.number, status: "assigned" },
          },
        },
      ] as never,
      {
        entity: "workOrder",
        action: "statusChanged",
        summaryKey: "audit.statusChanged",
        summaryParams: { number: order.number, status: "assigned" },
      },
      { ...ACTOR },
      order.id,
    );

    const after = useDemoStore.getState();
    expect(after.outbox).toHaveLength(1);
    expect(after.outbox[0]!.kind).toBe("many");
    expect(after.outbox[0]!.label).toBe(order.number);
    // Two records changed, one entry, one audit line.
    expect(
      after.data!.workOrderStatusHistory.some((r) => r.id === "wkh-batch-1"),
    ).toBe(true);
  });

  it("sends straight away when there is a connection", () => {
    const store = useDemoStore.getState();
    const order = store.data!.workOrders.find((o) => o.status === "open")!;

    store.commit(statusChange(order.id, "assigned"));

    const after = useDemoStore.getState();
    // The control that proves the queue is not simply always empty: offline it
    // held three, and online it holds none because it drained, not because
    // nothing was written.
    expect(after.outbox).toHaveLength(0);
    expect(after.syncLog).toHaveLength(1);
    expect(after.syncLog[0]!.outcome).toBe("applied");
  });

  it("a reset puts the queue and the spent conflict back", () => {
    const store = useDemoStore.getState();
    const order = store.data!.workOrders.find((o) => o.status === "open")!;

    store.setOnline(false);
    useDemoStore.getState().commit(statusChange(order.id, "assigned"));
    expect(useDemoStore.getState().outbox).toHaveLength(1);

    useDemoStore.getState().resetDemo(TODAY, { ...ACTOR });

    const after = useDemoStore.getState();
    expect(after.outbox).toHaveLength(0);
    expect(after.syncLog).toHaveLength(0);
    // The demonstration has to be re-runnable: a spent conflict would make the
    // second run different from the first.
    expect(after.conflictPlanted).toBe(false);
  });
});

describe("what the pending banner counts", () => {
  beforeEach(() => {
    seedStore();
  });

  /*
   * The banner counts acts, not records.
   *
   * This is the other half of WA-39's one-act-one-entry change, and the half a
   * technician actually sees. Handing out a single job used to write three
   * commits — the assignment, then the order and its history row through
   * `transition` — and each commit is one place in this queue, so the screen
   * said three changes were waiting when one thing had been done. `create` was
   * fixed for exactly this once already; every other write path still had it.
   *
   * Measured, not recalled: the base commit's `assign` run against the real
   * store writes 3, on either of two different open orders. The notice is not
   * in that three — it did not exist before this ticket, and it is written
   * inside the same commit as the assignment rather than after it.
   */
  it("counts one change when one job is handed out with no connection", () => {
    const seed = seedStore();
    const store = useDemoStore.getState();
    const repositories = createRepositories({
      get data() {
        return useDemoStore.getState().data ?? seed;
      },
      commit: (mutation, at) => useDemoStore.getState().commit(mutation, at),
      commitMany: (mutations, audit, actor, entityId, at) =>
        useDemoStore
          .getState()
          .commitMany(mutations, audit, actor, entityId, at),
      now: () => TODAY,
    });

    store.setOnline(false);

    const order = seed.workOrders.find(
      (candidate) => candidate.status === "open",
    )!;
    const technician = seed.users.find((user) => user.role === "technician")!;

    repositories.workOrders.assign(order.id, technician.id, { ...ACTOR });

    expect(useDemoStore.getState().outbox).toHaveLength(1);

    // And it is the whole act waiting, not one record of it: replaying this
    // entry has to put the assignment, the notice, the status and the history
    // row back, or a reconnect would restore a job assigned to nobody.
    const entry = useDemoStore.getState().outbox[0]!;
    expect(entry.kind).toBe("many");
    expect(entry.kind === "many" && entry.mutations.length).toBeGreaterThan(1);
  });

  it("counts two when two jobs are handed out", () => {
    // The control. Without it, a queue that dropped every entry would satisfy
    // the assertion above.
    const seed = seedStore();
    const store = useDemoStore.getState();
    const repositories = createRepositories({
      get data() {
        return useDemoStore.getState().data ?? seed;
      },
      commit: (mutation, at) => useDemoStore.getState().commit(mutation, at),
      commitMany: (mutations, audit, actor, entityId, at) =>
        useDemoStore
          .getState()
          .commitMany(mutations, audit, actor, entityId, at),
      now: () => TODAY,
    });

    store.setOnline(false);

    const open = seed.workOrders.filter(
      (candidate) => candidate.status === "open",
    );
    const technician = seed.users.find((user) => user.role === "technician")!;

    repositories.workOrders.assign(open[0]!.id, technician.id, { ...ACTOR });
    repositories.workOrders.assign(open[1]!.id, technician.id, { ...ACTOR });

    expect(useDemoStore.getState().outbox).toHaveLength(2);
  });

  it("counts one change when a part is handed out with no connection", () => {
    /*
     * The third converted path, and the one that had nothing holding it: with
     * `issue` reverted to two commits the whole unit suite stayed green, so
     * the queue length it produces was never asserted anywhere. The repository
     * test next door counts the trail entry; this counts the place in the
     * queue, and neither number implies the other.
     */
    const seed = seedStore();
    const store = useDemoStore.getState();
    const repositories = createRepositories({
      get data() {
        return useDemoStore.getState().data ?? seed;
      },
      commit: (mutation, at) => useDemoStore.getState().commit(mutation, at),
      commitMany: (mutations, audit, actor, entityId, at) =>
        useDemoStore
          .getState()
          .commitMany(mutations, audit, actor, entityId, at),
      now: () => TODAY,
    });

    store.setOnline(false);

    const part = seed.parts.find((candidate) => candidate.quantityOnHand >= 1)!;
    const order = seed.workOrders[0]!;

    repositories.parts.issue(part.id, 1, order.id, { ...ACTOR });

    expect(useDemoStore.getState().outbox).toHaveLength(1);

    // And the whole act is what waits: the count and the movement that explains
    // it replay together, or a reconnect would restore stock that dropped with
    // nothing behind it.
    const entry = useDemoStore.getState().outbox[0]!;
    expect(entry.kind).toBe("many");
    expect(entry.kind === "many" && entry.mutations.length).toBe(2);
  });
});
