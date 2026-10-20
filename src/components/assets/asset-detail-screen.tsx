"use client";

import { Pencil } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
// `useSearchParams` has no locale-aware counterpart in `@/i18n/navigation`: it
// reads the query string, which the locale prefix does not touch. `Link` and
// `usePathname` do, and come from there.
import { useSearchParams } from "next/navigation";
import { AssetDocuments } from "@/components/assets/asset-documents";
import { AssetHistory } from "@/components/assets/asset-history";
import { AssetInspections } from "@/components/assets/asset-inspections";
import { AssetMaintenance } from "@/components/assets/asset-maintenance";
import { AssetOverview } from "@/components/assets/asset-overview";
import { AssetParts } from "@/components/assets/asset-parts";
import { AssetWorkOrders } from "@/components/assets/asset-work-orders";
import { AssetEditDialog } from "@/components/assets/asset-edit-dialog";
import {
  ASSET_TABS,
  resolveAssetTab,
  type AssetTab,
} from "@/components/assets/asset-tabs";
import {
  AssetCriticalityChip,
  AssetStatusChip,
} from "@/components/shared/asset-chips";
import { CapabilityAction } from "@/components/shared/capability-action";
import { LabelScreen } from "@/components/shared/label-screen";
import { RecordMissing } from "@/components/shared/record-missing";
import { LoadingState } from "@/components/shared/state-panels";
import { can, type Role } from "@/domain/constants/roles";
import { useAsset, type AssetDetail } from "@/hooks/use-asset";
import { Link, usePathname } from "@/i18n/navigation";
import { textFor } from "@/lib/localized-text";
import { cn } from "cn";

/**
 * One asset, and everything that hangs off it.
 *
 * Three answers, not two. `unknown` is the moment before the browser has read
 * the records back, and it draws a skeleton. `missing` is a tag this system
 * does not hold — which is somebody standing in front of a machine with a label
 * in their hand, so it names the tag back rather than showing an empty asset.
 *
 * The missing panel is WA-16's `RecordMissing`, the same one the label route and
 * the scanner show, so a tag that resolves to nothing says the same thing
 * wherever a person arrives from.
 */
export function AssetDetailScreen({ tag, role }: { tag: string; role: Role }) {
  const t = useTranslations("assetDetail");
  const searchParams = useSearchParams();
  const lookup = useAsset(tag);

  if (lookup.state === "unknown") {
    return <LoadingState rows={6} />;
  }

  if (lookup.state === "missing") {
    return (
      <RecordMissing
        identifier={tag}
        action={
          <Link
            href="/assets"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {t("backToAssets")}
          </Link>
        }
      />
    );
  }

  return (
    <AssetDetailBody
      detail={lookup.detail}
      role={role}
      tab={resolveAssetTab(searchParams.get("tab"))}
    />
  );
}

function AssetDetailBody({
  detail,
  role,
  tab,
}: {
  detail: AssetDetail;
  role: Role;
  tab: AssetTab;
}) {
  const t = useTranslations("assetDetail");
  const locale = useLocale();
  const pathname = usePathname();
  const { asset, type, facility, locationPath } = detail;

  const place = [
    facility ? textFor(facility.name, locale) : null,
    ...locationPath.map((location) => textFor(location.name, locale)),
  ].filter((part): part is string => part !== null);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-col gap-1.5">
          {/* The tag is the page heading now; repeating it here made two. */}
          <h2 className="text-xl">{textFor(asset.name, locale)}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <AssetStatusChip status={asset.status} />
            <AssetCriticalityChip criticality={asset.criticality} />
            {type ? (
              <span className="text-xs text-muted-foreground">
                {textFor(type.label, locale)}
              </span>
            ) : null}
          </div>
          {place.length > 0 ? (
            <p
              data-testid="asset-place"
              className="text-xs text-muted-foreground"
            >
              {place.join(" › ")}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("locationUnknown")}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {can(role, "asset.edit") ? (
            <AssetEditDialog asset={asset} role={role} />
          ) : (
            <CapabilityAction
              role={role}
              capability="asset.edit"
              label={t("edit.action")}
              icon={<Pencil data-icon="inline-start" />}
            />
          )}
        </div>
      </header>

      {/*
        An underlined tab nav, not a bordered card. The accent is bottom-only
        and the corner radius is top-only, so the two never meet: the radius is
        invisible at rest — the link has no background — and is there to shape
        the focus ring, which the design system specifies as a 2px ring at 2px
        offset on a 4px radius scale. Drop it and this one nav gets a square
        focus ring. `-mb-px` lifts the accent over the nav's own hairline so the
        current section reads as one 2px line rather than as two stacked rules.
      */}
      <nav aria-label={t("sections")} className="border-b border-border">
        <ul className="-mb-px flex flex-wrap gap-1">
          {ASSET_TABS.map((key) => {
            const current = key === tab;
            return (
              <li key={key}>
                <Link
                  href={{ pathname, query: { tab: key } }}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-9 items-center rounded-t-sm border-b-2 px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    current
                      ? "border-primary font-medium text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(`tabs.${key}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {tab === "overview" ? <AssetOverview detail={detail} /> : null}
      {tab === "history" ? <AssetHistory entries={detail.history} /> : null}
      {tab === "workOrders" ? (
        <AssetWorkOrders orders={detail.workOrders} today={detail.today} />
      ) : null}
      {tab === "maintenance" ? (
        <AssetMaintenance
          schedules={detail.schedules}
          plans={detail.plans}
          today={detail.today}
        />
      ) : null}
      {tab === "inspections" ? (
        <AssetInspections inspections={detail.inspections} />
      ) : null}
      {tab === "documents" ? (
        <AssetDocuments documents={detail.documents} />
      ) : null}
      {tab === "parts" ? <AssetParts parts={detail.parts} /> : null}
      {/*
        One import. The label is a route of its own at /assets/<tag>/label,
        which is where a scan lands and what a printed sticker resolves to, and
        it stays that way — this mounts the same component rather than growing a
        second way of drawing a label that could drift from the printed one.
      */}
      {tab === "label" ? (
        <LabelScreen kind="asset" identifier={detail.asset.assetTag} />
      ) : null}
    </div>
  );
}
