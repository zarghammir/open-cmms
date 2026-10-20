import { describe, expect, it } from "vitest";
import { buildSeed, type DemoData } from "@/data/seed";
import { isOpenStatus } from "@/domain/constants/work-order-status";
import type {
  AuditEvent,
  WorkOrder,
  WorkOrderAssignment,
} from "@/domain/types";
import {
  exceptionRows,
  facilityOfAuditEvent,
  matchesFacility,
  myAssignments,
  recentActivity,
  upcomingMaintenance,
} from "./dashboard";

const TODAY = new Date("2026-09-12T00:00:00.000Z");
const TODAY_ISO = "2026-09-12";

const seed = buildSeed(TODAY);

function withOrders(orders: WorkOrder[]): DemoData {
  return { ...seed, workOrders: orders };
}

function order(overrides: Partial<WorkOrder>): WorkOrder {
  const base = seed.workOrders[0] as WorkOrder;
  return { ...base, ...overrides };
}

function auditEvent(overrides: Partial<AuditEvent>): AuditEvent {
  return {
    id: "aud-test-1",
    organizationId: seed.organization.id,
    at: "2026-09-12T10:00:00.000Z",
    actorKind: "person",
    actorUserId: seed.users[0]!.id,
    actorRole: "administrator",
    entity: "workOrder",
    entityId: seed.workOrders[0]!.id,
    action: "statusChanged",
    summaryKey: "audit.statusChanged",
    summaryParams: {},
    changes: [],
    ...overrides,
  };
}

/**
 * The demonstration opens on this screen, and the storyline's first beat is an
 * overdue critical work order at a named site. Nothing in the seed plants one
 * on purpose — the priority and the due date are both drawn from the seeded
 * generator — so the guarantee is asserted here rather than assumed.
 *
 * It is a property of the generator, not of the day: every date in the seed is
 * an offset from the day it is given, so an order that is late is late whenever
 * the demo is opened.
 */
describe("the demonstration's opening shot", () => {
  it("has an overdue critical work order at a site with a name", () => {
    const rows = exceptionRows(seed, TODAY_ISO);
    const opening = rows.find(
      (row) => row.priority === "critical" && row.daysLate !== null,
    );

    expect(
      opening,
      "the seed holds no overdue critical work order, so the dashboard cannot open on one",
    ).toBeDefined();
    expect(opening?.facilityName).not.toBeNull();
    expect(opening?.daysLate).toBeGreaterThan(0);
  });

  it("opens on a critical order that is already late", () => {
    /*
     * A fact about the first impression, and only that. It used to be called
     * "puts it first, ahead of everything else needing attention", which
     * promised something about ORDER that reading one row cannot deliver: the
     * head of this list is the most overdue order and the highest priority at
     * once, so it is first under any ranking of the two. The case below is the
     * one that says something about order.
     */
    expect(exceptionRows(seed, TODAY_ISO)[0]?.priority).toBe("critical");
    expect(exceptionRows(seed, TODAY_ISO)[0]?.daysLate).toBeGreaterThan(0);
  });

  it("puts an earlier critical order above a later high-priority one", () => {
    /*
     * The ordering claim, made against the seeded records rather than planted
     * rows — and it discriminates, which the head assertion above stopped
     * doing when WA-87's estate landed.
     *
     * **Two assertions, because there are two ways to fail and they send a
     * reader to different places.** The pair is a fact about the data: some
     * high-priority order is more overdue than a critical one. Their positions
     * are a fact about the rule. A single assertion over the ordered list
     * conflated them — under a swapped comparator the pair is still in the
     * seed, merely the wrong way round, and the reader was told the seed no
     * longer held such a case. That is a rule regression wearing a data
     * failure's message.
     *
     * On the day this was written the dashboard shows a 24-days-late High and
     * an 11-days-late Critical, which is exactly the arrangement a reviewer
     * questioned on WA-13's picture.
     */
    const rows = exceptionRows(
      seed,
      TODAY_ISO,
      undefined,
      Number.MAX_SAFE_INTEGER,
    );

    // 1. The data. Membership does not depend on the comparator, so this asks
    //    only whether the estate contains a case worth ordering.
    const candidates = rows
      .filter((row) => row.priority === "critical" && row.daysLate !== null)
      .flatMap((critical) =>
        rows
          .filter(
            (row) =>
              row.priority === "high" &&
              row.daysLate !== null &&
              row.daysLate > critical.daysLate!,
          )
          .map((high) => ({ critical, high })),
      );

    expect(
      candidates.length,
      "no high-priority order in the seeded exceptions is more overdue than a critical one, so there is no case here to order — plant the rows or delete this",
    ).toBeGreaterThan(0);

    // 2. The rule. Every one of those pairs must come out critical first,
    //    which is only true if priority is compared before lateness.
    const order = new Map(rows.map((row, index) => [row.number, index]));
    const wrongWayRound = candidates
      .filter(
        ({ critical, high }) =>
          order.get(critical.number)! > order.get(high.number)!,
      )
      .map(
        ({ critical, high }) =>
          `${high.number} (high, ${high.daysLate} late) sorts above ${critical.number} (critical, ${critical.daysLate} late)`,
      );

    expect(
      wrongWayRound,
      "lateness is deciding before priority, which is not the order this panel is read in",
    ).toEqual([]);
  });

  it("is looking at a seed that holds open work at all", () => {
    // Without this, every assertion above could pass on an empty list.
    expect(
      seed.workOrders.filter((candidate) => isOpenStatus(candidate.status))
        .length,
    ).toBeGreaterThan(0);
    expect(exceptionRows(seed, TODAY_ISO).length).toBeGreaterThan(0);
  });
});

describe("what needs attention", () => {
  it("puts late work above work that is merely critical", () => {
    // A critical order due next week is a plan. A high-priority order that was
    // due last week is a problem, and the problem goes first.
    const data = withOrders([
      order({
        id: "planned",
        number: "WO-2026-0002",
        status: "open",
        priority: "critical",
        dueAt: "2026-09-30",
      }),
      order({
        id: "problem",
        number: "WO-2026-0001",
        status: "open",
        priority: "high",
        dueAt: "2026-09-05",
      }),
    ]);

    expect(exceptionRows(data, TODAY_ISO).map((row) => row.id)).toEqual([
      "problem",
      "planned",
    ]);
  });

  it("orders late work by priority", () => {
    const data = withOrders([
      order({
        id: "high",
        number: "WO-2026-0001",
        status: "open",
        priority: "high",
        dueAt: "2026-09-01",
      }),
      order({
        id: "critical",
        number: "WO-2026-0002",
        status: "open",
        priority: "critical",
        dueAt: "2026-09-11",
      }),
    ]);

    expect(exceptionRows(data, TODAY_ISO).map((row) => row.id)).toEqual([
      "critical",
      "high",
    ]);
  });

  it("orders equally urgent late work by how long it has been late", () => {
    const data = withOrders([
      order({
        id: "recent",
        number: "WO-2026-0001",
        status: "open",
        priority: "high",
        dueAt: "2026-09-11",
      }),
      order({
        id: "ancient",
        number: "WO-2026-0002",
        status: "open",
        priority: "high",
        dueAt: "2026-08-01",
      }),
    ]);

    const rows = exceptionRows(data, TODAY_ISO);
    expect(rows.map((row) => row.id)).toEqual(["ancient", "recent"]);
    expect(rows[0]?.daysLate).toBe(42);
    expect(rows[1]?.daysLate).toBe(1);
  });

  it("breaks a remaining tie on the work-order number rather than on input order", () => {
    const first = withOrders([
      order({ id: "b", number: "WO-2026-0002", dueAt: "2026-09-01" }),
      order({ id: "a", number: "WO-2026-0001", dueAt: "2026-09-01" }),
    ]);
    const reversed = withOrders([
      order({ id: "a", number: "WO-2026-0001", dueAt: "2026-09-01" }),
      order({ id: "b", number: "WO-2026-0002", dueAt: "2026-09-01" }),
    ]);

    expect(exceptionRows(first, TODAY_ISO).map((row) => row.number)).toEqual(
      exceptionRows(reversed, TODAY_ISO).map((row) => row.number),
    );
  });

  it("includes critical work that is not late, and closed work never", () => {
    const data = withOrders([
      order({
        id: "openCritical",
        status: "open",
        priority: "critical",
        dueAt: "2026-09-30",
      }),
      order({
        id: "doneCritical",
        status: "completed",
        priority: "critical",
        dueAt: "2020-01-01",
      }),
      order({
        id: "cancelledLate",
        status: "cancelled",
        priority: "high",
        dueAt: "2020-01-01",
      }),
    ]);

    expect(exceptionRows(data, TODAY_ISO).map((row) => row.id)).toEqual([
      "openCritical",
    ]);
  });

  it("includes low-priority work once it is late", () => {
    const data = withOrders([
      order({
        id: "late",
        status: "open",
        priority: "low",
        dueAt: "2026-09-01",
      }),
      order({
        id: "soon",
        status: "open",
        priority: "low",
        dueAt: "2026-09-30",
      }),
    ]);

    expect(exceptionRows(data, TODAY_ISO).map((row) => row.id)).toEqual([
      "late",
    ]);
  });

  it("never reports lateness as zero", () => {
    // Three states. Work with no due date is not late and not on time, and work
    // due later is not late either — but "late by nothing" is not an answer
    // either of them gives.
    const data = withOrders([
      order({
        id: "undated",
        status: "open",
        priority: "critical",
        dueAt: null,
      }),
      order({
        id: "dueToday",
        status: "open",
        priority: "critical",
        dueAt: TODAY_ISO,
      }),
    ]);

    const rows = exceptionRows(data, TODAY_ISO);
    expect(rows.map((row) => row.daysLate)).toEqual([null, null]);
    expect(rows.map((row) => row.daysLate)).not.toContain(0);
  });

  it("shows the site each row is at", () => {
    const row = exceptionRows(seed, TODAY_ISO)[0];
    const facility = seed.facilities.find(
      (candidate) => candidate.id === row?.facilityId,
    );

    expect(row?.facilityName).toEqual(facility?.name);
  });

  it("narrows to one site, and the sites add up to the whole", () => {
    const all = exceptionRows(
      seed,
      TODAY_ISO,
      undefined,
      Number.MAX_SAFE_INTEGER,
    );
    const perSite = seed.facilities.reduce(
      (total, facility) =>
        total +
        exceptionRows(seed, TODAY_ISO, facility.id, Number.MAX_SAFE_INTEGER)
          .length,
      0,
    );

    expect(perSite).toBe(all.length);
    // The control on the line above: without it, a filter that ignored its
    // argument and returned everything would satisfy the sum as well.
    expect(
      exceptionRows(seed, TODAY_ISO, seed.facilities[0]!.id).every(
        (row) => row.facilityId === seed.facilities[0]!.id,
      ),
    ).toBe(true);
    expect(all.length).toBeGreaterThan(1);
  });

  it("stops at the row limit", () => {
    expect(exceptionRows(seed, TODAY_ISO, undefined, 3)).toHaveLength(3);
  });
});

describe("upcoming maintenance", () => {
  const schedule = (id: string, nextDueOn: string) => ({
    ...seed.maintenanceSchedules[0]!,
    id,
    assetId: seed.assets[0]!.id,
    nextDueOn,
  });

  it("counts today as upcoming and yesterday as gone", () => {
    const data = {
      ...seed,
      maintenanceSchedules: [
        schedule("today", TODAY_ISO),
        schedule("yesterday", "2026-09-11"),
      ],
    };

    const rows = upcomingMaintenance(data, TODAY_ISO);
    expect(rows.map((row) => row.id)).toEqual(["today"]);
    expect(rows[0]?.daysUntil).toBe(0);
  });

  it("includes the last day of the window and excludes the next one", () => {
    const data = {
      ...seed,
      maintenanceSchedules: [
        schedule("inside", "2026-09-26"),
        schedule("outside", "2026-09-27"),
      ],
    };

    expect(
      upcomingMaintenance(data, TODAY_ISO, 14).map((row) => row.id),
    ).toEqual(["inside"]);
  });

  it("puts the soonest visit first", () => {
    const data = {
      ...seed,
      maintenanceSchedules: [
        schedule("later", "2026-09-20"),
        schedule("sooner", "2026-09-14"),
      ],
    };

    expect(upcomingMaintenance(data, TODAY_ISO).map((row) => row.id)).toEqual([
      "sooner",
      "later",
    ]);
  });

  it("narrows to one site", () => {
    const site = seed.facilities[0]!.id;
    const rows = upcomingMaintenance(seed, TODAY_ISO, 365, site);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.facilityId === site)).toBe(true);
    expect(rows.length).toBeLessThan(
      upcomingMaintenance(seed, TODAY_ISO, 365).length,
    );
  });
});

describe("which site a trail entry belongs to", () => {
  it("places an entry that names a record", () => {
    const target = seed.workOrders[0]!;
    expect(
      facilityOfAuditEvent(seed, auditEvent({ entityId: target.id })),
    ).toBe(target.facilityId);
  });

  it("calls a reset organisation-wide rather than placing it somewhere", () => {
    expect(
      facilityOfAuditEvent(
        seed,
        auditEvent({ entity: "demo", entityId: "demo" }),
      ),
    ).toBeNull();
  });

  it("says unknown when the record it names is not there", () => {
    // The third state, and the one that matters: an entry we cannot place is
    // not an entry that belongs to nowhere, and it must not be claimed for the
    // site someone is filtering to.
    expect(
      facilityOfAuditEvent(
        seed,
        auditEvent({ entityId: "wko-does-not-exist" }),
      ),
    ).toBeUndefined();
  });

  it("keeps organisation-wide entries under a filter and drops unplaceable ones", () => {
    const site = seed.facilities[0]!.id;

    expect(matchesFacility(null, site)).toBe(true);
    expect(matchesFacility(undefined, site)).toBe(false);
    expect(matchesFacility(site, site)).toBe(true);
    expect(matchesFacility(seed.facilities[1]!.id, site)).toBe(false);
    // With no filter every row shows, including the ones that cannot be placed.
    expect(matchesFacility(undefined, undefined)).toBe(true);
  });
});

describe("recent activity", () => {
  it("shows the newest entries first", () => {
    const data = {
      ...seed,
      auditEvents: [
        auditEvent({ id: "old", at: "2026-09-10T08:00:00.000Z" }),
        auditEvent({ id: "new", at: "2026-09-12T08:00:00.000Z" }),
      ],
    };

    expect(recentActivity(data).map((row) => row.event.id)).toEqual([
      "new",
      "old",
    ]);
  });

  it("stops at the limit", () => {
    expect(recentActivity(seed, 3)).toHaveLength(3);
    expect(seed.auditEvents.length).toBeGreaterThan(3);
  });

  it("resolves the person who made the change", () => {
    const actor = seed.users[0]!;
    const data = {
      ...seed,
      auditEvents: [auditEvent({ actorUserId: actor.id })],
    };

    expect(recentActivity(data)[0]?.actor).toEqual({
      kind: "person",
      name: `${actor.firstName} ${actor.lastName}`,
    });
  });

  it("says nothing rather than inventing an author it cannot resolve", () => {
    const data = {
      ...seed,
      auditEvents: [auditEvent({ actorUserId: "usr-does-not-exist" })],
    };

    // Unattributed, for a screen to render as a catalogue string. Not an empty
    // name, which would read as nobody, and not the application, which would
    // claim the product made the change itself.
    expect(recentActivity(data)[0]?.actor).toEqual({ kind: "unattributed" });
  });

  it("says the application wrote an entry the application wrote", () => {
    const data = {
      ...seed,
      auditEvents: [
        {
          ...auditEvent({}),
          actorKind: "system" as const,
          actorUserId: undefined,
          actorRole: undefined,
        },
      ],
    };

    // The third answer, and the reason the other two are not enough: a rebuild
    // of the records is nobody's doing, and reading it as an author that could
    // not be resolved would make it look like somebody's, untraceably.
    expect(recentActivity(data)[0]?.actor).toEqual({ kind: "system" });
  });

  it("keeps a reset visible at every site and hides entries it cannot place", () => {
    const site = seed.workOrders[0]!.facilityId;
    const data = {
      ...seed,
      auditEvents: [
        auditEvent({ id: "here", entityId: seed.workOrders[0]!.id }),
        auditEvent({ id: "reset", entity: "demo", entityId: "demo" }),
        auditEvent({ id: "orphan", entityId: "wko-does-not-exist" }),
      ],
    };

    expect(
      recentActivity(data, 10, site)
        .map((row) => row.event.id)
        .sort(),
    ).toEqual(["here", "reset"]);
  });
});

describe("one technician's own work", () => {
  const assignment = (
    workOrderId: string,
    overrides: Partial<WorkOrderAssignment>,
  ): WorkOrderAssignment => ({
    ...seed.workOrderAssignments[0]!,
    id: `wka-${workOrderId}`,
    workOrderId,
    userId: null,
    crewCode: null,
    ...overrides,
  });

  const mine = seed.users.find((user) => user.role === "technician")!;

  it("lists open work assigned to that person, most urgent first", () => {
    const data = {
      ...withOrders([
        order({
          id: "late",
          number: "WO-2026-0001",
          status: "assigned",
          priority: "medium",
          dueAt: "2026-09-01",
        }),
        order({
          id: "soon",
          number: "WO-2026-0002",
          status: "assigned",
          priority: "critical",
          dueAt: "2026-09-30",
        }),
        order({
          id: "done",
          number: "WO-2026-0003",
          status: "completed",
          dueAt: "2026-09-01",
        }),
      ]),
      workOrderAssignments: [
        assignment("late", { userId: mine.id }),
        assignment("soon", { userId: mine.id }),
        assignment("done", { userId: mine.id }),
      ],
    };

    expect(
      myAssignments(data, TODAY_ISO, mine.id).map((row) => row.id),
    ).toEqual(["late", "soon"]);
  });

  it("does not count a crew's work as one person's work", () => {
    // A crew code with nobody behind it is what a legacy import leaves. It is
    // not this technician's work, and it is not unassigned either.
    const data = {
      ...withOrders([order({ id: "crew", status: "assigned" })]),
      workOrderAssignments: [
        assignment("crew", { userId: null, crewCode: "HVAC-1" }),
      ],
    };

    expect(myAssignments(data, TODAY_ISO, mine.id)).toEqual([]);
  });

  it("answers with nothing when there is nobody to answer about", () => {
    // Not "everybody's work". With no person, the honest list is empty.
    expect(myAssignments(seed, TODAY_ISO, undefined)).toEqual([]);
  });

  it("finds real assignments in the seed", () => {
    // The control: the three tests above build their own data, so without this
    // they would all pass against a selector that never matched anything.
    const assigned = seed.workOrderAssignments.find((candidate) => {
      const subject = seed.workOrders.find(
        (candidate2) => candidate2.id === candidate.workOrderId,
      );
      return (
        candidate.userId !== null && subject && isOpenStatus(subject.status)
      );
    });

    expect(
      assigned,
      "the seed assigns no open work to a person, so the field home has nothing to show",
    ).toBeDefined();
    expect(
      myAssignments(seed, TODAY_ISO, assigned!.userId!).length,
    ).toBeGreaterThan(0);
  });
});
