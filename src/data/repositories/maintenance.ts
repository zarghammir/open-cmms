import { raisableFrom } from "@/domain/constants/maintenance";
import { isOpenStatus } from "@/domain/constants/work-order-status";
import type {
  Id,
  IsoDate,
  MaintenancePlan,
  MaintenanceSchedule,
  WorkOrder,
} from "@/domain/types";
import { freeId } from "./ids";
import { nextWorkOrderNumber, raiseOrder } from "./raise-order";
import type { Actor, Mutation } from "@/stores/mutations";
import type { RepositoryContext } from "./types";

/**
 * Why a due schedule could not be turned into an order.
 *
 * Named individually rather than counted, because they are not the same
 * problem: an order already raised is the system working, and a schedule
 * whose asset or plan this system cannot read is a broken reference somebody
 * has to look at. A sweep that reported "3 refused" would hide the difference.
 */
export type GenerationRefusal =
  | { kind: "alreadyRaised"; scheduleId: Id; number: string }
  | { kind: "assetUnreadable"; scheduleId: Id }
  | { kind: "planUnreadable"; scheduleId: Id };

/** Thrown by `generate` when one named schedule cannot produce an order. */
export class GenerationRefusedError extends Error {
  constructor(readonly refusal: GenerationRefusal) {
    super(`Cannot generate for ${refusal.scheduleId}: ${refusal.kind}`);
    this.name = "GenerationRefusedError";
  }
}

export interface SweepResult {
  generated: WorkOrder[];
  refused: GenerationRefusal[];
}

/**
 * Preventive maintenance, read-only.
 *
 * Deliberately thin: the asset page needs to say what this asset is on a plan
 * for and when it is next due, and nothing more. WA-19 owns preventive
 * maintenance and extends this — generating orders from a due schedule,
 * creating plans, compliance — rather than replacing it, so that the asset page
 * and the maintenance module cannot end up with two ideas of what "next due"
 * means.
 */
export interface MaintenanceRepository {
  /** Every schedule for one asset, soonest due first. */
  schedulesForAsset: (assetId: Id) => MaintenanceSchedule[];
  planById: (id: Id) => MaintenancePlan | undefined;
  /** The plans this asset is on, by way of its schedules. */
  plansForAsset: (assetId: Id) => MaintenancePlan[];
  plans: () => MaintenancePlan[];
  /** Every schedule, soonest due first. */
  schedules: () => MaintenanceSchedule[];
  /**
   * The schedules an order may be raised for today, soonest due first.
   *
   * "Due" is `leadTimeDays` before the date, not on it — the lead time exists
   * so work can be planned rather than discovered on the morning. A schedule
   * that already has an **open** order is not due again: that is the order,
   * and raising a second would put two jobs on one visit.
   */
  due: (today: IsoDate) => MaintenanceSchedule[];
  /** Raises the order for one schedule, or says why it cannot. */
  generate: (scheduleId: Id, actor: Actor) => WorkOrder;
  /** Raises an order for every due schedule, one act each. */
  runDue: (today: IsoDate, actor: Actor) => SweepResult;
}

export function createMaintenanceRepository(
  context: RepositoryContext,
): MaintenanceRepository {
  function schedulesForAsset(assetId: Id): MaintenanceSchedule[] {
    return context.data.maintenanceSchedules
      .filter((schedule) => schedule.assetId === assetId)
      .sort((a, b) => a.nextDueOn.localeCompare(b.nextDueOn));
  }

  function planOf(schedule: MaintenanceSchedule): MaintenancePlan | undefined {
    return context.data.maintenancePlans.find(
      (plan) => plan.id === schedule.planId,
    );
  }

  /**
   * The order already raised for this visit, if it is still open.
   *
   * A completed or cancelled order does not block the next visit: the schedule
   * keeps `workOrderId` as the record of what was raised, and "already raised"
   * has to mean "there is one outstanding", not "there ever was one".
   */
  function openOrderFor(schedule: MaintenanceSchedule) {
    if (schedule.workOrderId === null) return undefined;
    const order = context.data.workOrders.find(
      (candidate) => candidate.id === schedule.workOrderId,
    );
    return order && isOpenStatus(order.status) ? order : undefined;
  }

  /**
   * Raises the order for one schedule and stamps the schedule, in one act.
   *
   * The order, its first history row, the schedule's new `workOrderId` and the
   * notice all go in a single `commitMany`: a planner pressed one button, and a
   * queue that could carry the order without the stamp would let the same visit
   * be raised twice the next time anything read the schedule.
   */
  function raiseFor(
    schedule: MaintenanceSchedule,
    actor: Actor,
    alsoRaised: readonly WorkOrder[] = [],
  ): { order: WorkOrder } | { refusal: GenerationRefusal } {
    const open = openOrderFor(schedule);
    if (open) {
      return {
        refusal: {
          kind: "alreadyRaised",
          scheduleId: schedule.id,
          number: open.number,
        },
      };
    }

    const plan = planOf(schedule);
    if (!plan) {
      return { refusal: { kind: "planUnreadable", scheduleId: schedule.id } };
    }
    const asset = context.data.assets.find(
      (candidate) => candidate.id === schedule.assetId,
    );
    if (!asset) {
      return { refusal: { kind: "assetUnreadable", scheduleId: schedule.id } };
    }

    const at = context.now().toISOString();
    const { order, mutations, audit } = raiseOrder({
      organizationId: context.data.organization.id,
      /*
       * The orders that exist **and** the ones this sweep has already raised.
       *
       * `nextWorkOrderNumber` reads a list and takes the highest. A unit
       * harness re-reads the store, so the list already holds what the loop
       * just committed; the browser hands the repositories a snapshot of one
       * render, and React does not re-render inside a click handler — so every
       * iteration after the first read the pre-sweep orders and asked for a
       * number already taken. Nothing catches what follows: `commitMany`
       * throws, because the store rejects an insert whose id the collection
       * already holds; the exception leaves `runDue` and the click handler; and
       * the visits after it are never attempted. Review clicked "Run 13 due"
       * and got one order and no word about the other twelve. They were not
       * refused — a refusal is one of the three kinds `GenerationRefusal`
       * names, it is collected in `refused`, and the screen says so.
       *
       * Carrying the raised orders along makes the sweep right under either,
       * which is the point: a repository should not depend on which of the two
       * it was handed. Passing them twice costs nothing — the allocator takes a
       * maximum, so a duplicate entry is the same answer.
       */
      number: nextWorkOrderNumber(
        [...context.data.workOrders, ...alsoRaised],
        context.now().getUTCFullYear(),
      ),
      at,
      asset,
      // The plan's own words, in both languages, so `contentLanguage` is null:
      // neither language is a translation of the other and no reader is told
      // otherwise.
      title: plan.name,
      description: plan.description,
      contentLanguage: null,
      type: "preventive",
      priority: "medium",
      dueOn: schedule.nextDueOn,
      estimatedMinutes: plan.estimatedMinutes,
      maintenancePlanId: plan.id,
      source: "plan",
      actor,
    });

    const tasks: Mutation[] = plan.tasks.map((task, index) => ({
      operation: "insert",
      collection: "workOrderTasks",
      id: `wkt-${order.number}-${index + 1}`,
      record: {
        organizationId: order.organizationId,
        workOrderId: order.id,
        sequence: index + 1,
        description: task,
        done: false,
        completedAt: null,
        completedByUserId: null,
      },
      actor,
      audit,
    }));

    context.commitMany(
      [
        ...mutations,
        ...tasks,
        {
          operation: "update",
          collection: "maintenanceSchedules",
          id: schedule.id,
          changes: { workOrderId: order.id },
          actor,
          audit,
        },
        {
          operation: "insert",
          collection: "notifications",
          // Asked of the collection, never built from the clock: two sweeps in
          // one millisecond are two ordinary acts.
          id: freeId(
            context.data.notifications,
            `ntf-due-${schedule.id}-${at}`,
          ),
          record: {
            organizationId: order.organizationId,
            kind: "maintenanceDue",
            messageKey: "notifications.maintenanceDue",
            params: { number: order.number, asset: asset.assetTag },
            subject: { entity: "workOrder", id: order.id },
            createdAt: at,
            readAt: null,
            // To whoever plans the work, not to one person: nobody has been
            // given this job yet — that is the next decision, not this one.
            forUserId: null,
            forRole: "maintenanceCoordinator",
          },
          actor,
          audit,
        },
      ],
      audit,
      actor,
      order.id,
      at,
    );

    return { order };
  }

  return {
    schedulesForAsset,

    planById: (id) =>
      context.data.maintenancePlans.find((plan) => plan.id === id),

    plansForAsset(assetId) {
      // A plan a schedule names but the records do not hold is dropped rather
      // than shown as a blank row: the asset is on the plans that resolve, and
      // one that does not resolve is a broken reference, not a nameless plan.
      return schedulesForAsset(assetId).flatMap((schedule) => {
        const plan = context.data.maintenancePlans.find(
          (candidate) => candidate.id === schedule.planId,
        );
        return plan ? [plan] : [];
      });
    },

    plans: () => [...context.data.maintenancePlans],

    schedules: () =>
      [...context.data.maintenanceSchedules].sort((a, b) =>
        a.nextDueOn.localeCompare(b.nextDueOn),
      ),

    due(today) {
      return [...context.data.maintenanceSchedules]
        .filter((schedule) => {
          const plan = planOf(schedule);
          if (!plan || !plan.active) return false;
          if (raisableFrom(schedule.nextDueOn, plan.leadTimeDays) > today) {
            return false;
          }
          return openOrderFor(schedule) === undefined;
        })
        .sort((a, b) => a.nextDueOn.localeCompare(b.nextDueOn));
    },

    generate(scheduleId, actor) {
      const schedule = context.data.maintenanceSchedules.find(
        (candidate) => candidate.id === scheduleId,
      );
      if (!schedule) throw new Error(`No schedule with id ${scheduleId}`);

      const outcome = raiseFor(schedule, actor);
      if ("refusal" in outcome) {
        throw new GenerationRefusedError(outcome.refusal);
      }
      return outcome.order;
    },

    runDue(today, actor) {
      const generated: WorkOrder[] = [];
      const refused: GenerationRefusal[] = [];

      /*
       * One order at a time, and the loop re-reads `due` nothing — it takes the
       * list once and commits inside it.
       *
       * Each raised order is its own act: its own trail entry, its own place in
       * the offline queue. That is what a planner would expect to undo one at a
       * time, and it is also what makes the numbering safe — `nextWorkOrderNumber`
       * reads the orders that exist, so orders numbered inside one commit would
       * all take the same number. A batched implementation passes every other
       * assertion here and collides on that one, which is why there is a test
       * for it.
       */
      for (const schedule of this.due(today)) {
        const outcome = raiseFor(schedule, actor, generated);
        if ("refusal" in outcome) {
          refused.push(outcome.refusal);
        } else {
          generated.push(outcome.order);
        }
      }

      return { generated, refused };
    },
  };
}
