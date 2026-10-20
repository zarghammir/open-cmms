"use client";

import { useMemo } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { useFormatter, useTranslations } from "next-intl";
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
import { Button } from "@/components/ui/button";
import { matchesSearch, type DocumentRow } from "@/data/selectors/documents";
import { useDocumentLibrary } from "@/hooks/use-documents";

/**
 * Every document in one place, whatever it is filed against.
 *
 * Seven columns against the parts register's nine, which overflowed at 1024 and
 * had to drop a column — so the priorities are set from that measurement rather
 * than from taste, and `documents-table.spec.ts` lands in the same commit as
 * the table rather than after it.
 *
 * `filedAgainst` is priority 1 and stays at every width. It is the column that
 * answers the question the library exists for — where does this belong — and
 * dropping it at tablet would leave a list of file names.
 */
const COLUMN_PRIORITIES: readonly PrioritisedColumn[] = [
  { id: "title", priority: 1 },
  { id: "kindLabel", priority: 1 },
  { id: "filedAgainstLabel", priority: 1 },
  /*
   * Desktop only, and that is a measurement rather than a taste.
   *
   * At 1024 in French the table needed 721 px inside a 718 px container — 3 px
   * over, against an 18 px floor, so 21 px had to go at the least and 34 to
   * clear the compounded target (`table-fit.ts`'s floor plus 1.8% of what the
   * table needs). French is the case that fails here: its titles run long
   * ("procédure d'exploitation normalisée", "Entente de services d'entretien
   * des bâtiments") where the English ones do not, and an eye trained on the
   * English screen would have found it comfortable and shipped.
   *
   * The format is the column a reader does not scan row by row, and it keeps a
   * facet in the toolbar that works while the column is hidden — the same
   * lever, for the same reason, that the parts register pulled on its category.
   * Dropping a whole column has room; capping the title would have been
   * shaving pixels against a boundary.
   */
  { id: "typeLabel", priority: 3 },
  { id: "size", priority: 3 },
  { id: "version", priority: 3 },
  { id: "uploaded", priority: 3 },
];

/**
 * A row with its labels already in the reader's language.
 *
 * The table sorts, filters and facets on what is on the screen, so the labels
 * have to be on the row rather than produced in a `cell`. A facet over
 * `kind` would offer "procedure" to a French reader.
 */
interface LibraryRow extends DocumentRow {
  kindLabel: string;
  typeLabel: string;
  filedAgainstLabel: string;
}

const columnHelper = createColumnHelper<DataTableFeatures, LibraryRow>();

export function DocumentsScreen() {
  const { status, rows } = useDocumentLibrary();
  const t = useTranslations("documentsTable");
  const tKind = useTranslations("documentKind");
  const tType = useTranslations("documentType");
  const tFiled = useTranslations("filedAgainst");
  const tDataTable = useTranslations("dataTable");
  const format = useFormatter();

  /**
   * The label a reader sees for what a document is filed against.
   *
   * Never an empty cell. "Organisation" is a real answer, and a document
   * naming a record this system does not hold says so in its own words rather
   * than borrowing either of the other two.
   */
  const filedLabel = useMemo(
    () => (row: DocumentRow) =>
      row.filedAgainst.state === "organisation"
        ? tFiled("organisation")
        : tFiled(row.filedAgainst.state, { label: row.filedAgainst.label }),
    [tFiled],
  );

  const decorated = useMemo<LibraryRow[]>(
    () =>
      rows.map((row) => ({
        ...row,
        kindLabel: tKind(row.kind),
        typeLabel: tType(row.fileType),
        filedAgainstLabel: filedLabel(row),
      })),
    [rows, tKind, tType, filedLabel],
  );

  const columns = useMemo(
    () =>
      [
        columnHelper.accessor("title", {
          id: "title",
          header: t("columns.title"),
        }),
        columnHelper.accessor("kindLabel", {
          id: "kindLabel",
          header: t("columns.kind"),
        }),
        columnHelper.accessor("filedAgainstLabel", {
          id: "filedAgainstLabel",
          header: t("columns.filedAgainst"),
        }),
        columnHelper.accessor("typeLabel", {
          id: "typeLabel",
          header: t("columns.type"),
        }),
        columnHelper.accessor("sizeBytes", {
          id: "size",
          header: t("columns.size"),
          cell: (info) =>
            t("size", { kilobytes: Math.round(info.getValue() / 1024) }),
        }),
        columnHelper.accessor("version", {
          id: "version",
          header: t("columns.version"),
          cell: (info) => t("version", { version: info.getValue() }),
        }),
        columnHelper.accessor("uploadedAt", {
          id: "uploaded",
          header: t("columns.uploaded"),
          cell: (info) =>
            format.dateTime(new Date(info.getValue() as string), "day"),
        }),
      ] as ColumnDef<DataTableFeatures, LibraryRow, unknown>[],
    [t, format],
  );

  const { table, breakpoint } = useDataTable({
    data: decorated,
    columns,
    priorities: COLUMN_PRIORITIES,
    globalFilterFn: (row, _columnId, filterValue) =>
      matchesSearch(row.original, String(filterValue ?? "")),
  });

  if (status !== "ready") {
    // Never an empty table here: "no documents" and "not read back yet" are
    // different claims, and only one of them is true at this moment.
    return <DataTableSkeleton columns={5} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t("noBytes")}</p>

      <DataTableToolbar
        table={table}
        label={t("searchLabel")}
        searchPlaceholder={t("searchPlaceholder")}
        columnLabels={{
          title: t("columns.title"),
          kindLabel: t("columns.kind"),
          filedAgainstLabel: t("columns.filedAgainst"),
          typeLabel: t("columns.type"),
          size: t("columns.size"),
          version: t("columns.version"),
          uploaded: t("columns.uploaded"),
        }}
        filters={
          <>
            <DataTableFacetFilter
              column={table.getColumn("kindLabel")!}
              label={t("columns.kind")}
              optionLabel={(value) => value}
            />
            <DataTableFacetFilter
              column={table.getColumn("typeLabel")!}
              label={t("columns.type")}
              optionLabel={(value) => value}
            />
          </>
        }
      />

      <DataTable
        table={table}
        breakpoint={breakpoint}
        caption={t("caption")}
        empty={<ModulePanel moduleKey="documents" />}
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
            <p className="text-sm font-medium">{row.original.title}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {row.original.fileName}
            </p>
            <p className="text-xs text-muted-foreground">
              {row.original.filedAgainstLabel}
            </p>
            <p className="text-xs text-muted-foreground">
              {row.original.kindLabel} · {row.original.typeLabel} ·{" "}
              {t("size", {
                kilobytes: Math.round(row.original.sizeBytes / 1024),
              })}
            </p>
          </article>
        )}
      />

      <DataTablePagination table={table} />
    </div>
  );
}
