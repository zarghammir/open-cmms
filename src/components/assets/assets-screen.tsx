"use client";

import { useMemo } from "react";
import { ClipboardCopy, Wrench } from "lucide-react";
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
import type { PrioritisedColumn } from "@/components/data-table/column-priority";
import { matchesFacet } from "@/components/data-table/facets";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { StatusChip } from "@/components/shared/status-chip";
import { Button } from "@/components/ui/button";
import { NoResultsState } from "@/components/shared/state-panels";
import { ModulePanel } from "@/components/shared/module-panel";
import {
  ASSET_CRITICALITY_PRESENTATION,
  ASSET_STATUS_PRESENTATION,
} from "@/domain/constants/asset-status";
import { useRepositories } from "@/hooks/use-demo-data";
import { textFor } from "@/lib/localized-text";
import { Link, useRouter } from "@/i18n/navigation";
import { matchesSearch, type AssetRow } from "./asset-rows";

const COLUMN_PRIORITIES: readonly PrioritisedColumn[] = [
  { id: "assetTag", priority: 1 },
  { id: "name", priority: 1 },
  { id: "facilityName", priority: 2 },
  { id: "status", priority: 2 },
  { id: "criticality", priority: 2 },
  { id: "typeLabel", priority: 3 },
  { id: "locationCode", priority: 3 },
  { id: "installedOn", priority: 3 },
  { id: "actions", priority: 1 },
];

const columnHelper = createColumnHelper<DataTableFeatures, AssetRow>();

/**
 * The equipment register.
 *
 * Reads through the asset repository, never the store, and draws a skeleton
 * until the records have been read — an empty table would say there is no
 * equipment, which is a different claim from not knowing yet.
 */
export function AssetsScreen() {
  const { status, repositories } = useRepositories();
  const locale = useLocale();
  const format = useFormatter();
  const t = useTranslations("assetsTable");
  const tStatus = useTranslations("assetStatus");
  const tCriticality = useTranslations("criticality");
  const tDataTable = useTranslations("dataTable");
  const router = useRouter();

  const rows = useMemo<AssetRow[]>(() => {
    if (!repositories) return [];

    return repositories.assets.list().map((asset) => {
      const type = repositories.assets.typeOf(asset);
      const facility = repositories.facilities.byId(asset.facilityId);
      const location = repositories.assets.locationOf(asset);

      return {
        id: asset.id,
        assetTag: asset.assetTag,
        name: textFor(asset.name, locale),
        typeId: asset.assetTypeId,
        typeLabel: type ? textFor(type.label, locale) : asset.assetTypeId,
        facilityId: asset.facilityId,
        facilityName: facility
          ? textFor(facility.name, locale)
          : asset.facilityId,
        facilityCity: facility
          ? textFor(facility.city, locale)
          : asset.facilityId,
        locationCode: location ? location.code : "",
        status: asset.status,
        criticality: asset.criticality,
        installedOn: asset.installedAt,
        manufacturer: asset.manufacturer,
        model: asset.model,
      };
    });
  }, [repositories, locale]);

  const columns = useMemo(
    () =>
      [
        columnHelper.accessor("assetTag", {
          id: "assetTag",
          header: t("columns.assetTag"),
          enableHiding: false,
          /*
           * The tag is the way in. It is what a person reads off the machine,
           * what a printed label carries and what the address uses, so making
           * it the link means the thing you would point at is the thing you
           * click — rather than burying "open" in the row menu beside actions
           * that do something else.
           */
          cell: (cell) => (
            <Link
              href={`/assets/${cell.getValue()}`}
              className="rounded-sm font-mono text-xs font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {cell.getValue()}
            </Link>
          ),
        }),
        columnHelper.accessor("name", {
          id: "name",
          header: t("columns.name"),
          // Truncated rather than left to push the table sideways. Equipment
          // names run long — "Emergency eyewash and shower station EWS-KGN-11"
          // — and one long cell was enough to shove Criticality and the row
          // actions off the right edge at 1440.
          cell: (cell) => (
            <span
              className="block max-w-[15rem] truncate xl:max-w-[16rem]"
              title={cell.getValue()}
            >
              {cell.getValue()}
            </span>
          ),
        }),
        columnHelper.accessor("typeLabel", {
          id: "typeLabel",
          header: t("columns.type"),
          filterFn: (row, columnId, value) =>
            matchesFacet(String(row.getValue(columnId)), value as string[]),
          cell: (cell) => (
            <span
              className="block max-w-[10rem] truncate"
              title={cell.getValue()}
            >
              {cell.getValue()}
            </span>
          ),
        }),
        columnHelper.accessor((row) => row.facilityCity, {
          id: "facilityName",
          header: t("columns.facility"),
          /*
           * The city, not a truncation of the site name.
           *
           * The name was capped at 10rem and cut mid-word, and four of the five
           * sites are "Laboratoire régional de …" — so what survived the cut
           * distinguished nothing and what was cut was the only part a reader
           * scans for. The city is not a shortening, it is a shorter true
           * value: nothing is cut, and the whole name is still there for a
           * screen reader.
           *
           * `aria-label` and not `title` alone. Name-from-content beats
           * `title`, so a cell whose text is the city has the *city* as its
           * accessible name and the name is announced nowhere — which is
           * precisely the regression WA-64 shipped and had to correct. While
           * the cell rendered the truncated name this did not arise, because
           * the text and the title were the same string.
           *
           * The accessor moves with it, so the column, its sort and its facet
           * all say the same thing. **The facet keys on the city**, so two
           * sites in one city would merge into a single option: reachable, and
           * not tested — the seed has five sites in five cities, so no fixture
           * reaches it.
           */
          filterFn: (row, columnId, value) =>
            matchesFacet(String(row.getValue(columnId)), value as string[]),
          cell: (cell) => (
            <span
              aria-label={cell.row.original.facilityName}
              title={cell.row.original.facilityName}
            >
              {cell.row.original.facilityCity}
            </span>
          ),
        }),
        columnHelper.accessor("locationCode", {
          id: "locationCode",
          header: t("columns.location"),
          cell: (cell) => (
            <span className="font-mono text-xs">{cell.getValue()}</span>
          ),
        }),
        columnHelper.accessor("status", {
          id: "status",
          header: t("columns.status"),
          filterFn: (row, columnId, value) =>
            matchesFacet(String(row.getValue(columnId)), value as string[]),
          cell: (cell) => {
            const presentation = ASSET_STATUS_PRESENTATION[cell.getValue()];
            return (
              <StatusChip
                tone={presentation.tone}
                icon={presentation.icon}
                label={tStatus(cell.getValue())}
              />
            );
          },
        }),
        columnHelper.accessor("criticality", {
          id: "criticality",
          header: t("columns.criticality"),
          filterFn: (row, columnId, value) =>
            matchesFacet(String(row.getValue(columnId)), value as string[]),
          cell: (cell) => {
            const presentation =
              ASSET_CRITICALITY_PRESENTATION[cell.getValue()];
            return (
              <StatusChip
                tone={presentation.tone}
                icon={presentation.icon}
                label={tCriticality(cell.getValue())}
              />
            );
          },
        }),
        columnHelper.accessor("installedOn", {
          id: "installedOn",
          header: t("columns.installedOn"),
          cell: (cell) => (
            <span className="tabular-nums">
              {format.dateTime(new Date(`${cell.getValue()}T12:00:00Z`), "day")}
            </span>
          ),
        }),
        columnHelper.display({
          id: "actions",
          header: () => <span className="sr-only">{t("columns.actions")}</span>,
          enableHiding: false,
          cell: (cell) => (
            <DataTableRowActions
              label={t("rowActions", { tag: cell.row.original.assetTag })}
              actions={[
                {
                  key: "work-order",
                  label: t("actions.newWorkOrder"),
                  icon: <Wrench data-icon="inline-start" />,
                  onSelect: () =>
                    router.push(
                      `/work-orders?asset=${cell.row.original.assetTag}`,
                    ),
                },
                {
                  key: "copy",
                  label: t("actions.copyTag"),
                  icon: <ClipboardCopy data-icon="inline-start" />,
                  onSelect: () => {
                    void navigator.clipboard
                      ?.writeText(cell.row.original.assetTag)
                      .then(() =>
                        toast.success(
                          t("actions.copied", {
                            tag: cell.row.original.assetTag,
                          }),
                        ),
                      );
                  },
                },
              ]}
            />
          ),
        }),
      ] as ColumnDef<DataTableFeatures, AssetRow, unknown>[],
    [t, tStatus, tCriticality, format, router],
  );

  const { table, breakpoint } = useDataTable({
    data: rows,
    columns,
    priorities: COLUMN_PRIORITIES,
    // The search box searches the tag, the name and the location, and nothing
    // else. `matchesSearch` is where that decision lives and is unit tested.
    globalFilterFn: (row, _columnId, filterValue) =>
      matchesSearch(row.original, String(filterValue ?? "")),
  });

  if (status !== "ready" || !repositories) {
    return <DataTableSkeleton columns={6} />;
  }

  const columnLabels: Record<string, string> = {
    name: t("columns.name"),
    typeLabel: t("columns.type"),
    facilityName: t("columns.facility"),
    locationCode: t("columns.location"),
    status: t("columns.status"),
    criticality: t("columns.criticality"),
    installedOn: t("columns.installedOn"),
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
              column={table.getColumn("facilityName")!}
              label={t("columns.facility")}
              optionLabel={(value) => value}
            />
            <DataTableFacetFilter
              column={table.getColumn("typeLabel")!}
              label={t("columns.type")}
              optionLabel={(value) => value}
            />
            <DataTableFacetFilter
              column={table.getColumn("status")!}
              label={t("columns.status")}
              optionLabel={(value) =>
                tStatus(value as Parameters<typeof tStatus>[0])
              }
            />
            <DataTableFacetFilter
              column={table.getColumn("criticality")!}
              label={t("columns.criticality")}
              optionLabel={(value) =>
                tCriticality(value as Parameters<typeof tCriticality>[0])
              }
            />
          </>
        }
      />

      <DataTable
        table={table}
        breakpoint={breakpoint}
        caption={t("caption")}
        empty={<ModulePanel moduleKey="assets" />}
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
                href={`/assets/${row.original.assetTag}`}
                className="inline-flex min-h-11 items-center rounded-sm font-mono text-xs font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {row.original.assetTag}
              </Link>
              <DataTableRowActions
                label={t("rowActions", { tag: row.original.assetTag })}
                actions={[
                  {
                    key: "work-order",
                    label: t("actions.newWorkOrder"),
                    onSelect: () =>
                      router.push(
                        `/work-orders?asset=${row.original.assetTag}`,
                      ),
                  },
                ]}
              />
            </div>
            <p className="text-sm font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.facilityName} · {row.original.locationCode}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <StatusChip
                tone={ASSET_STATUS_PRESENTATION[row.original.status].tone}
                icon={ASSET_STATUS_PRESENTATION[row.original.status].icon}
                label={tStatus(row.original.status)}
              />
              <StatusChip
                tone={
                  ASSET_CRITICALITY_PRESENTATION[row.original.criticality].tone
                }
                icon={
                  ASSET_CRITICALITY_PRESENTATION[row.original.criticality].icon
                }
                label={tCriticality(row.original.criticality)}
              />
            </div>
          </article>
        )}
      />

      <DataTablePagination table={table} />
    </div>
  );
}
