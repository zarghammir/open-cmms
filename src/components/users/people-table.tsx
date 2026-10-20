"use client";

import { useMemo } from "react";
import { CircleCheck, CircleSlash } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableFacetFilter } from "@/components/data-table/data-table-facet-filter";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useDataTable } from "@/components/data-table/use-data-table";
import type { PrioritisedColumn } from "@/components/data-table/column-priority";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { ModulePanel } from "@/components/shared/module-panel";
import { NoResultsState } from "@/components/shared/state-panels";
import { StatusChip } from "@/components/shared/status-chip";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { CapabilityAction } from "@/components/shared/capability-action";
import { EditPersonDialog } from "./edit-person-dialog";
import type { Role } from "@/domain/constants/roles";
import { usePeople } from "@/hooks/use-people";
import { textFor } from "@/lib/localized-text";
import { fullName } from "@/domain/types/user";
import { matchesPersonSearch, type PeopleTableRow } from "./rows";

/**
 * Who works here, and out of where.
 *
 * The name and the site are what somebody administering people reads down; the
 * role is a facet rather than a column to scan, because the question asked of
 * this screen is almost always "who are the technicians at Kingston" rather than
 * "what is this one person's role".
 *
 * The employee number keeps priority 1 with the name: it is how a person is
 * referred to in every other system the organisation runs, and a people list
 * that drops it on a phone is a list you cannot cross-reference.
 */
const COLUMN_PRIORITIES: readonly PrioritisedColumn[] = [
  { id: "name", priority: 1 },
  { id: "employeeNumber", priority: 1 },
  { id: "roleLabel", priority: 1 },
  { id: "siteLabel", priority: 2 },
  { id: "active", priority: 2 },
  { id: "email", priority: 3 },
  { id: "tradeLabels", priority: 3 },
  // Never dropped: a register an administrator manages people from is not
  // one where the control disappears at a narrower width.
  { id: "manage", priority: 1 },
];

const columnHelper = createColumnHelper<DataTableFeatures, PeopleTableRow>();

export function PeopleTable({ role }: { role: Role }) {
  const { status, people, facilities } = usePeople();
  const locale = useLocale();
  const t = useTranslations("peopleTable");
  const tManage = useTranslations("managePeople");
  const tRoles = useTranslations("roles");
  const tTrades = useTranslations("trades");
  const tDataTable = useTranslations("dataTable");

  const rows = useMemo<PeopleTableRow[]>(
    () =>
      people.map((person) => ({
        id: person.user.id,
        employeeNumber: person.user.employeeNumber,
        name: fullName(person.user),
        email: person.user.email,
        role: person.user.role,
        roleLabel: tRoles(`${person.user.role}.name`),
        /*
         * Null travels all the way to the cell rather than being turned into
         * an empty string here. The table has to be able to tell "this system
         * cannot read their site" from "their site is called nothing", and a
         * string cannot carry that difference.
         */
        siteLabel: person.facility ? person.facility.code : null,
        siteName: person.facility
          ? textFor(person.facility.name, locale)
          : null,
        tradeLabels: person.user.trades.map((trade) => tTrades(trade)),
        active: person.user.active,
        readsOnly: person.readsOnly,
        person: person.user,
      })),
    [people, locale, tRoles, tTrades],
  );

  const columns = useMemo(
    () =>
      [
        columnHelper.accessor("name", {
          id: "name",
          header: t("columns.name"),
          enableHiding: false,
          cell: (cell) => (
            <span className="font-medium">{cell.getValue()}</span>
          ),
        }),
        columnHelper.accessor("employeeNumber", {
          id: "employeeNumber",
          header: t("columns.employeeNumber"),
          cell: (cell) => (
            <span className="font-mono text-xs">{cell.getValue()}</span>
          ),
        }),
        columnHelper.accessor("roleLabel", {
          id: "roleLabel",
          header: t("columns.role"),
          cell: (cell) => (
            <span className="flex items-center gap-2">
              <span
                className="block max-w-[12rem] truncate"
                title={cell.getValue()}
              >
                {cell.getValue()}
              </span>
              {cell.row.original.readsOnly ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t("readsOnly")}
                </span>
              ) : null}
            </span>
          ),
        }),
        columnHelper.accessor("siteLabel", {
          id: "siteLabel",
          header: t("columns.site"),
          /*
           * The unreadable site, said rather than left blank. `sortUndefined`
           * is not involved: the value is null, the locale comparator already
           * puts absent values last, and what matters here is that the cell
           * carries a sentence a reader can act on.
           */
          cell: (cell) =>
            cell.getValue() === null ? (
              <span className="text-muted-foreground">{t("siteUnknown")}</span>
            ) : (
              /*
               * The code, with the full name in `title`. Three characters
               * instead of ten rem of truncated prefix — and nothing is lost,
               * because the name is on hover, in the search, and in the facet
               * this column feeds.
               */
              <span
                className="font-mono text-xs"
                title={cell.row.original.siteName ?? undefined}
              >
                {cell.getValue()}
              </span>
            ),
        }),
        columnHelper.accessor("active", {
          id: "active",
          header: t("columns.state"),
          cell: (cell) => (
            <StatusChip
              tone={cell.getValue() ? "positive" : "quiet"}
              icon={cell.getValue() ? CircleCheck : CircleSlash}
              label={cell.getValue() ? t("active") : t("inactive")}
            />
          ),
        }),
        columnHelper.accessor("email", {
          id: "email",
          header: t("columns.email"),
          cell: (cell) => (
            <span
              className="block max-w-[14rem] truncate"
              title={cell.getValue()}
            >
              {cell.getValue()}
            </span>
          ),
        }),
        columnHelper.accessor("tradeLabels", {
          id: "tradeLabels",
          header: t("columns.trades"),
          /*
           * Bounded and truncated, like the email beside it.
           *
           * Unbounded, this cell is the widest thing on the table: "Heating,
           * ventilation and air conditioning" joined to a second trade runs
           * 355 px, which pushed the table 189 px past the box that clips it
           * in English and 225 px in French. Nothing said so — the clipper is
           * `overflow-x-auto`, so the page does not scroll sideways and every
           * page-level measurement was identical on both sides of the defect.
           * What it looked like was words cut mid-letter at the table's edge,
           * and only the picture showed it.
           */
          cell: (cell) => (
            <span
              className="block max-w-[10rem] truncate text-xs text-muted-foreground"
              title={cell.getValue().join(" · ")}
            >
              {cell.getValue().join(" · ")}
            </span>
          ),
        }),
        columnHelper.display({
          id: "manage",
          header: t("columns.manage"),
          enableHiding: false,
          /*
           * Gated by `users.manage` through `CapabilityAction`, so a role
           * without it meets a control that is present, disabled, and names
           * the role it is holding rather than a screen with a hole in it.
           *
           * Worth knowing while reading this: `/users` is reachable by the
           * administrator alone today, and the administrator holds every
           * capability — so the denied branch is correct and currently
           * unreachable. It is written this way because the gate is the rule
           * rather than a decoration, and the day another role is let onto
           * this screen it is already right.
           */
          cell: (cell) => (
            <CapabilityAction
              role={role}
              capability="users.manage"
              label={tManage("action")}
              icon={<Pencil data-icon="inline-start" />}
            >
              <EditPersonDialog
                person={cell.row.original.person}
                facilities={facilities}
                role={role}
              />
            </CapabilityAction>
          ),
        }),
      ] as ColumnDef<DataTableFeatures, PeopleTableRow, unknown>[],
    [t, tManage, facilities, role],
  );

  const { table, breakpoint } = useDataTable({
    data: rows,
    columns,
    priorities: COLUMN_PRIORITIES,
    globalFilterFn: (row, _columnId, filterValue) =>
      matchesPersonSearch(row.original, String(filterValue ?? "")),
  });

  if (status !== "ready") {
    // Never an empty people list while the store is unread: employing nobody
    // and not yet knowing are different claims, and only one is true then.
    return <DataTableSkeleton columns={5} />;
  }

  const columnLabels: Record<string, string> = {
    employeeNumber: t("columns.employeeNumber"),
    roleLabel: t("columns.role"),
    siteLabel: t("columns.site"),
    active: t("columns.state"),
    email: t("columns.email"),
    tradeLabels: t("columns.trades"),
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
              column={table.getColumn("roleLabel")!}
              label={t("columns.role")}
              optionLabel={(value) => value}
            />
            <DataTableFacetFilter
              column={table.getColumn("siteLabel")!}
              label={t("columns.site")}
              optionLabel={(value) => value}
            />
          </>
        }
      />

      <DataTable
        table={table}
        breakpoint={breakpoint}
        caption={t("caption")}
        empty={<ModulePanel moduleKey="users" />}
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
              <span className="font-medium">{row.original.name}</span>
              <StatusChip
                tone={row.original.active ? "positive" : "quiet"}
                icon={row.original.active ? CircleCheck : CircleSlash}
                label={row.original.active ? t("active") : t("inactive")}
              />
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              {row.original.employeeNumber}
            </p>
            <p className="text-sm">{row.original.roleLabel}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.siteName ?? t("siteUnknown")}
            </p>
            {/*
              The same control the table row carries.

              Below `md` the register is not a table, and a management action
              that exists only in the table is one an administrator cannot
              reach on a phone — the column priority keeps it from dropping at
              1024 and would have said nothing about 390.
            */}
            <div className="pt-1">
              <CapabilityAction
                role={role}
                capability="users.manage"
                label={tManage("action")}
                icon={<Pencil data-icon="inline-start" />}
              >
                <EditPersonDialog
                  person={row.original.person}
                  facilities={facilities}
                  role={role}
                />
              </CapabilityAction>
            </div>
          </article>
        )}
      />

      <DataTablePagination table={table} />
    </div>
  );
}
