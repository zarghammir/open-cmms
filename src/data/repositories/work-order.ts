import { freeId } from "./ids";
import { nextDueAfter } from "@/domain/constants/maintenance";
import { nextWorkOrderNumber, raiseOrder } from "./raise-order";
import {
  isOpenStatus,
  requiresCancellationReason,
  transitionAvailability,
} from "@/domain/constants/work-order-status";
import type {
  CancellationReason,
  ContentLanguage,
  Id,
  IsoDateTime,
  LabourEntry,
  WorkOrderComment,
  WorkOrder,
  WorkOrderAssignment,
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderStatusHistory,
  WorkOrderTask,
  WorkOrderType,
} from "@/domain/types";
import type { WorkOrderCreateInput } from "@/domain/schemas/work-order";
import type { Actor, Mutation, MutationAudit } from "@/stores/mutations";
import { fieldChanges } from "@/stores/mutations";
import { TransitionRefusedError } from "@/domain/constants/work-order-status";
import type { RepositoryContext } from "./types";

export interface WorkOrderFilter {
  status?: readonly WorkOrderStatus[];
  priority?: readonly WorkOrderPriority[];
  type?: readonly WorkOrderType[];
  facilityId?: Id;
  assetId?: Id;
  assignedUserId?: Id;
  /** Only orders whose due date has passed and that are still open. */
  overdueOn?: string;
}

export interface WorkOrderRepository {
  list: (filter?: WorkOrderFilter) => WorkOrder[];
  byId: (id: Id) => WorkOrder | undefined;
  /**
   * One order by the number people say out loud, which is what a URL carries.
   *
   * Case-insensitive, because an address is retyped and pasted by hand and
   * `wo-2026-0148` is the same order as `WO-2026-0148`. It is not fuzzy beyond
   * that: a number this system does not hold returns `undefined` rather than
   * the nearest match, because guessing which order somebody meant is worse
   * than saying the number is not here.
   */
  byNumber: (number: string) => WorkOrder | undefined;
  tasksFor: (id: Id) => WorkOrderTask[];
  assignmentFor: (id: Id) => WorkOrderAssignment | undefined;
  historyFor: (id: Id) => WorkOrderStatusHistory[];
  /** Time logged against one order, earliest first. Empty is empty, not zero. */
  labourFor: (id: Id) => LabourEntry[];
  /** What people wrote on one order, newest first. */
  commentsFor: (id: Id) => WorkOrderComment[];
  create: (input: WorkOrderCreateInput, actor: Actor) => WorkOrder;
  transition: (
    id: Id,
    to: WorkOrderStatus,
    actor: Actor,
    reason?: CancellationReason,
  ) => WorkOrder;
  assign: (id: Id, userId: Id, actor: Actor) => WorkOrder;
  /**
   * Ticks a task, or unticks it.
   *
   * Unticking is not an afterthought. A technician working one-handed in a
   * plant room mis-taps, and a checklist that only goes one way turns that into
   * a record of work nobody did — which is worse than no checklist. Unticking
   * clears who finished it and when, because those were only ever true of the
   * tick that has been taken back.
   */
  tickTask: (taskId: Id, done: boolean, actor: Actor) => WorkOrderTask;
  /** Records time against an order. Minutes are positive; there is no zero entry. */
  logLabour: (id: Id, input: LabourInput, actor: Actor) => LabourEntry;
  /**
   * Finishes an order: the status, the time it took, and what the person wants
   * the next reader to know.
   *
   * A note is required. "Completed" with nothing beside it is the record a
   * maintenance system is asked for six months later and cannot answer from,
   * and the person who could answer has gone home. The minutes become a labour
   * entry rather than a number on the order, because the entries are the record
   * and a total beside them could disagree with them.
   */
  complete: (id: Id, input: CompletionInput, actor: Actor) => WorkOrder;
}

export interface LabourInput {
  minutes: number;
  /** When the work happened, which is not always when it was written down. */
  workedAt?: IsoDateTime;
  note?: string | null;
}

export interface CompletionInput {
  minutes: number;
  /** What the next reader needs to know. Required — see `complete`. */
  note: string;
  /** The language the note was typed in. Never guessed from the interface. */
  contentLanguage: ContentLanguage;
}

export function isOverdue(order: WorkOrder, onDay: string): boolean {
  // An order with no due date is not overdue. Absent is not late, and it is
  // not on time either — it simply has no date, and the caller asked about
  // dates.
  if (!order.dueAt) return false;
  return isOpenStatus(order.status) && order.dueAt < onDay;
}

export function createWorkOrderRepository(
  context: RepositoryContext,
): WorkOrderRepository {
  const all = () => context.data.workOrders;

  /**
   * The visit this completion satisfies, moved on to its next date.
   *
   * Returned as a mutation rather than committed, so it joins the completion's
   * own `commitMany`: finishing a preventive order and advancing the schedule
   * behind it are one thing a technician did, and a queue that could carry the
   * completion without the advance would offer the same visit again the next
   * time anything read the plan.
   *
   * `workOrderId` goes back to null because the field means "the order raised
   * for the **next** visit", and once a visit is done the next one has no order
   * yet. What was raised is not lost by that: the order itself carries
   * `maintenancePlanId`, which is what a compliance figure will read.
   *
   * Three ways this returns nothing, and none of them is an error. An order
   * that came from no plan has no schedule to move. A schedule may have been
   * re-pointed at a different order since. And a plan this system cannot read
   * has no frequency, so there is no next date to compute — the schedule is
   * left exactly as it was rather than advanced to a guess, and `due` already
   * declines to offer a schedule whose plan is unreadable, so it does not come
   * back as work nobody can explain.
   */
  function advanceScheduleFor(
    order: WorkOrder,
    at: IsoDateTime,
    actor: Actor,
    audit: MutationAudit,
  ): Mutation | null {
    if (order.maintenancePlanId === null) return null;

    const schedule = context.data.maintenanceSchedules.find(
      (candidate) => candidate.workOrderId === order.id,
    );
    if (!schedule) return null;

    const plan = context.data.maintenancePlans.find(
      (candidate) => candidate.id === order.maintenancePlanId,
    );
    if (!plan) return null;

    const completedOn = at.slice(0, 10);
    return {
      operation: "update",
      collection: "maintenanceSchedules",
      id: schedule.id,
      changes: {
        lastCompletedOn: completedOn,
        nextDueOn: nextDueAfter(completedOn, plan.frequency),
        workOrderId: null,
      },
      actor,
      audit,
    };
  }

  /** The advance as a list, so it spreads cleanly into an act's mutations. */
  function advanceMutations(
    order: WorkOrder,
    at: IsoDateTime,
    actor: Actor,
    audit: MutationAudit,
  ): Mutation[] {
    const advance = advanceScheduleFor(order, at, actor, audit);
    return advance ? [advance] : [];
  }

  function requireOrder(id: Id): WorkOrder {
    const found = all().find((order) => order.id === id);
    if (!found) {
      throw new Error(`No work order with id ${id}`);
    }
    return found;
  }

  function nextNumber(): string {
    // One definition, shared with plan generation: a sweep that raised orders
    // from its own copy of this would be free to disagree about what the next
    // number is, and two orders with one number is not a thing a coordinator
    // can be asked to sort out.
    return nextWorkOrderNumber(all(), context.now().getUTCFullYear());
  }

  /**
   * The audit phrase for a status move.
   *
   * Cancelling and completing get keys of their own rather than the generic
   * `statusChanged`, because that key has nowhere to put the half worth
   * reading — the reason an order was called off, the time it took to finish.
   * A trail that records the fact and drops the decision is a trail an
   * evaluator will ask about.
   */
  function statusAudit(
    order: WorkOrder,
    to: WorkOrderStatus,
    reason?: CancellationReason,
    minutes?: number,
  ): MutationAudit {
    if (to === "cancelled") {
      return {
        entity: "workOrder",
        action: "cancelled",
        summaryKey: "audit.workOrderCancelled",
        summaryParams: {
          number: order.number,
          // The key, not the note: the note is free text somebody typed in one
          // language, and the trail reads in two.
          reason: reason?.key ?? "notRecordedInSource",
        },
      };
    }
    if (to === "completed" && minutes !== undefined) {
      return {
        entity: "workOrder",
        action: "statusChanged",
        summaryKey: "audit.workOrderCompleted",
        summaryParams: { number: order.number, minutes },
      };
    }
    return {
      entity: "workOrder",
      action: "statusChanged",
      summaryKey: "audit.statusChanged",
      summaryParams: { number: order.number, status: to },
    };
  }

  function taskAudit(order: WorkOrder, done: boolean): MutationAudit {
    return {
      entity: "workOrder",
      action: "updated",
      // Ticked and unticked are two different facts about the work, so they are
      // two sentences. One key with a boolean argument would read as "task
      // changed", which tells a reader nothing they did not already know.
      summaryKey: done ? "audit.taskTicked" : "audit.taskUnticked",
      summaryParams: { number: order.number },
    };
  }

  function labourAudit(order: WorkOrder, minutes: number): MutationAudit {
    return {
      entity: "workOrder",
      action: "updated",
      summaryKey: "audit.labourLogged",
      summaryParams: { number: order.number, minutes },
    };
  }

  /**
   * The records a status move writes, with the rules already applied.
   *
   * Shared by `transition`, `assign` and `complete` so the guard is reached by
   * every route rather than by the one that remembered. It throws before it
   * returns anything, so a caller cannot hold half a refused move.
   */
  function planStatusChange(
    order: WorkOrder,
    to: WorkOrderStatus,
    actor: Actor,
    at: IsoDateTime,
    reason?: CancellationReason,
  ): { mutations: Mutation[]; changes: Record<string, unknown> } {
    /*
     * The administrator's rules, read live from the records rather than from a
     * copy taken when the repository was built — `context.data` is a getter for
     * exactly this reason, and a rule switched off in Settings has to be true
     * for the very next write rather than after a reload.
     *
     * The refusal says WHICH of the two stopped it. "This order cannot do that"
     * and "somebody turned that off" are different sentences to a person, and a
     * screen that showed the first when the second was true would send a
     * technician looking for a fault in the work order.
     */
    const availability = transitionAvailability(
      context.data.workflowRules[0] ?? null,
      order.status,
      to,
    );
    if (availability !== "allowed") {
      throw new TransitionRefusedError(
        order.status,
        to,
        availability === "turnedOff"
          ? "workOrderStatus.refusedByRule"
          : "workOrderStatus.refused",
      );
    }
    if (requiresCancellationReason(to) && !reason) {
      // The rule holds even when the caller has nothing to say. An importer
      // records that the source system had no reason; it does not skip it.
      throw new TransitionRefusedError(
        order.status,
        to,
        "workOrderStatus.reasonRequired",
      );
    }

    const changes: Record<string, unknown> = { status: to };
    if (to === "inProgress" && !order.startedAt) changes.startedAt = at;
    if (to === "completed") changes.completedAt = at;
    if (to === "cancelled") {
      changes.cancelledAt = at;
      changes.cancellationReason = reason ?? null;
    }

    const step =
      context.data.workOrderStatusHistory.filter(
        (entry) => entry.workOrderId === order.id,
      ).length + 1;

    return {
      changes,
      mutations: [
        {
          operation: "update",
          collection: "workOrders",
          id: order.id,
          changes,
          actor,
          audit: statusAudit(order, to, reason),
        },
        {
          operation: "insert",
          collection: "workOrderStatusHistory",
          id: `wkh-${order.number}-${step}`,
          record: {
            organizationId: order.organizationId,
            workOrderId: order.id,
            from: order.status,
            to,
            at,
            byUserId: actor.userId,
            reason: reason ?? null,
          },
          actor,
          audit: statusAudit(order, to, reason),
        },
      ],
    };
  }

  return {
    list(filter) {
      return all().filter((order) => {
        if (filter?.status && !filter.status.includes(order.status)) {
          return false;
        }
        if (filter?.priority && !filter.priority.includes(order.priority)) {
          return false;
        }
        if (filter?.type && !filter.type.includes(order.type)) return false;
        if (filter?.facilityId && order.facilityId !== filter.facilityId) {
          return false;
        }
        if (filter?.assetId && order.assetId !== filter.assetId) return false;
        if (filter?.overdueOn && !isOverdue(order, filter.overdueOn)) {
          return false;
        }
        if (filter?.assignedUserId) {
          const assignment = context.data.workOrderAssignments.find(
            (candidate) => candidate.workOrderId === order.id,
          );
          if (assignment?.userId !== filter.assignedUserId) return false;
        }
        return true;
      });
    },

    byNumber(number) {
      const wanted = number.trim().toUpperCase();
      if (wanted.length === 0) return undefined;
      return all().find((order) => order.number.toUpperCase() === wanted);
    },

    byId(id) {
      return all().find((order) => order.id === id);
    },

    tasksFor(id) {
      return context.data.workOrderTasks
        .filter((task) => task.workOrderId === id)
        .sort((a, b) => a.sequence - b.sequence);
    },

    assignmentFor(id) {
      return context.data.workOrderAssignments.find(
        (assignment) => assignment.workOrderId === id,
      );
    },

    historyFor(id) {
      return context.data.workOrderStatusHistory
        .filter((entry) => entry.workOrderId === id)
        .sort((a, b) => a.at.localeCompare(b.at));
    },

    labourFor(id) {
      return context.data.labourEntries
        .filter((entry) => entry.workOrderId === id)
        .sort((a, b) => a.workedAt.localeCompare(b.workedAt));
    },

    commentsFor(id) {
      return context.data.workOrderComments
        .filter((comment) => comment.workOrderId === id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    create(input, actor) {
      const asset = context.data.assets.find(
        (candidate) => candidate.id === input.assetId,
      );
      if (!asset) {
        throw new Error(`No asset with id ${input.assetId}`);
      }

      const at = context.now().toISOString();
      const number = nextNumber();
      /*
       * The same words in both slots, and a note of which language they are.
       * Copying them is not a translation and is not presented as one: the
       * screens read `contentLanguage` and say what the reader is looking at.
       *
       * This is the half a generated order does differently — it has genuinely
       * bilingual words from its plan and a null `contentLanguage` — which is
       * why the shape of the record is described once in `raiseOrder` and the
       * words are the caller's business.
       */
      const { order, mutations, audit } = raiseOrder({
        organizationId: context.data.organization.id,
        number,
        at,
        asset,
        title: { en: input.title, fr: input.title },
        description: { en: input.description, fr: input.description },
        contentLanguage: input.contentLanguage,
        type: input.type,
        priority: input.priority,
        dueOn: input.dueOn,
        estimatedMinutes: input.estimatedMinutes,
        maintenancePlanId: null,
        source: "manual",
        actor,
      });

      // One act, not two writes. Raising an order creates the order and the
      // first row of its history, and a person did one thing — so it carries
      // one audit entry and takes one place in the offline queue. Written as
      // two commits, the banner counted six changes waiting when three orders
      // had been raised.
      context.commitMany(mutations, audit, actor, order.id, at);

      if (input.assignedUserId) {
        return this.assign(order.id, input.assignedUserId, actor);
      }

      return order;
    },

    transition(id, to, actor, reason) {
      const order = requireOrder(id);
      const at = context.now().toISOString();
      const { mutations, changes } = planStatusChange(
        order,
        to,
        actor,
        at,
        reason,
      );

      /*
       * One act, one entry. Moving an order writes the order and a row of its
       * history, and a person did one thing — so it takes one line in the trail
       * and one place in the offline queue. Written as two commits it took two
       * of each, which is the defect `create` was already fixed for: the
       * pending banner counted six changes when three orders had been raised.
       */
      context.commitMany(
        mutations,
        {
          ...statusAudit(order, to, reason),
          changes: fieldChanges(
            order as unknown as Record<string, unknown>,
            changes,
          ),
        },
        actor,
        id,
        at,
      );

      return { ...order, ...changes } as WorkOrder;
    },

    assign(id, userId, actor) {
      const order = requireOrder(id);
      const user = context.data.users.find(
        (candidate) => candidate.id === userId,
      );
      if (!user) {
        throw new Error(`No user with id ${userId}`);
      }

      const at = context.now().toISOString();
      const existing = this.assignmentFor(id);

      /*
       * A first assignment and a reassignment are different facts.
       *
       * "WO-… assigned to Mbeki" is true of both, and only one of them is the
       * whole truth: a trail that records a handover as an assignment loses
       * the person who had the work until that moment, which is the part
       * somebody asks about six months later. WA-88 added the control that
       * makes reassignment reachable at all, so this is the first time the
       * distinction can be made by anyone but the seed.
       *
       * `existing.userId` is read before the mutation below overwrites it.
       */
      const previous = existing?.userId
        ? context.data.users.find(
            (candidate) => candidate.id === existing.userId,
          )
        : undefined;

      /*
       * Who held it before, in the four answers that are actually possible.
       *
       * The first version of this asked `users.find(c => c.id === existing.userId)`
       * and treated "not found" as "nobody held it". `userId` is `Id | null`
       * and an assignment can carry a `crewCode` instead — the seed gives
       * three open orders to crew CONT01 that way, each at a different site —
       * three of the five, not one everywhere — and they sit near the top of
       * the queue where a demonstration clicks first. `seed-integrity` pins both
       * halves of that: exactly three crew-only assignments, at three different
       * sites, so this sentence cannot quietly stop being true. Handing
       * one of those to a technician wrote "assigned to Mbeki" and CONT01
       * disappeared without a word. That is precisely the loss this ticket
       * exists to prevent, on the orders most likely to be shown.
       *
       * So: a person, a crew with no person, a person this system cannot read,
       * or genuinely nothing. The third is its own answer rather than the
       * fourth — somebody held it and we cannot say who is not the same as
       * nobody held it, and a trail that collapsed them would be asserting the
       * work was unheld, which is the one thing it must not claim falsely.
       */
      const heldByCrew =
        existing !== undefined &&
        existing.userId === null &&
        existing.crewCode !== null;
      const heldByUnreadable =
        existing !== undefined && existing.userId !== null && !previous;

      const audit: MutationAudit = ((): MutationAudit => {
        const base = { entity: "workOrder", action: "assigned" } as const;

        if (previous && previous.id !== userId) {
          return {
            ...base,
            summaryKey: "audit.workOrderReassigned",
            summaryParams: {
              number: order.number,
              from: previous.lastName,
              to: user.lastName,
            },
          };
        }
        if (heldByCrew) {
          return {
            ...base,
            summaryKey: "audit.workOrderReassignedFromCrew",
            summaryParams: {
              number: order.number,
              crew: existing.crewCode as string,
              to: user.lastName,
            },
          };
        }
        if (heldByUnreadable) {
          return {
            ...base,
            summaryKey: "audit.workOrderReassignedFromUnreadable",
            summaryParams: { number: order.number, to: user.lastName },
          };
        }
        return {
          ...base,
          summaryKey: "audit.workOrderAssigned",
          summaryParams: { number: order.number, user: user.lastName },
        };
      })();
      const mutations: Mutation[] = [
        existing
          ? {
              operation: "update",
              collection: "workOrderAssignments",
              id: existing.id,
              changes: {
                userId,
                assignedAt: at,
                assignedByUserId: actor.userId,
              },
              actor,
              audit,
            }
          : {
              operation: "insert",
              collection: "workOrderAssignments",
              id: `wka-${order.number}`,
              record: {
                organizationId: order.organizationId,
                workOrderId: id,
                userId,
                crewCode: null,
                assignedAt: at,
                assignedByUserId: actor.userId,
              },
              actor,
              audit,
            },
        {
          operation: "insert",
          collection: "notifications",
          id: freeId(
            context.data.notifications,
            `ntf-asg-${order.number}-${at}`,
          ),
          record: {
            organizationId: order.organizationId,
            kind: "workOrderAssigned",
            messageKey: "notifications.workOrderAssigned",
            params: { number: order.number },
            subject: { entity: "workOrder", id },
            createdAt: at,
            readAt: null,
            // To the person, not to the role. Addressed to one person beats
            // addressed to a role in `addressedTo`, and work handed to somebody
            // by name is not news for everybody holding their job title.
            forUserId: userId,
            forRole: null,
          },
          actor,
          audit,
        },
      ];

      // Open work becomes assigned work in the same breath. Any other status is
      // left alone: an order already in progress does not go backwards because
      // somebody else took it over.
      const moved =
        order.status === "open"
          ? planStatusChange(order, "assigned", actor, at)
          : null;
      if (moved) mutations.push(...moved.mutations);

      context.commitMany(mutations, audit, actor, id, at);

      return moved ? ({ ...order, ...moved.changes } as WorkOrder) : order;
    },

    tickTask(taskId, done, actor) {
      const task = context.data.workOrderTasks.find(
        (candidate) => candidate.id === taskId,
      );
      if (!task) throw new Error(`No work-order task with id ${taskId}`);
      const order = requireOrder(task.workOrderId);

      const at = context.now().toISOString();
      // Unticking clears both, because they were only ever true of the tick
      // being taken back. Leaving a name and a time on an unticked task would
      // say somebody finished work the record now says is unfinished.
      const changes = {
        done,
        completedAt: done ? at : null,
        completedByUserId: done ? actor.userId : null,
      };

      context.commitMany(
        [
          {
            operation: "update",
            collection: "workOrderTasks",
            id: taskId,
            changes,
            actor,
            audit: taskAudit(order, done),
          },
        ],
        {
          ...taskAudit(order, done),
          changes: fieldChanges(
            task as unknown as Record<string, unknown>,
            changes,
          ),
        },
        actor,
        taskId,
        at,
      );

      return { ...task, ...changes } as WorkOrderTask;
    },

    logLabour(id, input, actor) {
      const order = requireOrder(id);
      if (!Number.isFinite(input.minutes) || input.minutes <= 0) {
        /*
         * Positive by schema, and positive here too, because this is the door a
         * screen comes through. An entry recording no time is not an entry —
         * and a zero would make `loggedMinutes` return 0 for an order nobody
         * has touched, which is the one thing that selector exists never to
         * say.
         */
        throw new Error("Logging time takes a positive number of minutes");
      }

      const at = context.now().toISOString();
      const entry: LabourEntry = {
        id: freeId(
          context.data.labourEntries,
          `lab-live-${at}-${order.number}`,
        ),
        organizationId: order.organizationId,
        workOrderId: id,
        userId: actor.userId,
        minutes: input.minutes,
        // When the work happened, which is not always when it was written
        // down: a technician logs Friday's job on Monday morning.
        workedAt: input.workedAt ?? at,
        note: input.note ?? null,
      };

      context.commitMany(
        [
          {
            operation: "insert",
            collection: "labourEntries",
            id: entry.id,
            record: entry as unknown as Record<string, unknown>,
            actor,
            audit: labourAudit(order, input.minutes),
          },
        ],
        labourAudit(order, input.minutes),
        actor,
        id,
        at,
      );

      return entry;
    },

    complete(id, input, actor) {
      const order = requireOrder(id);
      /*
       * The note is required when the rule says so, and the rule is seeded on.
       *
       * Before WA-112 this was unconditional, and the argument for it has not
       * been withdrawn: "completed" with nothing beside it is what a
       * maintenance system is asked about six months later and cannot answer
       * from. What changed is that an administrator may now make that trade
       * for their own organisation, deliberately, with the trail recording who
       * did it. The default keeps the old behaviour exactly.
       */
      const requireNote =
        context.data.workflowRules[0]?.requireCompletionNote ?? true;
      if (requireNote && input.note.trim().length === 0) {
        throw new Error("Completing a work order takes a note");
      }
      if (!Number.isFinite(input.minutes) || input.minutes <= 0) {
        throw new Error("Completing a work order takes positive minutes");
      }

      const at = context.now().toISOString();
      /*
       * The guard first, so a refused completion writes nothing at all — not
       * the labour entry, not the note. `planStatusChange` throws before it
       * returns anything, which is what makes that true rather than intended.
       */
      const { mutations, changes } = planStatusChange(
        order,
        "completed",
        actor,
        at,
      );

      const labour: LabourEntry = {
        id: freeId(
          context.data.labourEntries,
          `lab-live-${at}-${order.number}`,
        ),
        organizationId: order.organizationId,
        workOrderId: id,
        userId: actor.userId,
        minutes: input.minutes,
        workedAt: at,
        note: null,
      };

      const audit = statusAudit(order, "completed", undefined, input.minutes);

      /*
       * One act, four records: the order, its history, the time it took and the
       * note. A person pressed one button.
       *
       * The minutes become a labour entry and never a field on the order. The
       * entries are the record; a total stored beside them is a second number
       * free to disagree with the first, and nobody can say which is right.
       */
      context.commitMany(
        [
          ...mutations,
          {
            operation: "insert",
            collection: "labourEntries",
            id: labour.id,
            record: labour as unknown as Record<string, unknown>,
            actor,
            audit,
          },
          {
            operation: "insert",
            collection: "workOrderComments",
            id: freeId(
              context.data.workOrderComments,
              `wkc-live-${at}-${order.number}`,
            ),
            record: {
              organizationId: order.organizationId,
              workOrderId: id,
              authorUserId: actor.userId,
              body: input.note.trim(),
              // The language they typed in, carried rather than guessed. A
              // reader of the other language is told so, not handed a
              // translation nobody wrote.
              contentLanguage: input.contentLanguage,
              createdAt: at,
            },
            actor,
            audit,
          },
          // And the visit behind it, when there is one. Same act.
          ...advanceMutations(order, at, actor, audit),
        ],
        {
          ...audit,
          changes: fieldChanges(
            order as unknown as Record<string, unknown>,
            changes,
          ),
        },
        actor,
        id,
        at,
      );

      return { ...order, ...changes } as WorkOrder;
    },
  };
}
