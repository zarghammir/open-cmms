import {
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CircleDot,
  CirclePlay,
  CircleSlash,
  Equal,
  Package,
  TriangleAlert,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import type { StatusTone } from "@/components/shared/status-chip";
import type { TransitionPair, WorkflowRule } from "@/domain/types/workflow";
import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  type WorkOrderPriority,
  type WorkOrderStatus,
  type WorkOrderType,
} from "@/domain/types/work-order";

/**
 * The only description of how a work order may move.
 *
 * It is a map, not a dropdown: a screen asks what is reachable from where the
 * order is now, and the repository refuses anything else. Every entry was
 * written from the rule in AGENTS.md, and the unit test walks the whole
 * matrix — all 36 ordered pairs — so an accidental extra edge fails loudly
 * instead of quietly widening the flow.
 */
export const WORK_ORDER_TRANSITIONS: Readonly<
  Record<WorkOrderStatus, readonly WorkOrderStatus[]>
> = {
  open: ["assigned", "cancelled"],
  assigned: ["inProgress", "cancelled"],
  inProgress: ["waitingForParts", "completed", "cancelled"],
  waitingForParts: ["inProgress", "cancelled"],
  completed: [],
  cancelled: [],
};

/** The status a new order starts in. */
export const INITIAL_WORK_ORDER_STATUS: WorkOrderStatus = "open";

export function canTransition(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
): boolean {
  return WORK_ORDER_TRANSITIONS[from].includes(to);
}

/**
 * Why a move is not on offer — and the three answers are not the same sentence.
 *
 * `"allowed"`        the order may make this move.
 * `"notInFlow"`      the domain has no such edge. A finished order cannot go
 *                    back to in progress, and nobody withheld that: there is
 *                    nothing to withhold. A screen draws no control at all.
 * `"turnedOff"`      the edge exists and an administrator switched it off. A
 *                    screen keeps the control, disabled, and names the rule —
 *                    settled 2026-09-16, because a demonstration whose screen
 *                    quietly gets shorter demonstrates nothing.
 *
 * Collapsing the last two is the defect this type exists to prevent. It would
 * tell a technician that a completed order is "blocked by a rule an
 * administrator set", which is false, or it would hide a rule that was set,
 * which is the thing the ruling forbids.
 */
export type TransitionAvailability = "allowed" | "notInFlow" | "turnedOff";

export function transitionAvailability(
  rules: Pick<WorkflowRule, "disabledTransitions"> | null,
  from: WorkOrderStatus,
  to: WorkOrderStatus,
): TransitionAvailability {
  if (!WORK_ORDER_TRANSITIONS[from].includes(to)) return "notInFlow";

  /*
   * `null` means the rules have not been read yet, not that everything is
   * permitted. Before the browser has its records there is no answer, and the
   * honest one is the application's own behaviour — the base map — rather than
   * a guess in either direction. The screens gate on the store's status before
   * they draw anything, so this is the boot moment rather than a lasting state.
   */
  if (!rules) return "allowed";

  const off = rules.disabledTransitions.some(
    (pair) => pair.from === from && pair.to === to,
  );
  return off ? "turnedOff" : "allowed";
}

/** The effective rule: the domain's map, narrowed by whatever is switched off. */
export function canTransitionUnder(
  rules: Pick<WorkflowRule, "disabledTransitions"> | null,
  from: WorkOrderStatus,
  to: WorkOrderStatus,
): boolean {
  return transitionAvailability(rules, from, to) === "allowed";
}

/**
 * The two edges the "Waiting for parts" switch governs.
 *
 * The switch is a view over `disabledTransitions` rather than a field of its
 * own, so there is one answer to "is this move allowed" and not two that can
 * disagree. Turning the stage off has to close both directions: leaving the
 * way back open would let an order reach a status nothing can enter.
 */
export const WAITING_FOR_PARTS_EDGES: readonly TransitionPair[] = [
  { from: "inProgress", to: "waitingForParts" },
  { from: "waitingForParts", to: "inProgress" },
];

export function waitingForPartsEnabled(
  rules: Pick<WorkflowRule, "disabledTransitions"> | null,
): boolean {
  return WAITING_FOR_PARTS_EDGES.every(
    (edge) => transitionAvailability(rules, edge.from, edge.to) === "allowed",
  );
}

export function nextStatuses(
  from: WorkOrderStatus,
): readonly WorkOrderStatus[] {
  return WORK_ORDER_TRANSITIONS[from];
}

/** Nothing leaves these. A completed order is reopened by raising a new one. */
export function isTerminal(status: WorkOrderStatus): boolean {
  return WORK_ORDER_TRANSITIONS[status].length === 0;
}

/** Cancelling always says why. The rule holds even when a source system has no reason to give. */
export function requiresCancellationReason(to: WorkOrderStatus): boolean {
  return to === "cancelled";
}

/** Statuses that still want someone's attention. */
export const OPEN_WORK_ORDER_STATUSES: readonly WorkOrderStatus[] = [
  "open",
  "assigned",
  "inProgress",
  "waitingForParts",
];

export function isOpenStatus(status: WorkOrderStatus): boolean {
  return OPEN_WORK_ORDER_STATUSES.includes(status);
}

/**
 * How a status is drawn. Tone and icon travel together because `StatusChip`
 * requires both: colour is never the only signal.
 *
 * `labelKey` points into both catalogues. Nothing here is an English string.
 */
export interface StatusPresentation {
  tone: StatusTone;
  icon: LucideIcon;
  labelKey: string;
}

export const WORK_ORDER_STATUS_PRESENTATION: Readonly<
  Record<WorkOrderStatus, StatusPresentation>
> = {
  open: { tone: "neutral", icon: CircleDot, labelKey: "workOrderStatus.open" },
  assigned: {
    tone: "info",
    icon: UserCheck,
    labelKey: "workOrderStatus.assigned",
  },
  inProgress: {
    tone: "info",
    icon: CirclePlay,
    labelKey: "workOrderStatus.inProgress",
  },
  waitingForParts: {
    tone: "waiting",
    icon: Package,
    labelKey: "workOrderStatus.waitingForParts",
  },
  completed: {
    tone: "positive",
    icon: CircleCheck,
    labelKey: "workOrderStatus.completed",
  },
  cancelled: {
    tone: "quiet",
    icon: CircleSlash,
    labelKey: "workOrderStatus.cancelled",
  },
};

export const WORK_ORDER_PRIORITY_PRESENTATION: Readonly<
  Record<WorkOrderPriority, StatusPresentation>
> = {
  critical: {
    tone: "critical",
    icon: TriangleAlert,
    labelKey: "priority.critical",
  },
  high: { tone: "attention", icon: ChevronUp, labelKey: "priority.high" },
  medium: { tone: "neutral", icon: Equal, labelKey: "priority.medium" },
  low: { tone: "quiet", icon: ChevronDown, labelKey: "priority.low" },
};

/** Highest first, the order a work list is sorted in. */
export const PRIORITY_ORDER: Readonly<Record<WorkOrderPriority, number>> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function comparePriority(
  a: WorkOrderPriority,
  b: WorkOrderPriority,
): number {
  return PRIORITY_ORDER[a] - PRIORITY_ORDER[b];
}

export function isWorkOrderStatus(value: unknown): value is WorkOrderStatus {
  return (
    typeof value === "string" &&
    (WORK_ORDER_STATUSES as readonly string[]).includes(value)
  );
}

export function isWorkOrderPriority(
  value: unknown,
): value is WorkOrderPriority {
  return (
    typeof value === "string" &&
    (WORK_ORDER_PRIORITIES as readonly string[]).includes(value)
  );
}

/** The label key for a work-order type, for the same reason as the statuses. */
export function workOrderTypeLabelKey(type: WorkOrderType): string {
  return `workOrderType.${type}`;
}

/**
 * A refusal a person can be shown.
 *
 * The status rules are enforced in the repository rather than in a screen, so
 * every route into a work order — a button, a keyboard shortcut, a future
 * import — meets the same answer. `reasonKey` is a catalogue key: the refusal
 * has to read correctly in French too.
 *
 * It lives beside the rules rather than with the repository that raises it,
 * because a screen has to be able to recognise one. The data boundary forbids
 * a component importing anything under `@/data/repositories` — rightly — and
 * a refusal a person is shown is not an implementation detail of the store; it
 * is the status map saying no, which is domain knowledge. WA-39 moved it here
 * when the detail page's buttons needed to tell "this order cannot do that"
 * apart from an actual fault.
 */
export class TransitionRefusedError extends Error {
  readonly reasonKey: string;

  constructor(
    readonly from: WorkOrderStatus,
    readonly to: WorkOrderStatus,
    reasonKey = "workOrderStatus.refused",
  ) {
    super(`A work order cannot go from ${from} to ${to}`);
    this.name = "TransitionRefusedError";
    this.reasonKey = reasonKey;
  }
}
