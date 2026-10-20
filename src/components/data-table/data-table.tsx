"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReactTable, Row, RowData } from "@tanstack/react-table";
import type { DataTableFeatures } from "./table-features";
import type { Breakpoint } from "./column-priority";

/**
 * The table every register screen is drawn with.
 *
 * It renders a table instance it is handed rather than building one, so Assets,
 * Inventory and Documents share the markup, the keyboard path and the sorting
 * affordance without sharing their columns.
 *
 * At phone width it is not a table at all: a table squeezed into 390px is a
 * table nobody can read. Rows become cards, drawn by the caller, and the
 * horizontal scroll container exists for the tablet case where a table still
 * makes sense but may not quite fit.
 */
export function DataTable<TData extends RowData>({
  table,
  breakpoint,
  caption,
  renderCard,
  empty,
  noResults,
}: {
  table: ReactTable<DataTableFeatures, TData>;
  breakpoint: Breakpoint;
  /** Describes the table for someone who cannot see it. Always rendered. */
  caption: string;
  /** Row as a card, for phone width. Without it the table is used at 390 too. */
  renderCard?: (row: Row<DataTableFeatures, TData>) => ReactNode;
  /** There are no records at all. */
  empty: ReactNode;
  /** There are records, but none match the search and filters. */
  noResults: ReactNode;
}) {
  const t = useTranslations("dataTable");
  const rows = table.getRowModel().rows;
  const hasAnyRows = table.getCoreRowModel().rows.length > 0;

  if (!hasAnyRows) return <>{empty}</>;
  if (rows.length === 0) return <>{noResults}</>;

  if (breakpoint === "phone" && renderCard) {
    return (
      <ul
        data-slot="data-table-cards"
        aria-label={caption}
        className="flex flex-col gap-2"
      >
        {rows.map((row) => (
          <li key={row.id}>{renderCard(row)}</li>
        ))}
      </ul>
    );
  }

  return (
    <div
      data-slot="data-table"
      className="w-full overflow-x-auto rounded-md border border-border"
    >
      <Table>
        <caption className="sr-only">{caption}</caption>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const canSort = header.column.getCanSort();

                return (
                  <TableHead
                    key={header.id}
                    aria-sort={
                      !canSort
                        ? undefined
                        : sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : "none"
                    }
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <Button
                        variant="ghost"
                        size="xs"
                        className="-ml-2 font-medium"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <table.FlexRender header={header} />
                        {sorted === "asc" ? (
                          <ArrowUp data-icon="inline-end" aria-hidden="true" />
                        ) : sorted === "desc" ? (
                          <ArrowDown
                            data-icon="inline-end"
                            aria-hidden="true"
                          />
                        ) : (
                          <ChevronsUpDown
                            data-icon="inline-end"
                            aria-hidden="true"
                            className="opacity-50"
                          />
                        )}
                        <span className="sr-only">{t("sortBy")}</span>
                      </Button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={cn(
                    cell.column.id === "actions" && "w-px whitespace-nowrap",
                  )}
                >
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
