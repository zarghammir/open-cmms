import type { DemoData } from "@/data/seed";
import type { Role } from "@/domain/constants/roles";
import type {
  EntityRef,
  Id,
  IsoDate,
  NotifiableKind,
  User,
} from "@/domain/types";
import { isBelowMinimum } from "@/domain/constants/part";

/**
 * The six rules, as functions over the records.
 *
 * RFP 4.1.1(c) asks for automated notifications for upcoming and overdue work
 * so completion can be monitored. It is a mandatory clause, and a bell showing
 * one seeded low-stock notice does not meet it: what meets it is alerts that
 * fire when the records change.
 *
 * Three properties hold this together, and each one is a test below.
 *
 * **They are pure.** A rule is given the records, the queue and the moment; it
 * returns events. It writes nothing, reads no store and asks no clock of its
 * own, so a test can hand it a world and read the answer. That is also what
 * lets the evaluator run them anywhere without asking what else is going on.
 *
 * **They name people, not roles.** "Coordinators at this site" is resolved to
 * the individuals who hold that role at that facility, because a notice
 * addressed to a role cannot be marked read by one person without being marked
 * read for everybody, and because a coordinator in Kingston does not want
 * Regina's overdue list. The seeded notices still use `forRole`; those predate
 * any rule and are left alone.
 *
 * **Every event names itself.** `eventKey` identifies the happening rather than
 * the evaluation, so running the rules again — which happens on every write and
 * every boot — cannot produce a second copy. The key carries whatever makes it
 * a *different* event: an order's due date is in the due-soon key, because
 * moving the date is a new event, and moving it back is not a third one since
 * the first key already exists.
 */

export interface NotificationEvent {
  kind: NotifiableKind;
  /** Identifies the happening. Two evaluations of one event share this. */
  eventKey: string;
  /** A key under `notifications.` in both catalogues. */
  messageKey: string;
  params: Record<string, string | number>;
  subject: EntityRef;
  /** One person. A rule that means "the coordinators" returns one per person. */
  forUserId: Id;
}

/** A conflicted entry in the replay queue, as the rule needs to see it. */
export interface ConflictedChange {
  id: Id;
  label: string;
  /** Whoever is holding the demonstration when the conflict is answered. */
  forUserId: Id;
}

export interface RuleInput {
  data: DemoData;
  /** Conflicts waiting to be answered. Empty in every test that is not about them. */
  conflicts: readonly ConflictedChange[];
  now: Date;
}

/** A rule, named so a failing test and a deleted rule say the same word. */
export interface NotificationRule {
  key: NotifiableKind;
  evaluate: (input: RuleInput) => NotificationEvent[];
}

/** How far ahead "due soon" looks. Two days, as the tender's wording implies. */
export const DUE_SOON_DAYS = 2;

/** Work that can still be done, so it can still be late. */
const LIVE_STATUSES = new Set([
  "open",
  "assigned",
  "inProgress",
  "waitingForParts",
]);

function isoDay(at: Date): IsoDate {
  return at.toISOString().slice(0, 10) as IsoDate;
}

function addDays(at: Date, days: number): Date {
  const out = new Date(at);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

/**
 * The people who should hear about something at a site.
 *
 * Active users only: a notice addressed to somebody who has left the
 * organisation is a notice nobody reads, and it would still be counted in the
 * email log as mail that would have been sent.
 *
 * **Nobody at that site is not the same as nobody**, and this fell out of
 * running the rules against the real records rather than against three
 * hand-made ones. The demonstration's people are not spread evenly: the only
 * facility manager works at Kingston, coordinators sit at Moncton and
 * Sudbury, Kamloops has a technician and Regina has an inspector.
 * Strict site scoping therefore announced Regina's overdue work and its short
 * parts to **nobody at all** — the rule ran, found the right event, addressed
 * it to an empty list and said nothing.
 *
 * That is a worse answer than telling somebody at another site. A tender
 * clause about monitoring completion is not met by an alert that is correct
 * and unheard. So: the people at that site when there are any, and otherwise
 * whoever holds the role, wherever they are. Two answers, and the empty one is
 * not allowed to be the third.
 */
function peopleAt(
  data: DemoData,
  roles: readonly Role[],
  facilityId: Id | null,
): User[] {
  const holders = data.users.filter(
    (user) => user.active && roles.includes(user.role),
  );
  if (facilityId === null) return holders;

  const onSite = holders.filter((user) => user.homeFacilityId === facilityId);
  return onSite.length > 0 ? onSite : holders;
}

/** One event per recipient, from one happening. */
function forEachPerson(
  people: readonly User[],
  event: Omit<NotificationEvent, "forUserId">,
): NotificationEvent[] {
  return people.map((person) => ({ ...event, forUserId: person.id }));
}

/**
 * Work due within the next two days.
 *
 * The due date is in the key. Moving an order's due date is a different event
 * and is announced again; moving it back to a date already announced is not,
 * because that key exists. That is the behaviour the ticket asks for in the
 * words "no duplicate", and it falls out of naming the event properly rather
 * than out of a special case.
 */
export const dueSoonRule: NotificationRule = {
  key: "workOrderDueSoon",
  evaluate({ data, now }) {
    const today = isoDay(now);
    const horizon = isoDay(addDays(now, DUE_SOON_DAYS));

    return data.workOrders.flatMap((order) => {
      if (!LIVE_STATUSES.has(order.status)) return [];
      if (!order.dueAt || order.dueAt < today || order.dueAt > horizon) {
        return [];
      }

      return forEachPerson(
        recipientsForOrder(data, order.id, order.facilityId),
        {
          kind: "workOrderDueSoon",
          eventKey: `dueSoon:${order.id}:${order.dueAt}`,
          messageKey: "notifications.workOrderDueSoon",
          params: { number: order.number, dueAt: order.dueAt },
          subject: { entity: "workOrder", id: order.id },
        },
      );
    });
  },
};

/**
 * Work whose due date has passed.
 *
 * Also keyed on the due date, and for the same reason: an order that was late
 * against Monday and is moved to Friday is a different situation, and the
 * person who was told about Monday should be told about Friday when it comes.
 */
export const overdueRule: NotificationRule = {
  key: "workOrderOverdue",
  evaluate({ data, now }) {
    const today = isoDay(now);

    return data.workOrders.flatMap((order) => {
      if (!LIVE_STATUSES.has(order.status)) return [];
      if (!order.dueAt || order.dueAt >= today) return [];

      return forEachPerson(
        recipientsForOrder(data, order.id, order.facilityId),
        {
          kind: "workOrderOverdue",
          eventKey: `overdue:${order.id}:${order.dueAt}`,
          messageKey: "notifications.workOrderOverdue",
          params: { number: order.number, dueAt: order.dueAt },
          subject: { entity: "workOrder", id: order.id },
        },
      );
    });
  },
};

/**
 * A job landing on somebody.
 *
 * Keyed on the assignment record rather than on the order, because
 * reassignment is a real event: passing an order from one technician to
 * another has to reach the second person, and the first assignment's key
 * cannot stand for it.
 */
export const assignedRule: NotificationRule = {
  key: "workOrderAssigned",
  evaluate({ data }) {
    return data.workOrderAssignments.flatMap((assignment) => {
      if (!assignment.userId) return [];
      const order = data.workOrders.find(
        (candidate) => candidate.id === assignment.workOrderId,
      );
      if (!order || !LIVE_STATUSES.has(order.status)) return [];

      return [
        {
          kind: "workOrderAssigned" as const,
          eventKey: `assigned:${assignment.id}`,
          messageKey: "notifications.workOrderAssigned",
          params: { number: order.number },
          subject: { entity: "workOrder", id: order.id },
          forUserId: assignment.userId,
        },
      ];
    });
  },
};

/**
 * A part at or below its reorder point.
 *
 * Keyed on the part alone, and that is a decision rather than an oversight: a
 * short part announced again on every count that leaves it short would bury
 * the bell under one line per movement. It is announced once, to the people who
 * reorder. The count sheet is where the number lives.
 */
export const lowStockRule: NotificationRule = {
  key: "partBelowMinimum",
  evaluate({ data }) {
    return data.parts.flatMap((part) => {
      if (!isBelowMinimum(part)) return [];

      return forEachPerson(
        peopleAt(
          data,
          ["facilityManager", "maintenanceCoordinator"],
          part.facilityId,
        ),
        {
          kind: "partBelowMinimum",
          eventKey: `lowStock:${part.id}`,
          messageKey: "notifications.partBelowMinimum",
          params: { partNumber: part.partNumber, onHand: part.quantityOnHand },
          subject: { entity: "part", id: part.id },
        },
      );
    });
  },
};

/**
 * An inspection due within the same two days.
 *
 * From the seeded figures, which is all there is until WA-20 builds
 * inspections properly. The rule reads `scheduledFor` on records that have not
 * been performed, so it will keep working unchanged when those records start
 * being created by people instead of by the seed.
 */
export const inspectionDueRule: NotificationRule = {
  key: "inspectionDue",
  evaluate({ data, now }) {
    const today = isoDay(now);
    const horizon = isoDay(addDays(now, DUE_SOON_DAYS));

    return data.inspections.flatMap((inspection) => {
      if (inspection.performedAt) return [];
      if (
        inspection.scheduledFor < today ||
        inspection.scheduledFor > horizon
      ) {
        return [];
      }

      const asset = data.assets.find(
        (candidate) => candidate.id === inspection.assetId,
      );

      return forEachPerson(
        peopleAt(data, ["facilityManager"], inspection.facilityId),
        {
          kind: "inspectionDue",
          eventKey: `inspectionDue:${inspection.id}:${inspection.scheduledFor}`,
          messageKey: "notifications.inspectionDue",
          params: {
            assetTag: asset?.assetTag ?? inspection.assetId,
            scheduledFor: inspection.scheduledFor,
          },
          subject: { entity: "inspection", id: inspection.id },
        },
      );
    });
  },
};

/**
 * A change the simulated server refused.
 *
 * The only rule whose input is not the records: a conflict lives in the replay
 * queue, which is the store's and not the seed's. It is addressed to the person
 * holding the demonstration, because they are the one who made the change and
 * the only one who can answer it.
 */
export const syncConflictRule: NotificationRule = {
  key: "syncConflict",
  evaluate({ conflicts }) {
    return conflicts.map((conflict) => ({
      kind: "syncConflict" as const,
      eventKey: `conflict:${conflict.id}`,
      messageKey: "notifications.syncConflict",
      params: { label: conflict.label },
      subject: { entity: "workOrder", id: conflict.id },
      forUserId: conflict.forUserId,
    }));
  },
};

/**
 * Who hears about a work order: whoever is doing it, and the coordinators at
 * its site.
 *
 * The site matters. Without it a coordinator in Kingston is told about Regina's
 * overdue work, which is the fastest way to make somebody stop reading the
 * bell.
 */
function recipientsForOrder(
  data: DemoData,
  workOrderId: Id,
  facilityId: Id,
): User[] {
  const coordinators = peopleAt(data, ["maintenanceCoordinator"], facilityId);
  const assigneeId = data.workOrderAssignments.find(
    (assignment) => assignment.workOrderId === workOrderId && assignment.userId,
  )?.userId;
  if (!assigneeId) return coordinators;

  const assignee = data.users.find((user) => user.id === assigneeId);
  if (!assignee || !assignee.active) return coordinators;
  if (coordinators.some((person) => person.id === assignee.id)) {
    return coordinators;
  }
  return [...coordinators, assignee];
}

/**
 * Every rule, in one list.
 *
 * The evaluator runs this and the tests walk it, so a rule that is deleted
 * stops being evaluated and stops being tested in the same edit — which is
 * what makes the deletion control for each rule name that rule rather than
 * reddening something adjacent.
 */
export const NOTIFICATION_RULES: readonly NotificationRule[] = [
  dueSoonRule,
  overdueRule,
  assignedRule,
  lowStockRule,
  inspectionDueRule,
  syncConflictRule,
];

/** Every event every rule has to report, for one moment. */
export function evaluateAll(input: RuleInput): NotificationEvent[] {
  return NOTIFICATION_RULES.flatMap((rule) => rule.evaluate(input));
}
