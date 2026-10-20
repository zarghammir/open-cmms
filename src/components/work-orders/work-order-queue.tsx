"use client";

import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { useFormatter, useLocale, useTranslations } from "next-intl";
// `useSearchParams` has no locale-aware counterpart: it reads the query string,
// which the locale prefix does not touch. `Link` and `usePathname` do.
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { useDataTable } from "@/components/data-table/use-data-table";
import type { PrioritisedColumn } from "@/components/data-table/column-priority";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { ModulePanel } from "@/components/shared/module-panel";
import { NoResultsState } from "@/components/shared/state-panels";
import {
  WorkOrderPriorityChip,
  WorkOrderStatusChip,
} from "@/components/shared/work-order-chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MultiFacet, SingleFacet } from "@/components/work-orders/queue-facets";
import {
  isQueueFiltered,
  readQueueFilter,
  writeQueueParams,
} from "@/components/work-orders/queue-params";
import {
  DUE_WINDOWS,
  type AssigneeFacet,
  type DueWindow,
  type WorkOrderRow,
} from "@/components/work-orders/work-order-rows";
import {
  filterWorkOrderRows,
  workOrderRows,
  type WorkOrderQueueFilter,
} from "@/data/selectors/work-order-queue";
import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  WORK_ORDER_TYPES,
  type WorkOrderPriority,
  type WorkOrderStatus,
  type WorkOrderType,
} from "@/domain/types/work-order";
import { useDemoData } from "@/hooks/use-demo-data";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { calendarDate } from "@/lib/dates";
import { useToday } from "@/hooks/use-today";

/**
 * The work-order queue.
 *
 * The address is the source of truth. Rows are narrowed by the selector before
 * the table ever sees them, rather than by the table's own column filters, for
 * two reasons: a filtered queue has to be linkable, and two of the six facets —
 * the due window and who it is assigned to — are derived rather than column
 * values, so the table could not express them anyway.
 *
 * What the table is still doing is everything it is good at: columns, sorting
 * in the reader's language, column priority at each width, cards at 390,
 * pagination.
 */
/*
 * Five columns did not fit at 1024, so the due date was cut off and the table
 * scrolled sideways inside itself to reach it.
 *
 * That is the failure column priority exists to prevent. The rule is not "drop
 * the least important thing", it is that **what survives a width has to fit
 * in it** — a column that is present and unreadable is worse than one that is
 * honestly absent, because a reader cannot tell a truncated date from a short
 * one without dragging the table.
 *
 * So the priority chip is the one that goes at tablet width. It loses the least:
 * priority is a facet, so a coordinator who wants to see critical work first
 * filters for it and every remaining row is critical. The due date cannot be
 * recovered that way — "12 days late" is the thing this queue exists to put in
 * front of somebody, and no filter substitutes for reading it.
 */
const COLUMN_PRIORITIES: readonly PrioritisedColumn[] = [
  { id: "number", priority: 1 },
  { id: "title", priority: 1 },
  { id: "status", priority: 1 },
  { id: "dueOn", priority: 2 },
  { id: "priority", priority: 3 },
  { id: "assignee", priority: 3 },
  { id: "facilityName", priority: 3 },
];

const columnHelper = createColumnHelper<DataTableFeatures, WorkOrderRow>();

export function WorkOrderQueue() {
  const { status, data } = useDemoData();
  const t = useTranslations("workOrderQueue");
  const tStatus = useTranslations("workOrderStatus");
  const tPriority = useTranslations("priority");
  const tType = useTranslations("workOrderType");
  const format = useFormatter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const today = useToday();
  const facilityIds = useMemo(
    () => (data ? data.facilities.map((facility) => facility.id) : []),
    [data],
  );
  // The address string, not the params object: the object is a new identity on
  // every render and would defeat the memo it is a dependency of.
  const address = searchParams.toString();
  const filter = useMemo(
    () => readQueueFilter(new URLSearchParams(address), facilityIds),
    [address, facilityIds],
  );

  const rows = useMemo(
    () => (data ? workOrderRows(data, today, locale) : []),
    [data, today, locale],
  );
  const visible = useMemo(
    () => filterWorkOrderRows(rows, filter, today),
    [rows, filter, today],
  );

  function apply(next: Partial<WorkOrderQueueFilter>) {
    const merged = { ...filter, ...next };
    router.replace(
      { pathname, query: writeQueueParams(merged) },
      { scroll: false },
    );
  }

  const assigneeOptions: AssigneeFacet[] = useMemo(
    () => [
      "anyone",
      "unassigned",
      "crew",
      ...(data
        ? data.users.filter((u) => u.role === "technician").map((u) => u.id)
        : []),
    ],
    [data],
  );

  const columns = useMemo(
    () =>
      [
        columnHelper.accessor("number", {
          id: "number",
          header: t("columns.number"),
          enableHiding: false,
          /*
           * A link now that `/work-orders/[number]` exists. Part 1 shipped this
           * as text on purpose — WA-10's line is that a row linking to a page
           * that does not exist is a dead end in a demonstration — and part 2
           * is where the destination arrives.
           */
          cell: (cell) => (
            <Link
              href={`/work-orders/${cell.getValue()}`}
              className="rounded-sm font-mono text-xs font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {cell.getValue()}
            </Link>
          ),
        }),
        columnHelper.accessor("title", {
          id: "title",
          header: t("columns.title"),
          /*
           * The only column here that can give, and the reason the table has
           * any slack at all.
           *
           * Every cell in the shared table is `whitespace-nowrap`, so each
           * column's minimum width is its longest string and the table's
           * minimum is the sum of them — a number that moves with the font.
           * Measured before this cap, French at 1024 fit its container by
           * **one pixel**, which is why continuous integration failed on Linux
           * while this machine passed: the same glyphs lay out about 1.5%
           * wider there, and one pixel does not absorb that.
           *
           * Capping the title gives the table somewhere to put the difference.
           * It is the right column to cap because it is the only one holding
           * free text a person wrote, the number, status and due date beside
           * it stay whole, and the full title is on the cell and one click
           * away. The cap lifts at `xl`, so desktop renders exactly as before.
           */
          cell: (cell) => (
            <span
              className="block max-w-[22rem] truncate xl:max-w-none"
              title={cell.getValue()}
            >
              {cell.getValue()}
            </span>
          ),
        }),
        columnHelper.accessor("status", {
          id: "status",
          header: t("columns.status"),
          cell: (cell) => <WorkOrderStatusChip status={cell.getValue()} />,
        }),
        columnHelper.accessor("priority", {
          id: "priority",
          header: t("columns.priority"),
          cell: (cell) => <WorkOrderPriorityChip priority={cell.getValue()} />,
        }),
        columnHelper.accessor("dueOn", {
          id: "dueOn",
          header: t("columns.due"),
          cell: (cell) => {
            const row = cell.row.original;
            if (row.daysLate !== null) {
              return (
                <span className="text-status-critical tabular-nums">
                  {t("daysLate", { days: row.daysLate })}
                </span>
              );
            }
            const value = cell.getValue();
            return (
              <span className="tabular-nums">
                {value
                  ? format.dateTime(calendarDate(value), "day")
                  : t("noDueDate")}
              </span>
            );
          },
        }),
        columnHelper.accessor("assigneeName", {
          id: "assignee",
          header: t("columns.assignee"),
          cell: (cell) => {
            const row = cell.row.original;
            // Three answers, drawn as three. A crew code with nobody behind it
            // is shown as the code, because that is what the record says and
            // "unassigned" would be a different claim.
            if (row.assigneeName) return <span>{row.assigneeName}</span>;
            if (row.crewCode) {
              return <span className="font-mono text-xs">{row.crewCode}</span>;
            }
            return (
              <span className="text-muted-foreground">{t("unassigned")}</span>
            );
          },
        }),
        columnHelper.accessor((row) => row.facilityCity, {
          id: "facilityName",
          header: t("columns.facility"),
          /*
           * Sorted on what it shows.
           *
           * The accessor was `facilityName` while the cell rendered the city,
           * so the column sorted by one value and displayed another. English
           * hid it — every English site name begins with its city — and French
           * does not: four sites are "Laboratoire régional de …" and one is
           * "Laboratoire central d'Kingston", so ordering by name put Kingston
           * first and the column read Kingston, Regina, Kamloops,
           * Sudbury, Moncton. Sorted, and indistinguishable from
           * unsorted to the person reading it.
           *
           * **The accessor is the fix.** Sorting follows the value the column
           * is built on, so pointing it at the city is what makes the order
           * and the display the same thing. `sortFn` is here for the tiebreak
           * only.
           *
           * The tiebreak — two sites sharing a city — is **reachable but not
           * tested**: the seed has five sites in five cities, so no fixture
           * reaches that branch. Said plainly rather than left to look like
           * coverage, because a branch nobody exercises is a branch nobody
           * knows the behaviour of.
           */
          sortFn: (a, b) =>
            a.original.facilityCity.localeCompare(
              b.original.facilityCity,
              locale,
            ) ||
            a.original.facilityName.localeCompare(
              b.original.facilityName,
              locale,
            ),
          /*
           * The city, with the full name on the cell — and deliberately not a
           * truncation of the name.
           *
           * This column was the widest contributor to the French table at 1440
           * (247 px of the 1168 it needed against 1134 available), so it is the
           * one that has to give. Truncating it at the end would read
           * "Laboratoire régional de Sain…" — and **four of the five sites
           * share that prefix**, so the part that survives distinguishes
           * nothing and the part that is cut is the only thing a reader is
           * scanning for. That is worse than a narrow column; it is a column
           * with no information in it.
           *
           * The city is not a shortening of the name, it is a different and
           * shorter true value, so nothing is cut mid-word. The full name is
           * the cell's accessible name and shows on hover, and the card at 390
           * still renders the name in full.
           *
           * Not the site code either: the asset tags embed it, but a Site
           * column reading "MCT" asks a reader to know a legend that is not on
           * the screen.
           */
          /*
           * The city on the screen, the whole site name in the accessible name.
           *
           * The first version of this was `<span title={name}>{city}</span>`
           * and the body claimed the full name was the cell's accessible name.
           * **It was not.** Name-from-content wins over `title`, so the
           * accessible name became the city and the `title` was never
           * consulted — which means that version *removed* the site name from
           * what a screen reader announces, where the cell had carried it
           * before. A claim in the opposite direction of the effect.
           *
           * `aria-label` replaces the computed name, so the cell announces
           * "Laboratoire régional de Moncton" while the column reads
           * "Moncton". Unlike WA-50's title column — where the text and the
           * `title` are the same string and only CSS shortens it, so the name
           * stays whole by itself — here the visible text is a genuinely
           * different value, so the name has to be supplied.
           *
           * `title` stays for a pointer, but it is not the accommodation: it
           * reaches a mouse and neither a keyboard nor a touch screen, which
           * is why it cannot be the answer on its own.
           */
          cell: (cell) => (
            <span
              aria-label={cell.row.original.facilityName}
              title={cell.row.original.facilityName}
            >
              {cell.row.original.facilityCity}
            </span>
          ),
        }),
      ] as ColumnDef<DataTableFeatures, WorkOrderRow, unknown>[],
    [t, format],
  );

  const { table, breakpoint } = useDataTable({
    data: visible,
    columns,
    priorities: COLUMN_PRIORITIES,
  });

  if (status !== "ready" || !data) {
    return <DataTableSkeleton rows={6} columns={4} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          aria-label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          defaultValue={filter.query}
          onChange={(event) => apply({ query: event.target.value })}
          className="h-7 w-56"
        />
        <MultiFacet<WorkOrderStatus>
          label={t("columns.status")}
          options={WORK_ORDER_STATUSES}
          selected={filter.status}
          optionLabel={(value) => tStatus(value)}
          onChange={(status) => apply({ status })}
        />
        <MultiFacet<WorkOrderPriority>
          label={t("columns.priority")}
          options={WORK_ORDER_PRIORITIES}
          selected={filter.priority}
          optionLabel={(value) => tPriority(value)}
          onChange={(priority) => apply({ priority })}
        />
        <MultiFacet<WorkOrderType>
          label={t("columns.type")}
          options={WORK_ORDER_TYPES}
          selected={filter.type}
          optionLabel={(value) => tType(value)}
          onChange={(type) => apply({ type })}
        />
        <SingleFacet<DueWindow>
          label={t("columns.due")}
          options={DUE_WINDOWS}
          value={filter.due}
          optionLabel={(value) => t(`due.${value}`)}
          onChange={(due) => apply({ due })}
        />
        <SingleFacet<AssigneeFacet>
          label={t("columns.assignee")}
          options={assigneeOptions}
          value={filter.assignee}
          optionLabel={(value) =>
            value === "anyone" || value === "unassigned" || value === "crew"
              ? t(`assignee.${value}`)
              : (data.users.find((user) => user.id === value)?.lastName ??
                value)
          }
          onChange={(assignee) => apply({ assignee })}
        />
        <SingleFacet<string>
          label={t("columns.facility")}
          options={["", ...facilityIds]}
          value={filter.facilityId ?? ""}
          optionLabel={(value) =>
            value === ""
              ? t("allSites")
              : (data.facilities.find((f) => f.id === value)?.name[
                  locale.startsWith("fr") ? "fr" : "en"
                ] ?? value)
          }
          onChange={(facilityId) =>
            apply({ facilityId: facilityId === "" ? undefined : facilityId })
          }
        />

        {isQueueFiltered(filter) ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.replace({ pathname, query: {} })}
          >
            {t("clearAll")}
          </Button>
        ) : null}

        <span
          aria-live="polite"
          className="ml-auto text-xs text-muted-foreground tabular-nums"
        >
          {t("showing", { shown: visible.length, total: rows.length })}
        </span>
      </div>

      <DataTable
        table={table}
        breakpoint={breakpoint}
        caption={t("caption")}
        /*
         * The table decides between "empty" and "no results" from its own
         * filter state, and this queue filters before the table sees the rows —
         * so an unmatched search arrives as a table with no data at all and
         * would draw "here is what this module will hold". That tells someone
         * who just searched that the module is unbuilt rather than that their
         * search found nothing. The address knows which it is, so it chooses.
         */
        empty={
          isQueueFiltered(filter) ? (
            <NoResultsState
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.replace({ pathname, query: {} })}
                >
                  {t("clearAll")}
                </Button>
              }
            />
          ) : (
            <ModulePanel moduleKey="workOrders" />
          )
        }
        noResults={
          <NoResultsState
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.replace({ pathname, query: {} })}
              >
                {t("clearAll")}
              </Button>
            }
          />
        }
        renderCard={(row) => (
          <article className="flex flex-col gap-1 rounded-md border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/work-orders/${row.original.number}`}
                className="rounded-sm font-mono text-xs font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {row.original.number}
              </Link>
              <WorkOrderPriorityChip priority={row.original.priority} />
            </div>
            <p className="text-sm font-medium">{row.original.title}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.facilityName}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <WorkOrderStatusChip status={row.original.status} />
              {row.original.daysLate !== null ? (
                <span className="text-xs text-status-critical">
                  {t("daysLate", { days: row.original.daysLate })}
                </span>
              ) : null}
            </div>
          </article>
        )}
      />

      <DataTablePagination table={table} />
    </div>
  );
}
