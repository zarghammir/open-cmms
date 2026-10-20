import {
  WAITING_FOR_PARTS_EDGES,
  waitingForPartsEnabled,
} from "@/domain/constants/work-order-status";
import type {
  NotificationDefault,
  NotifiableKind,
  TransitionPair,
  WorkflowRule,
  WorkOrderPriority,
  WorkOrderStatus,
} from "@/domain/types";
import type { Actor } from "@/stores/mutations";
import type { RepositoryContext } from "./types";

/**
 * The rules an administrator changes, and the trail that records each change.
 *
 * Every method here writes through `context.commit`, so an audit entry is
 * written in the same step rather than by a caller who remembered — which is
 * what makes "who turned this off, and when" answerable at all. The entries
 * name the rule rather than the row, and the arguments that hold domain values
 * — a status, a priority — are named so `auditSummaryParams` can turn them into
 * words. A trail entry reading "moved to waitingForParts" is the same sentence
 * in both languages, which is the half that makes it a defect.
 */
export interface SettingsRepository {
  /** The organisation's rules, or null before the records have been read. */
  workflowRules: () => WorkflowRule | null;
  notificationDefaults: () => NotificationDefault[];

  /** Switches one move of the status map on or off. */
  setTransitionEnabled: (
    from: WorkOrderStatus,
    to: WorkOrderStatus,
    enabled: boolean,
    actor: Actor,
  ) => void;

  /**
   * Switches the Waiting for parts stage on or off.
   *
   * Both directions together, as one act with one trail entry: it is one
   * decision a person made, and leaving the way back open would let an order
   * reach a status nothing can enter.
   */
  setWaitingForParts: (enabled: boolean, actor: Actor) => void;

  setRequireCompletionNote: (required: boolean, actor: Actor) => void;

  setPrioritySla: (
    priority: WorkOrderPriority,
    hours: number,
    actor: Actor,
  ) => void;

  /** Turns one channel of one notification kind on or off, for new people. */
  setNotificationDefault: (
    kind: NotifiableKind,
    channel: "inApp" | "email",
    on: boolean,
    actor: Actor,
  ) => void;
}

function samePair(a: TransitionPair, b: TransitionPair): boolean {
  return a.from === b.from && a.to === b.to;
}

export function createSettingsRepository(
  context: RepositoryContext,
): SettingsRepository {
  /** The one row, or null. Null is "not read yet", never "no rules". */
  function rules(): WorkflowRule | null {
    return context.data.workflowRules[0] ?? null;
  }

  function requireRules(): WorkflowRule {
    const found = rules();
    if (!found) {
      // Not a guess and not a default: a caller writing before the records
      // exist is a bug in the caller, and inventing a row here would write a
      // rule set nobody configured.
      throw new Error("There are no workflow rules to change yet");
    }
    return found;
  }

  /**
   * Writes a new disabled list, with one trail entry describing the change.
   *
   * Shared by the single-move switch and the Waiting for parts switch so both
   * reach the same write, rather than the second growing its own copy that
   * could forget the audit entry.
   */
  function writeDisabled(
    next: readonly TransitionPair[],
    actor: Actor,
    audit: { summaryKey: string; summaryParams: Record<string, string> },
  ): void {
    const current = requireRules();
    context.commit({
      operation: "update",
      collection: "workflowRules",
      id: current.id,
      changes: { disabledTransitions: next },
      actor,
      audit: {
        entity: "demo",
        action: "updated",
        summaryKey: audit.summaryKey,
        summaryParams: audit.summaryParams,
        changes: [
          {
            field: "disabledTransitions",
            from: current.disabledTransitions.length,
            to: next.length,
          },
        ],
      },
    });
  }

  return {
    workflowRules: rules,
    notificationDefaults: () => context.data.notificationDefaults,

    setTransitionEnabled(from, to, enabled, actor) {
      const current = requireRules();
      const pair: TransitionPair = { from, to };
      const already = current.disabledTransitions.some((one) =>
        samePair(one, pair),
      );
      // Nothing to write, and nothing to say: a trail entry for a change that
      // did not happen is a record of an act nobody performed.
      if (already === !enabled) return;

      const next = enabled
        ? current.disabledTransitions.filter((one) => !samePair(one, pair))
        : [...current.disabledTransitions, pair];

      writeDisabled(next, actor, {
        summaryKey: enabled
          ? "audit.workflowMoveEnabled"
          : "audit.workflowMoveDisabled",
        summaryParams: { fromStatus: from, toStatus: to },
      });
    },

    setWaitingForParts(enabled, actor) {
      const current = requireRules();
      if (waitingForPartsEnabled(current) === enabled) return;

      const next = enabled
        ? current.disabledTransitions.filter(
            (one) =>
              !WAITING_FOR_PARTS_EDGES.some((edge) => samePair(one, edge)),
          )
        : [
            ...current.disabledTransitions.filter(
              (one) =>
                !WAITING_FOR_PARTS_EDGES.some((edge) => samePair(one, edge)),
            ),
            ...WAITING_FOR_PARTS_EDGES,
          ];

      writeDisabled(next, actor, {
        summaryKey: enabled
          ? "audit.waitingForPartsEnabled"
          : "audit.waitingForPartsDisabled",
        summaryParams: {},
      });
    },

    setRequireCompletionNote(required, actor) {
      const current = requireRules();
      if (current.requireCompletionNote === required) return;

      context.commit({
        operation: "update",
        collection: "workflowRules",
        id: current.id,
        changes: { requireCompletionNote: required },
        actor,
        audit: {
          entity: "demo",
          action: "updated",
          summaryKey: required
            ? "audit.completionNoteRequired"
            : "audit.completionNoteOptional",
          summaryParams: {},
          changes: [
            {
              field: "requireCompletionNote",
              from: current.requireCompletionNote,
              to: required,
            },
          ],
        },
      });
    },

    setPrioritySla(priority, hours, actor) {
      const current = requireRules();
      if (!Number.isFinite(hours) || hours <= 0) {
        throw new Error("A target is a positive number of hours");
      }
      if (current.prioritySlaHours[priority] === hours) return;

      context.commit({
        operation: "update",
        collection: "workflowRules",
        id: current.id,
        changes: {
          prioritySlaHours: { ...current.prioritySlaHours, [priority]: hours },
        },
        actor,
        audit: {
          entity: "demo",
          action: "updated",
          summaryKey: "audit.prioritySlaChanged",
          summaryParams: { slaPriority: priority, hours },
          changes: [
            {
              field: `prioritySlaHours.${priority}`,
              from: current.prioritySlaHours[priority],
              to: hours,
            },
          ],
        },
      });
    },

    setNotificationDefault(kind, channel, on, actor) {
      const row = context.data.notificationDefaults.find(
        (one) => one.kind === kind,
      );
      if (!row) throw new Error(`No notification default for ${kind}`);
      if (row[channel] === on) return;

      context.commit({
        operation: "update",
        collection: "notificationDefaults",
        id: row.id,
        changes: { [channel]: on },
        actor,
        audit: {
          entity: "demo",
          action: "updated",
          summaryKey: on
            ? "audit.notificationDefaultOn"
            : "audit.notificationDefaultOff",
          summaryParams: { kind, channel },
          changes: [{ field: channel, from: row[channel], to: on }],
        },
      });
    },
  };
}
