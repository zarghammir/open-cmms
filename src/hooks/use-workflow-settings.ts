"use client";

import { useMemo } from "react";
import { useActor, useRepositories } from "@/hooks/use-demo-data";
import { can, type Role } from "@/domain/constants/roles";
import {
  waitingForPartsEnabled as isWaitingForPartsEnabled,
  transitionAvailability,
} from "@/domain/constants/work-order-status";
import type {
  NotificationDefault,
  NotifiableKind,
  WorkflowRule,
  WorkOrderPriority,
  WorkOrderStatus,
} from "@/domain/types";

/**
 * The rules an administrator reads and changes, and whether they may.
 *
 * `editable` is the capability, asked here rather than at each of the fourteen
 * controls the two panels draw. A control that may not be used stays on screen
 * and disabled — the 2026-09-16 ruling — so the panels need the answer, not
 * permission to hide.
 *
 * Three states like every other reader of the store: `ready` is false while the
 * browser is still reading, and a panel that drew its switches in their default
 * positions during that moment would be showing an administrator rules that are
 * not theirs.
 */
export function useWorkflowSettings(role: Role): {
  ready: boolean;
  editable: boolean;
  rules: WorkflowRule | null;
  defaults: NotificationDefault[];
  waitingForParts: boolean;
  transitionEnabled: (from: WorkOrderStatus, to: WorkOrderStatus) => boolean;
  setTransitionEnabled: (
    from: WorkOrderStatus,
    to: WorkOrderStatus,
    enabled: boolean,
  ) => void;
  setWaitingForParts: (enabled: boolean) => void;
  setRequireCompletionNote: (required: boolean) => void;
  setPrioritySla: (priority: WorkOrderPriority, hours: number) => void;
  setNotificationDefault: (
    kind: NotifiableKind,
    channel: "inApp" | "email",
    on: boolean,
  ) => void;
} {
  const { status, repositories } = useRepositories();
  const actor = useActor(role);

  const rules = repositories?.settings.workflowRules() ?? null;
  const defaults = useMemo(
    () => repositories?.settings.notificationDefaults() ?? [],
    [repositories],
  );

  return {
    ready: status === "ready" && repositories !== null && rules !== null,
    editable: can(role, "settings.manage"),
    rules,
    defaults,
    waitingForParts: isWaitingForPartsEnabled(rules),
    transitionEnabled: (from, to) =>
      transitionAvailability(rules, from, to) === "allowed",
    setTransitionEnabled: (from, to, enabled) =>
      repositories?.settings.setTransitionEnabled(from, to, enabled, actor),
    setWaitingForParts: (enabled) =>
      repositories?.settings.setWaitingForParts(enabled, actor),
    setRequireCompletionNote: (required) =>
      repositories?.settings.setRequireCompletionNote(required, actor),
    setPrioritySla: (priority, hours) =>
      repositories?.settings.setPrioritySla(priority, hours, actor),
    setNotificationDefault: (kind, channel, on) =>
      repositories?.settings.setNotificationDefault(kind, channel, on, actor),
  };
}
