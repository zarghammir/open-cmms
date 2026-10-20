"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { ReactTable, RowData } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { DataTableFeatures } from "./table-features";

/**
 * Search, filters and column visibility, above the table.
 *
 * The row count is announced politely rather than silently changing: someone
 * filtering with a screen reader has no other way to know the filter did
 * anything.
 */
export function DataTableToolbar<TData extends RowData>({
  table,
  searchPlaceholder,
  label,
  filters,
  columnLabels,
}: {
  table: ReactTable<DataTableFeatures, TData>;
  searchPlaceholder: string;
  /** Names the search field for a screen reader. */
  label: string;
  /** The facet filters for this table. */
  filters?: ReactNode;
  /** Column id to its translated name, for the visibility menu. */
  columnLabels: Record<string, string>;
}) {
  const t = useTranslations("dataTable");
  const search = String(table.state.globalFilter ?? "");
  const filtered = table.getPrePaginatedRowModel().rows.length;
  const total = table.getCoreRowModel().rows.length;
  const narrowed = filtered !== total;

  return (
    <div data-slot="data-table-toolbar" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <label className="sr-only" htmlFor="data-table-search">
            {label}
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="data-table-search"
            type="search"
            className="h-8 pl-7"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
          />
        </div>

        {filters}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <SlidersHorizontal data-icon="inline-start" />
              {t("columns")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t("columns")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllLeafColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(checked) =>
                    column.toggleVisibility(Boolean(checked))
                  }
                >
                  {columnLabels[column.id] ?? column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {narrowed ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              table.setGlobalFilter("");
              table.resetColumnFilters();
            }}
          >
            <X data-icon="inline-start" />
            {t("clearFilters")}
          </Button>
        ) : null}
      </div>

      <p
        aria-live="polite"
        data-slot="data-table-rows"
        className="text-xs text-muted-foreground"
      >
        {narrowed
          ? t("rowsFiltered", { shown: filtered, total })
          : t("rowsTotal", { total })}
      </p>
    </div>
  );
}
