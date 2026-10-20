import {
  columnFacetingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  createCoreRowModel,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
} from "@tanstack/react-table";

/**
 * The feature set every WorkAxis table is built from.
 *
 * TanStack Table v9 has no `useReactTable` and no `getCoreRowModel`: features
 * are opted into explicitly and the row models are factories that live in the
 * same object. That is a deliberate choice of the current API over the v8
 * shaped `@tanstack/react-table/legacy` compatibility layer — every later
 * table copies whichever this one uses, and inheriting a deprecation is worse
 * than learning the new shape once.
 *
 * One object rather than a set per table, so Assets, Inventory and Documents
 * cannot drift into supporting different things.
 */
export const dataTableFeatures = {
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  columnVisibilityFeature,
  columnFacetingFeature,
  coreRowModel: createCoreRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
} as const;

export type DataTableFeatures = typeof dataTableFeatures;

/** How many rows a page holds. Small enough that pagination is demonstrable. */
export const DEFAULT_PAGE_SIZE = 10;
