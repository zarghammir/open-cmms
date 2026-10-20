import { Boxes, CircleCheck, TriangleAlert } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { AssetPanel } from "@/components/assets/asset-panel";
import { isBelowMinimum } from "@/domain/constants/part";
import { StatusChip } from "@/components/shared/status-chip";
import type { Part } from "@/domain/types";
import { Link } from "@/i18n/navigation";
import { textFor } from "@/lib/localized-text";

/**
 * Spares this asset has actually had fitted.
 *
 * There is no asset-to-part relation in the model, because in life there is not
 * one either: a filter fits a family of units, not one machine. What is true of
 * this asset is what has been issued against its own work orders, which is what
 * `useAsset` derives. Listing every part held at the same site instead would
 * put a hundred unrelated spares on every asset and mean nothing.
 *
 * Stock level is a computed condition rather than a stored state, so its tone
 * and icon live here rather than in a presentation map. WA-12 owns inventory
 * and can formalise it if the same pairing turns up a second time.
 */
export function AssetParts({ parts }: { parts: Part[] }) {
  const t = useTranslations("assetDetail.parts");
  const format = useFormatter();
  const locale = useLocale();

  return (
    <AssetPanel
      title={t("title")}
      description={t("description")}
      rows={parts}
      emptyIcon={Boxes}
      emptyTitle={t("emptyTitle")}
      emptyBody={t("emptyBody")}
    >
      {(rows) => (
        <ul className="flex flex-col">
          {rows.map((part) => {
            const low = isBelowMinimum(part);

            return (
              <li
                key={part.id}
                className="border-b border-border last:border-b-0"
              >
                <Link
                  href={{
                    pathname: "/inventory",
                    query: { part: part.partNumber },
                  }}
                  className="flex flex-col gap-1 rounded-sm px-1 py-2.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-2xs tracking-[0.12em] text-muted-foreground uppercase">
                      {part.partNumber}
                    </span>
                    <StatusChip
                      tone={low ? "critical" : "positive"}
                      icon={low ? TriangleAlert : CircleCheck}
                      label={low ? t("low") : t("ok")}
                    />
                  </span>
                  <span className="text-sm font-medium">
                    {textFor(part.name, locale)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("stock", {
                      onHand: format.number(part.quantityOnHand, "integer"),
                      minimum: format.number(part.reorderPoint, "integer"),
                    })}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AssetPanel>
  );
}
