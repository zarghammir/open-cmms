"use client";

import { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import {
  useTable,
  type OnChangeFn,
  type RowData,
  type TableOptions,
} from "@tanstack/react-table";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import {
  columnVisibilityFor,
  type Breakpoint,
  type PrioritisedColumn,
} from "./column-priority";
import { createLocaleCompare } from "./locale-sort";
import {
  dataTableFeatures,
  DEFAULT_PAGE_SIZE,
  type DataTableFeatures,
} from "./table-features";

/**
 * Builds a table the WorkAxis way: the shared feature set, pagination, and
 * column visibility that follows the width.
 *
 * Visibility is controlled rather than left to the table, because two things
 * decide it — the width, and the reader turning a column off. The reader wins
 * until the width changes, and then the width's defaults apply again. Leaving
 * it uncontrolled would mean a column hidden at 1024 stays hidden when the
 * window is widened, which reads as a bug.
 */
export function useDataTable<TData extends RowData>({
  data,
  columns,
  priorities,
  globalFilterFn,
}: {
  data: TData[];
  columns: TableOptions<DataTableFeatures, TData>["columns"];
  priorities: readonly PrioritisedColumn[];
  /** How the search box decides whether a row matches. */
  globalFilterFn?: TableOptions<DataTableFeatures, TData>["globalFilterFn"];
}) {
  const breakpoint: Breakpoint = useBreakpoint();
  const locale = useLocale();

  /**
   * Every column sorts in the reader's language unless it says otherwise.
   *
   * Set here rather than per column so that Inventory and Documents inherit it
   * without having to remember: a table that sorts French as though it were
   * code points is the kind of defect nobody reports, they just stop trusting
   * the column.
   */
  const defaultColumn = useMemo(() => {
    const compare = createLocaleCompare(locale);
    return {
      sortFn: (
        rowA: { getValue: (id: string) => unknown },
        rowB: { getValue: (id: string) => unknown },
        columnId: string,
      ) => compare(rowA.getValue(columnId), rowB.getValue(columnId)),
    };
  }, [locale]);

  /**
   * What the reader turned on or off, and at which width they did it.
   *
   * Derived rather than synchronised: an effect that pushed the width's
   * defaults into state on every change would cascade a second render, which
   * is the mistake `use-mobile.ts` already had to be rewritten out of. Keeping
   * the override next to the width it belongs to means the defaults simply
   * apply again the moment the width changes, with nothing to reset.
   */
  const [override, setOverride] = useState<{
    breakpoint: Breakpoint;
    visibility: Record<string, boolean>;
  } | null>(null);

  const columnVisibility =
    override && override.breakpoint === breakpoint
      ? override.visibility
      : columnVisibilityFor(priorities, breakpoint);

  const setColumnVisibility: OnChangeFn<Record<string, boolean>> = (
    updaterOrValue,
  ) => {
    const visibility =
      typeof updaterOrValue === "function"
        ? updaterOrValue(columnVisibility)
        : updaterOrValue;
    setOverride({ breakpoint, visibility });
  };

  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    defaultColumn,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    globalFilterFn,
    initialState: {
      pagination: { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE },
    },
  });

  return useMemo(() => ({ table, breakpoint }), [table, breakpoint]);
}
