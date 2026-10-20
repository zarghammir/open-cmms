import { describe, expect, it } from "vitest";
import { buildSeed, type DemoData } from "@/data/seed";
import { toIsoDate } from "@/data/seed/dates";
import {
  assignedRule,
  dueSoonRule,
  evaluateAll,
  inspectionDueRule,
  lowStockRule,
  NOTIFICATION_RULES,
  overdueRule,
  syncConflictRule,
  type NotificationEvent,
  type RuleInput,
} from "./rules";

/**
 * The six rules, against the records they will actually meet.
 *
 * Built from `buildSeed`, not from objects written here. A rule that works on
 * three hand-made work orders and not on the demonstration's forty-one is a
 * rule that passes its test and fails in front of an evaluator: the seed has
 * cancelled orders, orders with no due date, people at five sites and parts
 * that are already short, and every one of those is a way for a rule to be
 * wrong.
 *
 * Each rule is exercised by **making its event happen** rather than by reading
 * whatever the seed already contains. Asserting that the overdue rule finds the
 * seed's overdue orders is a test of the seed; moving an order's due date and
 * watching the rule notice is a test of the rule.
 */

const DAY = new Date("2026-09-15T12:00:00.000Z");

function world(edit: (data: DemoData) => void = () => {}): RuleInput {
  const data = buildSeed(DAY);
  edit(data);
  return { data, conflicts: [], now: DAY };
}

/** The events one rule reports, by its own key. */
function eventsOf(input: RuleInput, key: string): NotificationEvent[] {
  return evaluateAll(input).filter((event) => event.kind === key);
}

describe("the notification rules", () => {
  it("has one entry per rule, and each names itself", () => {
    /*
     * The floor for every test below. They all walk `NOTIFICATION_RULES` or
     * `evaluateAll`, so a list that lost an entry would leave them agreeing
     * with each other about a world in which that rule does not exist.
     */
    expect(NOTIFICATION_RULES.length, "rules registered").toBe(6);
    expect(NOTIFICATION_RULES.map((rule) => rule.key)).toEqual([
      "workOrderDueSoon",
      "workOrderOverdue",
      "workOrderAssigned",
      "partBelowMinimum",
      "inspectionDue",
      "syncConflict",
    ]);
  });

  it("tells people about work due within two days", () => {
    const tomorrow = toIsoDate(new Date("2026-09-16T12:00:00.000Z"));
    let subject = "";

    const input = world((data) => {
      // A live order, moved so that it is due tomorrow. Picked from the screen
      // rather than named in advance: the first order that can still be worked
      // on and is not already inside the window.
      const order = data.workOrders.find(
        (candidate) =>
          candidate.status === "open" &&
          candidate.dueAt !== null &&
          candidate.dueAt > tomorrow,
      );
      if (!order) throw new Error("the seed holds no open order due later");
      order.dueAt = tomorrow;
      subject = order.id;
    });

    const events = eventsOf(input, "workOrderDueSoon");
    const mine = events.filter((event) => event.subject.id === subject);

    expect(
      mine.length,
      "nobody was told about work due tomorrow",
    ).toBeGreaterThan(0);
    expect(mine[0]!.eventKey).toBe(`dueSoon:${subject}:${tomorrow}`);
    // Named people, never a role: a role cannot mark one person's copy read.
    for (const event of mine) {
      expect(event.forUserId, "addressed to nobody in particular").toBeTruthy();
    }
  });

  it("tells people about work whose due date has passed", () => {
    const yesterday = toIsoDate(new Date("2026-09-14T12:00:00.000Z"));
    let subject = "";

    const input = world((data) => {
      const order = data.workOrders.find(
        (candidate) =>
          candidate.status === "assigned" && candidate.dueAt !== null,
      );
      if (!order)
        throw new Error("the seed holds no assigned order with a date");
      order.dueAt = yesterday;
      subject = order.id;
    });

    const mine = eventsOf(input, "workOrderOverdue").filter(
      (event) => event.subject.id === subject,
    );
    expect(mine.length, "nobody was told about late work").toBeGreaterThan(0);
    expect(mine[0]!.eventKey).toBe(`overdue:${subject}:${yesterday}`);
  });

  it("tells a person a job has landed on them", () => {
    let assignmentId = "";
    let technicianId = "";

    const input = world((data) => {
      const technician = data.users.find(
        (user) => user.role === "technician" && user.active,
      );
      const order = data.workOrders.find(
        (candidate) => candidate.status === "open",
      );
      if (!technician || !order) throw new Error("the seed is missing a pair");
      technicianId = technician.id;
      assignmentId = "wa-test-assignment";
      data.workOrderAssignments.push({
        id: assignmentId,
        organizationId: order.organizationId,
        workOrderId: order.id,
        userId: technician.id,
        crewCode: null,
        assignedAt: DAY.toISOString(),
        assignedByUserId: technician.id,
      });
    });

    const mine = eventsOf(input, "workOrderAssigned").filter(
      (event) => event.eventKey === `assigned:${assignmentId}`,
    );
    expect(mine.length, "the assignment reached nobody").toBe(1);
    expect(mine[0]!.forUserId, "it went to somebody else").toBe(technicianId);
  });

  it("tells the people who reorder that a part is short", () => {
    let partId = "";

    const input = world((data) => {
      const part = data.parts.find(
        (candidate) => candidate.quantityOnHand > candidate.reorderPoint,
      );
      if (!part) throw new Error("every seeded part is already short");
      part.quantityOnHand = 0;
      partId = part.id;
    });

    const mine = eventsOf(input, "partBelowMinimum").filter(
      (event) => event.subject.id === partId,
    );
    expect(mine.length, "nobody was told the part was short").toBeGreaterThan(
      0,
    );
    expect(mine[0]!.eventKey).toBe(`lowStock:${partId}`);
  });

  it("tells the facility manager about an inspection due", () => {
    const tomorrow = toIsoDate(new Date("2026-09-16T12:00:00.000Z"));
    let inspectionId = "";

    const input = world((data) => {
      const inspection = data.inspections.find(
        (candidate) => candidate.performedAt === null,
      );
      if (!inspection) throw new Error("every seeded inspection is done");
      inspection.scheduledFor = tomorrow;
      inspectionId = inspection.id;
    });

    const mine = eventsOf(input, "inspectionDue").filter(
      (event) => event.subject.id === inspectionId,
    );
    expect(mine.length, "nobody was told about the inspection").toBeGreaterThan(
      0,
    );
  });

  it("tells the person holding the demonstration about a refused change", () => {
    const data = buildSeed(DAY);
    const person = data.users[0]!;

    /*
     * Through `evaluateAll`, not through the rule's own `evaluate`.
     *
     * Calling the rule directly was the first version, and the per-rule
     * deletion control showed what it cost: removing `syncConflictRule` from
     * `NOTIFICATION_RULES` left this test green, because it never asked the
     * list. The rule would have stopped running in the application while the
     * test that names it went on passing. Every other rule's test goes through
     * the list and reddens; this one now does too.
     */
    const events = evaluateAll({
      data,
      now: DAY,
      conflicts: [{ id: "out-1", label: "WO-2026-0041", forUserId: person.id }],
    }).filter((event) => event.kind === "syncConflict");

    expect(events.length, "the conflict reached nobody").toBe(1);
    expect(events[0]!.forUserId).toBe(person.id);
    expect(events[0]!.eventKey).toBe("conflict:out-1");
  });

  it("reports the same event with the same name every time it is asked", () => {
    /*
     * The duplicate control, at the level where duplication is decided.
     *
     * Nothing here stops a second copy being *written* — that is the
     * evaluator's job and it has its own test. What this asserts is the
     * property the evaluator relies on: two evaluations of one unchanged world
     * produce the same event names, so a lookup by name can recognise them.
     * If a key carried the moment it was generated, this would fail, and every
     * boot would repeat every notice.
     */
    const first = evaluateAll(world());
    const second = evaluateAll(world());

    expect(first.length, "the rules found nothing to report").toBeGreaterThan(
      0,
    );
    expect(
      second.map((event) => `${event.eventKey}|${event.forUserId}`),
    ).toEqual(first.map((event) => `${event.eventKey}|${event.forUserId}`));
  });

  it("keeps a site's work to that site's coordinators when it has any", () => {
    const yesterday = toIsoDate(new Date("2026-09-14T12:00:00.000Z"));
    let facilityId = "";
    let subject = "";

    const input = world((data) => {
      /*
       * An order at a site that has a coordinator of its own, chosen by
       * looking rather than by naming one: the people are not spread evenly
       * across the five sites, and a test that named Moncton would pass for
       * a reason that has nothing to do with the rule.
       */
      const staffed = new Set(
        data.users
          .filter(
            (user) => user.active && user.role === "maintenanceCoordinator",
          )
          .map((user) => user.homeFacilityId),
      );
      const order = data.workOrders.find(
        (candidate) =>
          candidate.status === "open" &&
          candidate.dueAt !== null &&
          staffed.has(candidate.facilityId),
      );
      if (!order) throw new Error("no open order at a site with a coordinator");
      order.dueAt = yesterday;
      facilityId = order.facilityId;
      subject = order.id;
    });

    const recipients = eventsOf(input, "workOrderOverdue")
      .filter((event) => event.subject.id === subject)
      .map((event) =>
        input.data.users.find((user) => user.id === event.forUserId),
      );

    expect(recipients.length, "nobody was told at all").toBeGreaterThan(0);
    for (const person of recipients) {
      /*
       * Everyone told is either at that site or is the person doing the work.
       * Without the site test a coordinator in one city is told about another
       * city's overdue list, which is the fastest way to make somebody stop
       * reading the bell — and it would pass a test that only counted.
       */
      const assigned = input.data.workOrderAssignments.some(
        (assignment) =>
          assignment.workOrderId === subject &&
          assignment.userId === person?.id,
      );
      expect(
        person?.homeFacilityId === facilityId || assigned,
        `${person?.id} is at another site and is not doing the work`,
      ).toBe(true);
    }
  });

  it("still tells somebody when a site has no coordinator of its own", () => {
    /*
     * The other half, and the one that was a real defect rather than a
     * hypothetical. Regina has an inspector and nobody else; under strict
     * site scoping its overdue work was addressed to an empty list, so the
     * rule found the event, produced nothing, and said nothing. An alert that
     * is correct and unheard does not meet a clause about monitoring
     * completion.
     */
    const yesterday = toIsoDate(new Date("2026-09-14T12:00:00.000Z"));
    let subject = "";

    const input = world((data) => {
      const staffed = new Set(
        data.users
          .filter(
            (user) => user.active && user.role === "maintenanceCoordinator",
          )
          .map((user) => user.homeFacilityId),
      );
      const order = data.workOrders.find(
        (candidate) =>
          candidate.status === "open" &&
          candidate.dueAt !== null &&
          !staffed.has(candidate.facilityId) &&
          !data.workOrderAssignments.some(
            (assignment) =>
              assignment.workOrderId === candidate.id && assignment.userId,
          ),
      );
      if (!order) {
        throw new Error("every unstaffed site's orders are assigned already");
      }
      order.dueAt = yesterday;
      subject = order.id;
    });

    expect(
      eventsOf(input, "workOrderOverdue").filter(
        (event) => event.subject.id === subject,
      ).length,
      "late work at a site with no coordinator reached nobody",
    ).toBeGreaterThan(0);
  });

  it("says nothing about work that is finished or called off", () => {
    const yesterday = toIsoDate(new Date("2026-09-14T12:00:00.000Z"));
    let subject = "";

    const input = world((data) => {
      const order = data.workOrders.find(
        (candidate) => candidate.status === "completed",
      );
      if (!order) throw new Error("the seed holds no completed order");
      order.dueAt = yesterday;
      subject = order.id;
    });

    // The negative, with the positive above it: the same edit on a live order
    // does produce an event, which is the overdue test. Without that pairing
    // this passes against a rule that reports nothing at all.
    expect(
      eventsOf(input, "workOrderOverdue").filter(
        (event) => event.subject.id === subject,
      ).length,
      "a completed order was reported as late",
    ).toBe(0);
  });

  it("is pure: asking twice does not change the records", () => {
    const input = world();
    const before = JSON.stringify(input.data);
    evaluateAll(input);
    evaluateAll(input);
    expect(JSON.stringify(input.data), "a rule wrote to the records").toBe(
      before,
    );
  });

  it("every rule is reachable from the list", () => {
    // The named rules and the list are two descriptions of one thing, and a
    // rule exported but left out of the list would never run in the
    // application while every test that imports it directly stayed green.
    for (const rule of [
      dueSoonRule,
      overdueRule,
      assignedRule,
      lowStockRule,
      inspectionDueRule,
      syncConflictRule,
    ]) {
      expect(
        NOTIFICATION_RULES.includes(rule),
        `${rule.key} is not in the list the evaluator runs`,
      ).toBe(true);
    }
  });
});
