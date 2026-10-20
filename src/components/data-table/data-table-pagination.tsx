"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactTable, RowData } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import type { DataTableFeatures } from "./table-features";

/**
 * Moving between pages.
 *
 * The position is a sentence rather than a pair of arrows on their own, and it
 * is announced politely, because "page 2 of 6" is the only feedback a screen
 * reader user gets that the button did anything.
 */
export function DataTablePagination<TData extends RowData>({
  table,
}: {
  table: ReactTable<DataTableFeatures, TData>;
}) {
  const t = useTranslations("dataTable");
  const pageCount = table.getPageCount();

  if (pageCount <= 1) return null;

  const page = table.state.pagination.pageIndex + 1;

  return (
    <nav
      aria-label={t("pagination")}
      className="flex items-center justify-between gap-2"
    >
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {t("pageOf", { page, pages: pageCount })}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronLeft data-icon="inline-start" />
          {t("previousPage")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          {t("nextPage")}
          <ChevronRight data-icon="inline-end" />
        </Button>
      </div>
    </nav>
  );
}
