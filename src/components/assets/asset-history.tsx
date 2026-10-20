import { History } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { AssetPanel } from "@/components/assets/asset-panel";
import { InspectionStatusChip } from "@/components/shared/inspection-chip";
import { WorkOrderStatusChip } from "@/components/shared/work-order-chips";
import type { HistoryEntry } from "@/data/selectors/asset-history";
import { useAuditSummary } from "@/hooks/use-audit-summary";
import { Link } from "@/i18n/navigation";
import { textFor } from "@/lib/localized-text";

/**
 * Everything that has happened to this asset, as one chronology.
 *
 * Four kinds of record in one list, newest first, because the question a person
 * brings to an asset is "what has been done to this thing" and the answer is
 * not four separate answers. Each row says which kind it is in words, so the
 * list does not rely on the reader inferring it from shape.
 */
export function AssetHistory({ entries }: { entries: HistoryEntry[] }) {
  const t = useTranslations("assetDetail.history");
  const format = useFormatter();
  const locale = useLocale();
  const summarise = useAuditSummary(t("unreadableChange"));

  return (
    <AssetPanel
      title={t("title")}
      description={t("description")}
      rows={entries}
      emptyIcon={History}
      emptyTitle={t("emptyTitle")}
      emptyBody={t("emptyBody")}
    >
      {(rows) => (
        <ol data-testid="asset-history" className="flex flex-col">
          {rows.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-1 border-b border-border py-2.5 last:border-b-0"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-2xs tracking-[0.12em] text-muted-foreground uppercase">
                  {t(`kind.${entry.kind}`)}
                </span>
                {entry.kind === "workOrder" ? (
                  <WorkOrderStatusChip status={entry.order.status} />
                ) : null}
                {entry.kind === "inspection" ? (
                  <InspectionStatusChip status={entry.inspection.status} />
                ) : null}
              </span>

              <span className="text-sm">
                {entry.kind === "workOrder" ? (
                  <Link
                    href={`/work-orders/${entry.order.number}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {entry.order.number} {"—"}{" "}
                    {textFor(entry.order.title, locale)}
                  </Link>
                ) : null}

                {entry.kind === "inspection"
                  ? entry.template
                    ? textFor(entry.template.name, locale)
                    : t("unreadableChecklist")
                  : null}

                {entry.kind === "movement"
                  ? t("movement", {
                      quantity: Math.abs(entry.transaction.quantity),
                      part: entry.part
                        ? textFor(entry.part.name, locale)
                        : t("unreadablePart"),
                      order: entry.workOrderNumber,
                    })
                  : null}

                {entry.kind === "audit" ? summarise(entry.event) : null}
              </span>

              <span className="text-xs text-muted-foreground">
                {format.dateTime(new Date(entry.at), "dayTime")}
              </span>
            </li>
          ))}
        </ol>
      )}
    </AssetPanel>
  );
}
