import { ClipboardCheck } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { AssetPanel } from "@/components/assets/asset-panel";
import { InspectionStatusChip } from "@/components/shared/inspection-chip";
import type { Inspection, InspectionTemplate } from "@/domain/types";
import { calendarDate } from "@/lib/dates";
import { textFor } from "@/lib/localized-text";

/**
 * What has been inspected on this asset, and what was found.
 *
 * An inspection that has not happened is shown by the day it is due; one that
 * has is shown by the day it was done. They are different facts and the row
 * says which it is rather than printing a bare date and leaving the reader to
 * guess whether it is past or future.
 */
export function AssetInspections({
  inspections,
}: {
  inspections: {
    inspection: Inspection;
    template: InspectionTemplate | null;
  }[];
}) {
  const t = useTranslations("assetDetail.inspections");
  const format = useFormatter();
  const locale = useLocale();

  return (
    <AssetPanel
      title={t("title")}
      description={t("description")}
      rows={inspections}
      emptyIcon={ClipboardCheck}
      emptyTitle={t("emptyTitle")}
      emptyBody={t("emptyBody")}
    >
      {(rows) => (
        <ul className="flex flex-col">
          {rows.map(({ inspection, template }) => (
            <li
              key={inspection.id}
              className="flex flex-col gap-1 border-b border-border py-2.5 last:border-b-0"
            >
              <span className="flex flex-wrap items-center gap-2">
                <InspectionStatusChip status={inspection.status} />
                <span className="text-sm font-medium">
                  {template
                    ? textFor(template.name, locale)
                    : t("unreadableChecklist")}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                {inspection.performedAt
                  ? t("performedOn", {
                      date: format.dateTime(
                        new Date(inspection.performedAt),
                        "day",
                      ),
                    })
                  : t("scheduledFor", {
                      date: format.dateTime(
                        calendarDate(inspection.scheduledFor),
                        "day",
                      ),
                    })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </AssetPanel>
  );
}
