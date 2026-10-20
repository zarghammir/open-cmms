"use client";

import { useTranslations } from "next-intl";
import { ScrollableRegion } from "@/components/shared/scrollable-region";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { useWorkflowSettings } from "@/hooks/use-workflow-settings";
import {
  WORK_ORDER_TRANSITIONS,
  WAITING_FOR_PARTS_EDGES,
} from "@/domain/constants/work-order-status";
import type { Role } from "@/domain/constants/roles";
import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  type WorkOrderStatus,
} from "@/domain/types";

/**
 * The moves an organisation allows, and what finishing a job takes.
 *
 * **Every switch here narrows the flow; none widens it.** The panel is drawn
 * from `WORK_ORDER_TRANSITIONS`, so the only moves it can offer are the ones
 * the domain already has — an administrator cannot invent an edge from
 * completed back to open, whatever they do here. That is a property of the
 * data shape rather than of this screen refusing well, which is what makes it
 * true for the keyboard path and for anything added later.
 *
 * The Waiting for parts switch governs two edges at once and is deliberately
 * not a separate rule: one answer to "is this move allowed" rather than two
 * that can disagree. Its two edges are therefore left out of the grid below —
 * showing them twice, once each way, would let somebody set the stage on in one
 * control and off in the other.
 */
export function WorkflowRulesPanel({ role }: { role: Role }) {
  const t = useTranslations("workflowRules");
  const tStatus = useTranslations("workOrderStatus");
  const tPriority = useTranslations("priority");
  const {
    ready,
    editable,
    rules,
    waitingForParts,
    transitionEnabled,
    setTransitionEnabled,
    setWaitingForParts,
    setRequireCompletionNote,
    setPrioritySla,
  } = useWorkflowSettings(role);

  if (!ready || !rules) return <DataTableSkeleton rows={4} columns={3} />;

  /** Every edge the domain has, minus the two the stage switch owns. */
  const edges = WORK_ORDER_STATUSES.flatMap((from) =>
    WORK_ORDER_TRANSITIONS[from].map((to) => ({ from, to })),
  ).filter(
    (edge) =>
      !WAITING_FOR_PARTS_EDGES.some(
        (owned) => owned.from === edge.from && owned.to === edge.to,
      ),
  );

  return (
    <section data-slot="workflow-rules" className="grid gap-2">
      <div>
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {!editable ? (
        <p data-slot="workflow-rules-readonly" className="text-sm">
          {t("readOnly")}
        </p>
      ) : null}

      <div className="grid gap-2 rounded-md border border-border p-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 rounded-sm border-border accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            checked={rules.requireCompletionNote}
            disabled={!editable}
            data-slot="require-note"
            onChange={(event) => setRequireCompletionNote(event.target.checked)}
          />
          {t("requireNote")}
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 rounded-sm border-border accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            checked={waitingForParts}
            disabled={!editable}
            data-slot="waiting-for-parts"
            onChange={(event) => setWaitingForParts(event.target.checked)}
          />
          {t("waitingForParts")}
        </label>
      </div>

      <ScrollableRegion
        label={t("movesCaption")}
        className="rounded-md border border-border"
      >
        <table className="w-full min-w-0 text-sm">
          <caption className="sr-only">{t("movesCaption")}</caption>
          <thead className="bg-muted/40 text-left text-xs">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("columns.move")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("columns.allowed")}
              </th>
            </tr>
          </thead>
          <tbody>
            {edges.map((edge) => (
              <tr
                key={`${edge.from}-${edge.to}`}
                data-slot="workflow-move"
                data-from={edge.from}
                data-to={edge.to}
                className="border-t border-border"
              >
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  {t("move", {
                    from: tStatus(edge.from as WorkOrderStatus),
                    to: tStatus(edge.to as WorkOrderStatus),
                  })}
                </th>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    className="size-4 rounded-sm border-border accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                    checked={transitionEnabled(edge.from, edge.to)}
                    disabled={!editable}
                    /*
                     * Named by the move it governs. A checkbox in a column of
                     * checkboxes is announced as "checkbox" and nothing else,
                     * and there are eight of them here.
                     */
                    aria-label={t("move", {
                      from: tStatus(edge.from as WorkOrderStatus),
                      to: tStatus(edge.to as WorkOrderStatus),
                    })}
                    onChange={(event) =>
                      setTransitionEnabled(
                        edge.from,
                        edge.to,
                        event.target.checked,
                      )
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollableRegion>

      <div className="grid gap-2 rounded-md border border-border p-3">
        <p className="text-sm font-medium">{t("targets")}</p>
        {/*
          Displayed, never enforced — and the panel says so rather than leaving
          a reader to assume. A number that looked enforced and was not would
          be worse than no number at all.
        */}
        <p className="text-xs text-muted-foreground">{t("targetsNote")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {WORK_ORDER_PRIORITIES.map((priority) => (
            <label
              key={priority}
              className="flex items-center justify-between gap-2 text-sm"
            >
              {tPriority(priority)}
              <input
                type="number"
                min={1}
                className="w-24 rounded-md border border-border px-2 py-1 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                value={rules.prioritySlaHours[priority]}
                disabled={!editable}
                data-slot="priority-sla"
                data-priority={priority}
                aria-label={t("targetFor", { priority: tPriority(priority) })}
                onChange={(event) => {
                  const hours = Number(event.target.value);
                  // The repository refuses anything else; this keeps a
                  // half-typed value from being written on every keystroke.
                  if (Number.isFinite(hours) && hours > 0) {
                    setPrioritySla(priority, hours);
                  }
                }}
              />
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}
