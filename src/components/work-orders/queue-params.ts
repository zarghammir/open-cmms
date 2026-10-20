import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  WORK_ORDER_TYPES,
  type WorkOrderPriority,
  type WorkOrderStatus,
  type WorkOrderType,
} from "@/domain/types/work-order";
import {
  isDueWindow,
  type AssigneeFacet,
  type DueWindow,
} from "./work-order-rows";
import {
  EMPTY_QUEUE_FILTER,
  type WorkOrderQueueFilter,
} from "@/data/selectors/work-order-queue";

/**
 * The queue's filters, read from and written to the address.
 *
 * The address is the only place a view is kept. There is no saved-view store in
 * Phase 1 and this is not a poor substitute for one: a filtered queue that
 * lives in its URL can be linked in a message, reopened tomorrow, and captured
 * in a screenshot that still means something — which is most of what a saved
 * view is for.
 *
 * Repeated values go in one key, comma-separated, rather than as repeated keys:
 * `?status=open,assigned` reads in a screenshot and survives being retyped.
 *
 * **An unknown value is dropped, never obeyed.** Someone editing an address by
 * hand, or a link that outlived a rename, must not produce an empty queue —
 * "no work orders match" and "that word is not a status" are different answers,
 * and only one of them is true. Dropping the bad value and showing the rest is
 * the honest reading.
 */

export const QUEUE_PARAM_KEYS = [
  "status",
  "priority",
  "type",
  "facility",
  "assignee",
  "due",
  "q",
] as const;

function list(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function keep<T extends string>(values: string[], allowed: readonly T[]): T[] {
  return values.filter((value): value is T =>
    (allowed as readonly string[]).includes(value),
  );
}

export interface QueueParamSource {
  get(key: string): string | null;
}

export function readQueueFilter(
  params: QueueParamSource,
  knownFacilityIds: readonly string[],
): WorkOrderQueueFilter {
  const facility = params.get("facility") ?? undefined;
  const assignee = params.get("assignee");

  return {
    status: keep<WorkOrderStatus>(
      list(params.get("status")),
      WORK_ORDER_STATUSES,
    ),
    priority: keep<WorkOrderPriority>(
      list(params.get("priority")),
      WORK_ORDER_PRIORITIES,
    ),
    type: keep<WorkOrderType>(list(params.get("type")), WORK_ORDER_TYPES),
    // A site this organisation does not have is dropped rather than matched,
    // which would show an empty queue for an address that is merely stale.
    facilityId:
      facility && knownFacilityIds.includes(facility) ? facility : undefined,
    assignee: readAssignee(assignee),
    due: readDue(params.get("due")),
    query: params.get("q")?.trim() ?? "",
  };
}

/**
 * `anyone`, `unassigned`, `crew`, or a user id.
 *
 * Nothing is validated here, deliberately — unlike every other facet, which
 * drops what it does not recognise. A user id cannot be checked without the
 * records, and an id nobody holds matches no rows, which is the truthful answer
 * to "show me this person's work" when the person is not there. A misspelt
 * `unassigned` behaves the same way: it names nobody, so it finds nobody.
 * Dropping it to `anyone` instead would answer a question that was not asked.
 */
function readAssignee(value: string | null): AssigneeFacet {
  return value && value.trim().length > 0 ? value.trim() : "anyone";
}

function readDue(value: string | null): DueWindow {
  return value && isDueWindow(value) ? value : "any";
}

/**
 * The address for a filter, with everything at its default left out.
 *
 * A queue nobody has narrowed has a clean URL, so the presence of a parameter
 * means somebody chose it.
 */
export function writeQueueParams(
  filter: WorkOrderQueueFilter,
): Record<string, string> {
  const params: Record<string, string> = {};

  if (filter.status.length > 0) params.status = filter.status.join(",");
  if (filter.priority.length > 0) params.priority = filter.priority.join(",");
  if (filter.type.length > 0) params.type = filter.type.join(",");
  if (filter.facilityId) params.facility = filter.facilityId;
  if (filter.assignee !== "anyone") params.assignee = filter.assignee;
  if (filter.due !== "any") params.due = filter.due;
  if (filter.query.trim().length > 0) params.q = filter.query.trim();

  return params;
}

/** Whether anything has been narrowed, for the "clear filters" affordance. */
export function isQueueFiltered(filter: WorkOrderQueueFilter): boolean {
  return Object.keys(writeQueueParams(filter)).length > 0;
}

export { EMPTY_QUEUE_FILTER };
