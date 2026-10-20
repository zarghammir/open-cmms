import { INITIAL_WORK_ORDER_STATUS } from "@/domain/constants/work-order-status";
import type {
  Asset,
  ContentLanguage,
  Id,
  IsoDate,
  IsoDateTime,
  LocalizedText,
  WorkOrder,
  WorkOrderPriority,
  WorkOrderSource,
  WorkOrderType,
} from "@/domain/types";
import type { Actor, Mutation, MutationAudit } from "@/stores/mutations";

/**
 * What raising a work order writes, described rather than committed.
 *
 * Two callers need it and they commit differently. A person filling in the
 * form raises one order and nothing else. Generating from a maintenance plan
 * raises an order **and** stamps the schedule that produced it, and those are
 * one act — so the caller has to put both in a single `commitMany` rather than
 * take two turns at the store.
 *
 * Returning the mutations instead of writing them is what lets both do that
 * without a second description of what an order *is*. The alternative was
 * either widening `create` — whose input is a validated form schema, and a
 * generated order is not a form — or writing the order record out twice, which
 * is how two callers end up disagreeing about a field nobody thought about.
 */

export interface RaiseOrderInput {
  organizationId: Id;
  /** Already allocated by the caller: see the note on `number` below. */
  number: string;
  at: IsoDateTime;
  asset: Asset;
  title: LocalizedText;
  description: LocalizedText;
  /**
   * The language the words were written in, or **null for both**.
   *
   * Null is not a missing value. A generated order takes its words from a
   * maintenance plan, which is authored in English and French, so neither
   * language is a translation of the other and no reader should be told "as
   * written in English" about text that was also written in French. That is
   * the case `WorkOrder.contentLanguage` is nullable for, and generated orders
   * are the first records outside the seed to be in it.
   */
  contentLanguage: ContentLanguage | null;
  type: WorkOrderType;
  priority: WorkOrderPriority;
  dueOn: IsoDate | null;
  estimatedMinutes: number | null;
  maintenancePlanId: Id | null;
  source: WorkOrderSource;
  actor: Actor;
}

export interface RaisedOrder {
  order: WorkOrder;
  /** The order and its first history row, in that order. */
  mutations: Mutation[];
  /** The one entry the act carries, whatever else the caller adds to it. */
  audit: MutationAudit;
}

/**
 * The next free number for a year, read from the orders that exist.
 *
 * **It reads the records, so two orders numbered inside one commit take the
 * same number** — neither is in the data when the other is numbered. A sweep
 * that raises several orders must therefore commit them one at a time, which
 * is what the trail wants anyway since each raised order is its own act. There
 * is a test that catches a batched implementation.
 *
 * `freeId` is deliberately not the answer here. An id may gain a `-2` because
 * nothing reads meaning out of it; a number is printed, read aloud and quoted
 * over the phone, and `WO-2026-0042-2` is not a thing a coordinator can say.
 */
export function nextWorkOrderNumber(
  orders: readonly { number: string }[],
  year: number,
): string {
  const prefix = `WO-${year}-`;
  const highest = orders
    .filter((order) => order.number.startsWith(prefix))
    .map((order) => Number.parseInt(order.number.slice(prefix.length), 10))
    .filter((value) => Number.isFinite(value))
    .reduce((max, value) => Math.max(max, value), 0);
  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}

/**
 * The order and its first history row, ready to commit.
 *
 * The number is the caller's to allocate, for the reason above: where it comes
 * from is a decision that has to stay visible.
 */
export function raiseOrder(input: RaiseOrderInput): RaisedOrder {
  const {
    organizationId,
    number,
    at,
    asset,
    actor,
    contentLanguage,
    maintenancePlanId,
    source,
  } = input;

  const order: WorkOrder = {
    id: `wko-${number}`,
    organizationId,
    number,
    title: input.title,
    description: input.description,
    contentLanguage,
    assetId: asset.id,
    facilityId: asset.facilityId,
    locationId: asset.locationId,
    type: input.type,
    status: INITIAL_WORK_ORDER_STATUS,
    priority: input.priority,
    requestedAt: at,
    dueAt: input.dueOn,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    maintenancePlanId,
    source,
    estimatedMinutes: input.estimatedMinutes,
  };

  const audit: MutationAudit = {
    entity: "workOrder",
    action: "created",
    summaryKey: "audit.workOrderCreated",
    summaryParams: { number },
  };

  return {
    order,
    audit,
    mutations: [
      {
        operation: "insert",
        collection: "workOrders",
        id: order.id,
        record: order as unknown as Record<string, unknown>,
        actor,
        audit,
      },
      {
        operation: "insert",
        collection: "workOrderStatusHistory",
        id: `wkh-${number}-1`,
        record: {
          organizationId,
          workOrderId: order.id,
          from: null,
          to: INITIAL_WORK_ORDER_STATUS,
          at,
          byUserId: actor.userId,
          reason: null,
        },
        actor,
        audit: {
          entity: "workOrder",
          action: "created",
          summaryKey: "audit.statusChanged",
          summaryParams: { number, status: INITIAL_WORK_ORDER_STATUS },
        },
      },
    ],
  };
}
