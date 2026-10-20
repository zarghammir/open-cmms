"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * What a table looks like before the records have been read.
 *
 * Not an empty table, and not "no results". The store is client-only, so there
 * is always a moment where the answer is not yet known, and drawing an empty
 * table then would tell a reviewer there is nothing — which is a different
 * claim, and a false one.
 */
export function DataTableSkeleton({
  rows = 8,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  const t = useTranslations("states.loading");

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      data-slot="data-table-skeleton"
      className="flex flex-col gap-3"
    >
      <span className="sr-only">{t("label")}</span>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="overflow-hidden rounded-md border border-border">
        <div className="flex gap-4 border-b border-border bg-muted/40 px-3 py-2">
          {Array.from({ length: columns }, (_, index) => (
            <Skeleton key={index} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={row}
            className="flex gap-4 border-b border-border px-3 py-3 last:border-b-0"
          >
            {Array.from({ length: columns }, (_, column) => (
              <Skeleton key={column} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
