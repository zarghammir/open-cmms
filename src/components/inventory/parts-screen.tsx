"use client";

import { useMemo } from "react";
import {
  CircleCheck,
  ClipboardCopy,
  QrCode,
  TriangleAlert,
} from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
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
import { StatusChip } from "@/components/shared/status-chip";
import { Button } from "@/components/ui/button";
import { NoResultsState } from "@/components/shared/state-panels";
import { ModulePanel } from "@/components/shared/module-panel";
import { useRepositories } from "@/hooks/use-demo-data";
import { textFor } from "@/lib/localized-text";
import { Link, useRouter } from "@/i18n/navigation";
import { matchesSearch, type PartRow } from "./part-rows";

/**
 * Nine columns, which is as many as the assets register carries — and that one
 * overflowed at 1440 and had to cap its name column. So the priorities are set
 * against the measurement rather than by taste, and the fit test lands in the
 * same commit as the table.
 *
 * There is no site column: the bin code's first segment *is* the site, so a
 * tenth column would have drawn information the ninth already carries.
 *
 * **Category is priority 3, and that is a measurement rather than a taste.**
 * Measured at 755b8f6 the register needed 763 px in English and 762 in French
 * inside a 718 px container at 1024 — 45 px and 44 px over, against an 18 px
 * floor, so 63 px had to go. Tightening the name cap to 10rem would have shed
 * exactly 64, which clears the floor by a single pixel; WA-65's lesson is that
 * a boundary cleared by one pixel is a coincidence and not a proof. Dropping
 * the category at tablet sheds the whole column instead, and it is the one of
 * the three that a reader does not scan row by row — it has a facet in the
 * toolbar, which keeps working while the column is hidden, exactly as the
 * assets register's `typeLabel` does.
 */
const COLUMN_PRIORITIES: readonly PrioritisedColumn[] = [
  { id: "partNumber", priority: 1 },
  { id: "name", priority: 1 },
  { id: "stockState", priority: 1 },
  { id: "onHand", priority: 2 },
  { id: "minimum", priority: 2 },
  { id: "categoryLabel", priority: 3 },
  { id: "binCode", priority: 3 },
  { id: "unitCost", priority: 3 },
  { id: "actions", priority: 1 },
];

const columnHelper = createColumnHelper<DataTableFeatures, PartRow>();

/**
 * The parts register.
 *
 * Reads through the part repository, never the store, and draws a skeleton
 * until the records have been read — an empty table would say this
 * organisation holds no spares, which is a different claim from not knowing
 * yet.
 */
export function PartsScreen() {
  const { status, repositories } = useRepositories();
  const locale = useLocale();
  const format = useFormatter();
  const t = useTranslations("partsTable");
  const tCategory = useTranslations("partCategory");
  const tUnit = useTranslations("unitOfMeasure");
  const tDataTable = useTranslations("dataTable");
  const router = useRouter();

  const rows = useMemo<PartRow[]>(() => {
    if (!repositories) return [];

    /*
     * Which parts are low is **asked**, not recomputed.
     *
     * `parts.belowMinimum()` is the repository's own predicate, so this screen
     * adds no new definition of the rule.
     *
     * When this was written the rule was spelled out in three separate places,
     * none of them calling another, agreeing only because all three happened to
     * use a strict `<`; consolidating them was named here as its own ticket.
     * That ticket is WA-69 and it is done: the comparison now lives once, as
     * `isBelowMinimum` in `domain/constants/part.ts`, and `belowMinimum()` asks
     * it.
     *
     * The reason this register does not compute it itself outlived the
     * duplication. A screen that writes `quantityOnHand < reorderPoint` is a
     * second definition of the rule whatever the count happens to be.
     */
    const low = new Set(repositories.parts.belowMinimum().map((p) => p.id));

    return repositories.parts.list().map((part) => {
      const bin = repositories.facilities.binById(part.inventoryLocationId);

      return {
        id: part.id,
        partNumber: part.partNumber,
        name: textFor(part.name, locale),
        category: part.category,
        categoryLabel: tCategory(part.category),
        onHand: part.quantityOnHand,
        minimum: part.reorderPoint,
        unitOfMeasure: part.unitOfMeasure,
        /*
         * Pluralised on the quantity it will sit beside.
         *
         * It was a bare singular interpolated after a number, which reads as
         * "16 box" in English and "2 unité" in French — the second is simply
         * wrong, and French takes the singular at zero as well as at one, which
         * a hand-rolled `s` would get backwards. ICU knows both rules, so the
         * catalogue carries the plural and this passes it the count.
         */
        unitLabel: tUnit(part.unitOfMeasure, { count: part.quantityOnHand }),
        unitCost: part.unitCost,
        facilityId: part.facilityId,
        // The bin may be unreadable; that is not the same as a part with no
        // bin, and neither is an empty string pretending to be a code.
        binCode: bin ? bin.code : "",
        stockState: low.has(part.id) ? "low" : "ok",
      };
    });
  }, [repositories, locale, tCategory, tUnit]);

  const columns = useMemo(
    () =>
      [
        columnHelper.accessor("partNumber", {
          id: "partNumber",
          header: t("columns.partNumber"),
          enableHiding: false,
          /*
           * The stock number is the way in, for the same reason the asset tag
           * is on the other register: it is what a person reads off the shelf,
           * what the printed label carries and what the address uses — so the
           * thing you would point at is the thing you click, rather than
           * burying "open" in a row menu beside actions that do something else.
           */
          cell: (cell) => (
            <Link
              href={`/inventory/${cell.getValue()}`}
              className="rounded-sm font-mono text-xs font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {cell.getValue()}
            </Link>
          ),
        }),
        columnHelper.accessor("name", {
          id: "name",
          header: t("columns.name"),
          /*
           * Capped, and the cap is chosen from the measurement rather than
           * copied from the assets register.
           *
           * Measured on the seed before this table was written: the longest
           * name is 36 characters in English and **43 in French** — so French
           * is the case to design against here, which is the opposite of the
           * assets register, where English was the wider of the two. A cap set
           * by looking only at English would have been right on one screen and
           * wrong on the other.
           */
          cell: (cell) => (
            <span
              className="block max-w-[14rem] truncate xl:max-w-[18rem]"
              title={cell.getValue()}
            >
              {cell.getValue()}
            </span>
          ),
        }),
        columnHelper.accessor("stockState", {
          id: "stockState",
          header: t("columns.stockState"),
          filterFn: (row, columnId, value) =>
            matchesFacet(String(row.getValue(columnId)), value as string[]),
          // Colour is never the only signal: the chip carries an icon and a
          // word, the same shape every other status on the product uses.
          cell: (cell) => (
            <StatusChip
              tone={cell.getValue() === "low" ? "critical" : "positive"}
              icon={cell.getValue() === "low" ? TriangleAlert : CircleCheck}
              label={cell.getValue() === "low" ? t("low") : t("ok")}
            />
          ),
        }),
        columnHelper.accessor("onHand", {
          id: "onHand",
          header: t("columns.onHand"),
          /*
           * The unit sits inside this cell rather than in a column of its own.
           * Ten columns on a table that already fails at nine is a fit test
           * written to fail, and "12" and "each" are one fact read together,
           * not two facts to be sorted separately.
           */
          cell: (cell) => (
            <span className="flex items-baseline gap-1">
              <span className="tabular-nums">
                {format.number(cell.getValue(), "integer")}
              </span>
              <span className="text-xs text-muted-foreground">
                {cell.row.original.unitLabel}
              </span>
            </span>
          ),
        }),
        columnHelper.accessor("minimum", {
          id: "minimum",
          header: t("columns.minimum"),
          cell: (cell) => (
            <span className="tabular-nums">
              {format.number(cell.getValue(), "integer")}
            </span>
          ),
        }),
        columnHelper.accessor("categoryLabel", {
          id: "categoryLabel",
          header: t("columns.category"),
          filterFn: (row, columnId, value) =>
            matchesFacet(String(row.getValue(columnId)), value as string[]),
          cell: (cell) => (
            <span
              className="block max-w-[9rem] truncate"
              title={cell.getValue()}
            >
              {cell.getValue()}
            </span>
          ),
        }),
        columnHelper.accessor("binCode", {
          id: "binCode",
          header: t("columns.bin"),
          cell: (cell) =>
            cell.getValue() ? (
              <span className="font-mono text-xs">{cell.getValue()}</span>
            ) : (
              // A bin this organisation does not hold. Not "no bin": the record
              // names one and this system cannot read it.
              <span className="text-xs text-muted-foreground">
                {t("binUnreadable")}
              </span>
            ),
        }),
        columnHelper.accessor("unitCost", {
          id: "unitCost",
          header: t("columns.unitCost"),
          cell: (cell) => (
            <span className="tabular-nums">
              {format.number(cell.getValue(), "currency")}
            </span>
          ),
        }),
        columnHelper.display({
          id: "actions",
          header: () => <span className="sr-only">{t("columns.actions")}</span>,
          enableHiding: false,
          cell: (cell) => (
            <DataTableRowActions
              label={t("rowActions", { number: cell.row.original.partNumber })}
              actions={[
                {
                  key: "label",
                  label: t("actions.printLabel"),
                  icon: <QrCode data-icon="inline-start" />,
                  onSelect: () =>
                    router.push(
                      `/inventory/${cell.row.original.partNumber}/label`,
                    ),
                },
                {
                  key: "copy",
                  label: t("actions.copyNumber"),
                  icon: <ClipboardCopy data-icon="inline-start" />,
                  onSelect: () => {
                    void navigator.clipboard
                      ?.writeText(cell.row.original.partNumber)
                      .then(() =>
                        toast.success(
                          t("actions.copied", {
                            number: cell.row.original.partNumber,
                          }),
                        ),
                      );
                  },
                },
              ]}
            />
          ),
        }),
      ] as ColumnDef<DataTableFeatures, PartRow, unknown>[],
    [t, format, router],
  );

  const { table, breakpoint } = useDataTable({
    data: rows,
    columns,
    priorities: COLUMN_PRIORITIES,
    globalFilterFn: (row, _columnId, filterValue) =>
      matchesSearch(row.original, String(filterValue ?? "")),
  });

  if (status !== "ready" || !repositories) {
    return <DataTableSkeleton columns={6} />;
  }

  const columnLabels: Record<string, string> = {
    name: t("columns.name"),
    stockState: t("columns.stockState"),
    onHand: t("columns.onHand"),
    minimum: t("columns.minimum"),
    categoryLabel: t("columns.category"),
    binCode: t("columns.bin"),
    unitCost: t("columns.unitCost"),
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
              column={table.getColumn("categoryLabel")!}
              label={t("columns.category")}
              optionLabel={(value) => value}
            />
            <DataTableFacetFilter
              column={table.getColumn("stockState")!}
              label={t("columns.stockState")}
              optionLabel={(value) => (value === "low" ? t("low") : t("ok"))}
            />
          </>
        }
      />

      <DataTable
        table={table}
        breakpoint={breakpoint}
        caption={t("caption")}
        empty={<ModulePanel moduleKey="inventory" />}
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
                href={`/inventory/${row.original.partNumber}`}
                className="inline-flex min-h-11 items-center rounded-sm font-mono text-xs font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {row.original.partNumber}
              </Link>
              <DataTableRowActions
                label={t("rowActions", { number: row.original.partNumber })}
                actions={[
                  {
                    key: "label",
                    label: t("actions.printLabel"),
                    onSelect: () =>
                      router.push(
                        `/inventory/${row.original.partNumber}/label`,
                      ),
                  },
                ]}
              />
            </div>
            <p className="text-sm font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">
              {t("cardStock", {
                onHand: row.original.onHand,
                unit: row.original.unitLabel,
                minimum: row.original.minimum,
              })}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <StatusChip
                tone={
                  row.original.stockState === "low" ? "critical" : "positive"
                }
                icon={
                  row.original.stockState === "low"
                    ? TriangleAlert
                    : CircleCheck
                }
                label={row.original.stockState === "low" ? t("low") : t("ok")}
              />
            </div>
          </article>
        )}
      />

      <DataTablePagination table={table} />
    </div>
  );
}
