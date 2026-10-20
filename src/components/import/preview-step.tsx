"use client";

import { Boxes } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { useDataTable } from "@/components/data-table/use-data-table";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { textFor } from "@/lib/localized-text";
import type { ImportRun } from "@/lib/import/run";

/**
 * What the import would create, before anything is written.
 *
 * The rows are the records themselves, not the spreadsheet rows they came
 * from: a blocked row is not here, and two rows sharing a tag are one record.
 * So the count on this screen is the count that gets committed, from the same
 * run — there is no second pass to disagree with the first.
 */

interface PreviewRow {
  id: string;
  kind: "assets" | "parts" | "workOrders";
  identifier: string;
  name: string;
  /** Empty when the record has no place of its own, never a stand-in value. */
  place: string;
  /**
   * What is known about time on this record. An imported work order has no
   * labour entries, so the answer is "no time logged" — never zero, which
   * would claim somebody worked on it for no minutes.
   */
  time: string | null;
}

const columnHelper = createColumnHelper<DataTableFeatures, PreviewRow>();

export function PreviewStep({ run }: { run: ImportRun | null }) {
  const t = useTranslations("import.preview");
  const locale = useLocale();

  const rows = useMemo<PreviewRow[]>(() => {
    if (!run) return [];
    const { assets, parts, workOrders } = run.records;
    return [
      ...assets.map((asset) => ({
        id: asset.id,
        kind: "assets" as const,
        identifier: asset.assetTag,
        name: textFor(asset.name, locale),
        place: asset.locationId,
        time: null,
      })),
      ...parts.map((part) => ({
        id: part.id,
        kind: "parts" as const,
        identifier: part.partNumber,
        name: textFor(part.name, locale),
        place: part.inventoryLocationId,
        time: null,
      })),
      ...workOrders.map((order) => ({
        id: order.id,
        kind: "workOrders" as const,
        identifier: order.number,
        name: textFor(order.title, locale),
        place: order.locationId,
        // Nothing has been worked on it: an imported order arrives with no
        // labour entries at all, which is not the same as zero minutes.
        time: null,
      })),
    ];
  }, [run, locale]);

  const columns = useMemo(
    () =>
      [
        columnHelper.accessor("identifier", {
          id: "identifier",
          header: t("identifier"),
        }),
        columnHelper.accessor("kind", {
          id: "kind",
          header: t("kind"),
          cell: (info) => t(info.getValue()),
        }),
        columnHelper.accessor("name", { id: "name", header: t("name") }),
      ] as ColumnDef<DataTableFeatures, PreviewRow, unknown>[],
    [t],
  );

  const { table, breakpoint } = useDataTable({
    data: rows,
    columns,
    priorities: [
      { id: "identifier", priority: 1 },
      { id: "kind", priority: 2 },
      { id: "name", priority: 1 },
    ],
  });

  if (run === null || rows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Boxes />
          </EmptyMedia>
          <EmptyTitle className="text-base">{t("emptyTitle")}</EmptyTitle>
          <EmptyDescription>{t("emptyBody")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {t("assets")}: {run.counts.assets}
        </Badge>
        <Badge variant="secondary">
          {t("parts")}: {run.counts.parts}
        </Badge>
        <Badge variant="secondary">
          {t("workOrders")}: {run.counts.workOrders}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {t("total", { count: run.counts.total })}
        </span>
      </div>

      {/* Said once, plainly, rather than as a column of identical cells. */}
      <p className="text-sm text-muted-foreground">{t("timeNote")}</p>

      <DataTable<PreviewRow>
        table={table}
        breakpoint={breakpoint}
        caption={t("caption")}
        empty={
          <Empty>
            <EmptyHeader>
              <EmptyTitle className="text-base">{t("emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("emptyBody")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        }
        noResults={
          <Empty>
            <EmptyHeader>
              <EmptyTitle className="text-base">
                {t("noResultsTitle")}
              </EmptyTitle>
              <EmptyDescription>{t("noResultsBody")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        }
        renderCard={(row) => (
          <div className="flex flex-col gap-1 border-b border-border p-3">
            <span className="font-mono text-sm font-semibold">
              {row.original.identifier}
            </span>
            <span className="text-sm">{row.original.name}</span>
            <span className="text-sm text-muted-foreground">
              {t("noTimeLogged")}
            </span>
          </div>
        )}
      />
    </div>
  );
}
