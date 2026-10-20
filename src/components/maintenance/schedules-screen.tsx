"use client";

import { useMemo } from "react";
import { CalendarPlus, Play } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableFacetFilter } from "@/components/data-table/data-table-facet-filter";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableRowActions } from "@/components/data-table/data-table-row-actions";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useDataTable } from "@/components/data-table/use-data-table";
import { matchesFacet } from "@/components/data-table/facets";
import type { PrioritisedColumn } from "@/components/data-table/column-priority";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { Button } from "@/components/ui/button";
import { NoResultsState } from "@/components/shared/state-panels";
import { ModulePanel } from "@/components/shared/module-panel";
import { can, type Role } from "@/domain/constants/roles";
import { useActor, useDemoData, useRepositories } from "@/hooks/use-demo-data";
import { useToday } from "@/hooks/use-today";
import { useScheduleRows } from "@/hooks/use-schedule-rows";
import { calendarDate } from "@/lib/dates";
import { Link } from "@/i18n/navigation";
import { matchesScheduleSearch, type ScheduleRow } from "./rows";

/**
 * Nine columns, two of them long text — the asset's name and the plan's, 47 and
 * 44 characters in English against 57 and 58 in French.
 *
 * **Measured before any of this was chosen, and it was worse than the assets
 * register.** In a 718 px container at 1024 the table needed 839 px in English
 * and 878 in French; at 1440 it needed 1109 and **1218** against 1134, so
 * French failed at the desktop width too, by 84 px — the largest desktop
 * deficit measured on any table here. The assets register failed at 1440 as
 * well before WA-65, at 45 and 17; this is what a *second* column over fifty
 * characters costs on top of the first.
 *
 * The caps were then cut again after continuous integration went red on the
 * one line that had least room. The runner needed **1110 px** where this
 * machine needs 1090 — 1.8% wider — and 44 px of local headroom became 24
 * against a 28 px floor. The number to design against is therefore not the
 * floor but `floor + 0.018 x minContent`: about 47 px at 1440 and 31 at 1024.
 * `1024 fr` cleared that by under four pixels and was cut with it, because a
 * line that passes by four pixels is a line waiting for the next long word.
 *
 * Two levers, both chosen from those numbers. The name caps come down, and
 * **the next-due date drops to priority 3**: the `due` column already says "12
 * days late" or "in 8 days", which is the part a planner acts on, so at 1024
 * the exact date was the same fact told twice and the wider of the two ways.
 * The site column stays at priority 2 because its facet is how the ticket's
 * facility filter is reached, and a column that disappears with its filter
 * still in the toolbar is confusing in a way a missing date is not.
 */
const COLUMN_PRIORITIES: readonly PrioritisedColumn[] = [
  { id: "assetTag", priority: 1 },
  { id: "assetName", priority: 1 },
  { id: "due", priority: 1 },
  { id: "planName", priority: 2 },
  { id: "facilityCity", priority: 2 },
  { id: "nextDueOn", priority: 3 },
  { id: "frequencyLabel", priority: 3 },
  { id: "lastCompletedOn", priority: 3 },
  { id: "actions", priority: 1 },
];

const columnHelper = createColumnHelper<DataTableFeatures, ScheduleRow>();

/**
 * Every planned visit, soonest first.
 *
 * This is the planner's working screen: what is late, what can be raised now,
 * and what is merely coming. Reads through the maintenance repository, never
 * the store, and draws a skeleton until the records are read — an empty table
 * would say this organisation plans no maintenance, which is a different claim
 * from not knowing yet.
 */
export function SchedulesScreen({ role }: { role: Role }) {
  const { status } = useDemoData();
  const { repositories } = useRepositories();
  const format = useFormatter();
  const today = useToday();
  const actor = useActor(role);
  const t = useTranslations("maintenanceTable");
  const tDataTable = useTranslations("dataTable");

  const mayPlan = can(role, "plan.edit");

  // Both views of these records read them through one hook, so "12 days late"
  // and "could not be read" cannot differ between the list and the month.
  const { rows, unreadable } = useScheduleRows();

  const columns = useMemo(
    () =>
      [
        columnHelper.accessor("assetTag", {
          id: "assetTag",
          header: t("columns.asset"),
          enableHiding: false,
          cell: (cell) => (
            <Link
              href={`/assets/${cell.getValue()}`}
              className="rounded-sm font-mono text-xs font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {cell.getValue()}
            </Link>
          ),
        }),
        columnHelper.accessor("assetName", {
          id: "assetName",
          header: t("columns.assetName"),
          cell: (cell) => (
            <span
              className="block max-w-[8rem] truncate xl:max-w-[11rem]"
              title={cell.getValue()}
            >
              {cell.getValue()}
            </span>
          ),
        }),
        columnHelper.accessor("planName", {
          id: "planName",
          header: t("columns.plan"),
          cell: (cell) => (
            <span
              className="block max-w-[8rem] truncate xl:max-w-[11rem]"
              title={cell.getValue()}
            >
              {cell.getValue()}
            </span>
          ),
        }),
        columnHelper.accessor((row) => row.due.kind, {
          id: "due",
          header: t("columns.due"),
          filterFn: (row, columnId, value) =>
            matchesFacet(String(row.getValue(columnId)), value as string[]),
          /*
           * The answer in words, not a date to compare. `late` is red because
           * it is the only one that is a problem; `soon` is the one a planner
           * can act on, and it is deliberately distinguished from `ahead`,
           * which cannot be raised yet — a row that looks actionable and is not
           * is worse than one that says so.
           */
          cell: (cell) => {
            const due = cell.row.original.due;
            if (due.kind === "late") {
              return (
                <span className="text-status-critical tabular-nums">
                  {t("due.late", { days: due.days })}
                </span>
              );
            }
            if (due.kind === "today") return <span>{t("due.today")}</span>;
            return (
              <span
                className={
                  due.kind === "soon"
                    ? "tabular-nums"
                    : "text-muted-foreground tabular-nums"
                }
              >
                {t("due.inDays", { days: due.days })}
              </span>
            );
          },
        }),
        columnHelper.accessor("nextDueOn", {
          id: "nextDueOn",
          header: t("columns.nextDue"),
          cell: (cell) => (
            <span className="tabular-nums">
              {format.dateTime(calendarDate(cell.getValue()), "day")}
            </span>
          ),
        }),
        columnHelper.accessor((row) => row.facilityCity, {
          id: "facilityCity",
          header: t("columns.site"),
          filterFn: (row, columnId, value) =>
            matchesFacet(String(row.getValue(columnId)), value as string[]),
          // The city, with the site's full name as the accessible name — the
          // lesson WA-64 shipped and had to correct: name-from-content beats
          // `title`, so a cell showing the city announces the city unless the
          // name is given explicitly.
          cell: (cell) => (
            <span
              aria-label={cell.row.original.facilityName}
              title={cell.row.original.facilityName}
            >
              {cell.row.original.facilityCity}
            </span>
          ),
        }),
        columnHelper.accessor("frequencyLabel", {
          id: "frequencyLabel",
          header: t("columns.frequency"),
          filterFn: (row, columnId, value) =>
            matchesFacet(String(row.getValue(columnId)), value as string[]),
        }),
        columnHelper.accessor("lastCompletedOn", {
          id: "lastCompletedOn",
          header: t("columns.lastDone"),
          cell: (cell) => {
            const value = cell.getValue();
            // Never serviced is not the same as serviced on an unknown date.
            return value === null ? (
              <span className="text-muted-foreground">{t("neverDone")}</span>
            ) : (
              <span className="tabular-nums">
                {format.dateTime(calendarDate(value), "day")}
              </span>
            );
          },
        }),
        columnHelper.display({
          id: "actions",
          header: () => <span className="sr-only">{t("columns.actions")}</span>,
          enableHiding: false,
          cell: (cell) => {
            const row = cell.row.original;
            /*
             * The order already raised, named rather than offered again. A
             * menu that showed "Generate" on a visit that has one would be
             * offering a move the repository refuses.
             */
            if (row.openOrderNumber) {
              return (
                <Link
                  href={`/work-orders/${row.openOrderNumber}`}
                  className="rounded-sm font-mono text-xs text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {row.openOrderNumber}
                </Link>
              );
            }
            if (!mayPlan || row.due.kind === "ahead") return null;

            return (
              <DataTableRowActions
                label={t("rowActions", { asset: row.assetTag })}
                actions={[
                  {
                    key: "generate",
                    label: t("actions.generate"),
                    icon: <CalendarPlus data-icon="inline-start" />,
                    onSelect: () => {
                      if (!repositories) return;
                      const order = repositories.maintenance.generate(
                        row.id,
                        actor,
                      );
                      toast.success(
                        t("actions.generated", {
                          number: order.number,
                          asset: row.assetTag,
                        }),
                      );
                    },
                  },
                ]}
              />
            );
          },
        }),
      ] as ColumnDef<DataTableFeatures, ScheduleRow, unknown>[],
    [t, format, mayPlan, repositories, actor],
  );

  const { table, breakpoint } = useDataTable({
    data: rows,
    columns,
    priorities: COLUMN_PRIORITIES,
    globalFilterFn: (row, _columnId, filterValue) =>
      matchesScheduleSearch(row.original, String(filterValue ?? "")),
  });

  if (status !== "ready" || !repositories) {
    return <DataTableSkeleton columns={6} />;
  }

  const dueNow = repositories.maintenance.due(today).length;

  const columnLabels: Record<string, string> = {
    assetName: t("columns.assetName"),
    planName: t("columns.plan"),
    due: t("columns.due"),
    nextDueOn: t("columns.nextDue"),
    facilityCity: t("columns.site"),
    frequencyLabel: t("columns.frequency"),
    lastCompletedOn: t("columns.lastDone"),
  };

  return (
    <div className="flex flex-col gap-3">
      {unreadable > 0 ? (
        /*
         * Named, not dropped. These visits cannot be rows — every column names
         * the plan or the asset and a planner has nothing to act on — but a
         * table quietly shorter than the records is worse than one that says
         * what is missing from it.
         */
        <p
          data-slot="schedules-unreadable"
          className="text-sm text-muted-foreground"
        >
          {t("unreadable", { count: unreadable })}
        </p>
      ) : null}

      <DataTableToolbar
        table={table}
        label={t("searchLabel")}
        searchPlaceholder={t("searchPlaceholder")}
        columnLabels={columnLabels}
        filters={
          <>
            <DataTableFacetFilter
              column={table.getColumn("facilityCity")!}
              label={t("columns.site")}
              optionLabel={(value) => value}
            />
            <DataTableFacetFilter
              column={table.getColumn("frequencyLabel")!}
              label={t("columns.frequency")}
              optionLabel={(value) => value}
            />
            <DataTableFacetFilter
              column={table.getColumn("due")!}
              label={t("columns.due")}
              optionLabel={(value) =>
                t(`dueKind.${value}` as "dueKind.late") ?? value
              }
            />
            {mayPlan && dueNow > 0 ? (
              /*
               * The sweep. It raises one order per due visit, each its own act
               * — so the confirmation names the count rather than saying "done",
               * and a planner can see whether it matched what they expected
               * before going to look at the queue.
               */
              <Button
                size="sm"
                onClick={() => {
                  const result = repositories.maintenance.runDue(today, actor);
                  toast.success(
                    t("actions.sweptCount", {
                      count: result.generated.length,
                    }),
                  );
                  for (const refusal of result.refused) {
                    toast.error(
                      t("actions.refused", { schedule: refusal.scheduleId }),
                    );
                  }
                }}
              >
                <Play data-icon="inline-start" />
                {t("actions.runDue", { count: dueNow })}
              </Button>
            ) : null}
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
              <Link
                href={`/assets/${row.original.assetTag}`}
                className="inline-flex min-h-11 items-center rounded-sm font-mono text-xs font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {row.original.assetTag}
              </Link>
              <span className="text-xs tabular-nums">
                {row.original.due.kind === "late"
                  ? t("due.late", { days: row.original.due.days })
                  : row.original.due.kind === "today"
                    ? t("due.today")
                    : t("due.inDays", { days: row.original.due.days })}
              </span>
            </div>
            <p className="text-sm font-medium">{row.original.planName}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.assetName} · {row.original.facilityCity}
            </p>
          </article>
        )}
      />

      <DataTablePagination table={table} />
    </div>
  );
}
