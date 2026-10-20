"use client";

import { useMemo } from "react";
import { CircleCheck, CircleSlash } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableFacetFilter } from "@/components/data-table/data-table-facet-filter";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useDataTable } from "@/components/data-table/use-data-table";
import { matchesFacet } from "@/components/data-table/facets";
import type { PrioritisedColumn } from "@/components/data-table/column-priority";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { StatusChip } from "@/components/shared/status-chip";
import { Button } from "@/components/ui/button";
import { NoResultsState } from "@/components/shared/state-panels";
import { ModulePanel } from "@/components/shared/module-panel";
import { useDemoData, useRepositories } from "@/hooks/use-demo-data";
import { textFor } from "@/lib/localized-text";
import { matchesPlanSearch, type PlanRow } from "./rows";

/**
 * Eight columns and one long one — the plan's name, 44 characters in English
 * and 58 in French. Lighter than the visits table, which carries two, and it
 * still did not fit.
 *
 * Measured: 791 px in English and 835 in French inside 718 at 1024, and 1121 in
 * French against 1134 at 1440 — over the floor rather than over the edge, which
 * is the case a screenshot would have shown as fine.
 *
 * The name's cap comes down, and **the frequency drops to priority 3**. It is
 * the widest label on the table in French ("Deux fois par année") and it is the
 * one column here whose facet answers the same question better: a planner
 * asking "what is quarterly?" filters rather than reads down a column.
 */
const COLUMN_PRIORITIES: readonly PrioritisedColumn[] = [
  { id: "code", priority: 1 },
  { id: "name", priority: 1 },
  { id: "active", priority: 1 },
  { id: "assetTypeLabel", priority: 2 },
  { id: "scheduleCount", priority: 2 },
  { id: "frequencyLabel", priority: 3 },
  { id: "leadTimeDays", priority: 3 },
  { id: "estimatedMinutes", priority: 3 },
];

const columnHelper = createColumnHelper<DataTableFeatures, PlanRow>();

/**
 * The maintenance plans: what is serviced, how often, and how many machines
 * are on each.
 *
 * A plan with no equipment on it is the row worth looking at, which is why the
 * count is a column rather than a footnote: a plan nobody is on services
 * nothing, and it is invisible on the visits table by definition.
 */
export function PlansScreen() {
  const { status } = useDemoData();
  const { repositories } = useRepositories();
  const locale = useLocale();
  const format = useFormatter();
  const t = useTranslations("plansTable");
  const tFrequency = useTranslations("scheduleFrequency");
  const tDataTable = useTranslations("dataTable");

  const rows = useMemo<PlanRow[]>(() => {
    if (!repositories) return [];

    const typesById = new Map(
      repositories.assets.types().map((type) => [type.id, type]),
    );
    const schedules = repositories.maintenance.schedules();
    const counts = new Map<string, number>();
    for (const schedule of schedules) {
      counts.set(schedule.planId, (counts.get(schedule.planId) ?? 0) + 1);
    }

    return repositories.maintenance.plans().map((plan) => {
      const type = typesById.get(plan.assetTypeId);
      return {
        id: plan.id,
        code: plan.code,
        name: textFor(plan.name, locale),
        // A plan naming an equipment type this system cannot read still has a
        // name and an interval, so it is a row — the type is what is unknown,
        // and the id is shown rather than a blank.
        assetTypeLabel: type ? textFor(type.label, locale) : plan.assetTypeId,
        frequency: plan.frequency,
        frequencyLabel: tFrequency(plan.frequency),
        leadTimeDays: plan.leadTimeDays,
        estimatedMinutes: plan.estimatedMinutes,
        scheduleCount: counts.get(plan.id) ?? 0,
        active: plan.active,
      };
    });
  }, [repositories, locale, tFrequency]);

  const columns = useMemo(
    () =>
      [
        columnHelper.accessor("code", {
          id: "code",
          header: t("columns.code"),
          enableHiding: false,
          cell: (cell) => (
            <span className="font-mono text-xs font-medium">
              {cell.getValue()}
            </span>
          ),
        }),
        columnHelper.accessor("name", {
          id: "name",
          header: t("columns.name"),
          cell: (cell) => (
            <span
              className="block max-w-[12rem] truncate xl:max-w-[18rem]"
              title={cell.getValue()}
            >
              {cell.getValue()}
            </span>
          ),
        }),
        columnHelper.accessor((row) => (row.active ? "active" : "inactive"), {
          id: "active",
          header: t("columns.state"),
          filterFn: (row, columnId, value) =>
            matchesFacet(String(row.getValue(columnId)), value as string[]),
          cell: (cell) => (
            <StatusChip
              tone={cell.row.original.active ? "positive" : "quiet"}
              icon={cell.row.original.active ? CircleCheck : CircleSlash}
              label={cell.row.original.active ? t("active") : t("inactive")}
            />
          ),
        }),
        columnHelper.accessor("assetTypeLabel", {
          id: "assetTypeLabel",
          header: t("columns.equipment"),
          filterFn: (row, columnId, value) =>
            matchesFacet(String(row.getValue(columnId)), value as string[]),
          cell: (cell) => (
            <span
              className="block max-w-[8rem] truncate"
              title={cell.getValue()}
            >
              {cell.getValue()}
            </span>
          ),
        }),
        columnHelper.accessor("frequencyLabel", {
          id: "frequencyLabel",
          header: t("columns.frequency"),
          filterFn: (row, columnId, value) =>
            matchesFacet(String(row.getValue(columnId)), value as string[]),
        }),
        columnHelper.accessor("scheduleCount", {
          id: "scheduleCount",
          header: t("columns.onPlan"),
          /*
           * Zero is drawn as a sentence rather than a nought.
           *
           * A plan with nothing on it services nothing, and it cannot appear on
           * the visits table at all — so this column is the only place it can
           * be noticed. "0" in a column of counts reads as a rounding; "no
           * equipment" reads as the problem it is.
           */
          cell: (cell) =>
            cell.getValue() === 0 ? (
              <span className="text-muted-foreground">{t("noEquipment")}</span>
            ) : (
              <span className="tabular-nums">
                {format.number(cell.getValue(), "integer")}
              </span>
            ),
        }),
        columnHelper.accessor("leadTimeDays", {
          id: "leadTimeDays",
          header: t("columns.leadTime"),
          cell: (cell) => (
            <span className="tabular-nums">
              {t("days", { days: cell.getValue() })}
            </span>
          ),
        }),
        columnHelper.accessor("estimatedMinutes", {
          id: "estimatedMinutes",
          header: t("columns.estimate"),
          cell: (cell) => (
            <span className="tabular-nums">
              {t("minutes", { minutes: cell.getValue() })}
            </span>
          ),
        }),
      ] as ColumnDef<DataTableFeatures, PlanRow, unknown>[],
    [t, format],
  );

  const { table, breakpoint } = useDataTable({
    data: rows,
    columns,
    priorities: COLUMN_PRIORITIES,
    globalFilterFn: (row, _columnId, filterValue) =>
      matchesPlanSearch(row.original, String(filterValue ?? "")),
  });

  if (status !== "ready" || !repositories) {
    return <DataTableSkeleton columns={6} />;
  }

  const columnLabels: Record<string, string> = {
    name: t("columns.name"),
    active: t("columns.state"),
    assetTypeLabel: t("columns.equipment"),
    frequencyLabel: t("columns.frequency"),
    scheduleCount: t("columns.onPlan"),
    leadTimeDays: t("columns.leadTime"),
    estimatedMinutes: t("columns.estimate"),
  };

  return (
    <div className="flex flex-col gap-3">
      <DataTableToolbar
        table={table}
        label={t("searchLabel")}
        searchPlaceholder={t("searchPlaceholder")}
        columnLabels={columnLabels}
        filters={
          <>
            <DataTableFacetFilter
              column={table.getColumn("assetTypeLabel")!}
              label={t("columns.equipment")}
              optionLabel={(value) => value}
            />
            <DataTableFacetFilter
              column={table.getColumn("frequencyLabel")!}
              label={t("columns.frequency")}
              optionLabel={(value) => value}
            />
            <DataTableFacetFilter
              column={table.getColumn("active")!}
              label={t("columns.state")}
              optionLabel={(value) =>
                value === "active" ? t("active") : t("inactive")
              }
            />
          </>
        }
      />

      <DataTable
        table={table}
        breakpoint={breakpoint}
        caption={t("caption")}
        empty={<ModulePanel moduleKey="preventiveMaintenance" />}
        noResults={
          <NoResultsState
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  table.setGlobalFilter("");
                  table.resetColumnFilters();
                }}
              >
                {tDataTable("clearFilters")}
              </Button>
            }
          />
        }
        renderCard={(row) => (
          <article className="flex flex-col gap-1 rounded-md border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-medium">
                {row.original.code}
              </span>
              <StatusChip
                tone={row.original.active ? "positive" : "quiet"}
                icon={row.original.active ? CircleCheck : CircleSlash}
                label={row.original.active ? t("active") : t("inactive")}
              />
            </div>
            <p className="text-sm font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.frequencyLabel} ·{" "}
              {row.original.scheduleCount === 0
                ? t("noEquipment")
                : t("onPlan", { count: row.original.scheduleCount })}
            </p>
          </article>
        )}
      />

      <DataTablePagination table={table} />
    </div>
  );
}
