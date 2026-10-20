"use client";

import { useLocale, useTranslations } from "next-intl";
import { FloorMapStateChip } from "@/components/facilities/floor-map-chips";
import { RaiseFromMapDialog } from "@/components/facilities/raise-from-map-dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import type { PlacedAsset } from "@/data/selectors/floor-map";
import type { Role } from "@/domain/constants/roles";
import { Link } from "@/i18n/navigation";
import { textFor } from "@/lib/localized-text";

/**
 * The machine a person has picked, and what is open against it.
 *
 * **A marker nobody can read gets its own panel, not an empty one.** When the
 * placement names an asset the records no longer hold, this says exactly that:
 * the position is on file and the machine is not. Drawing a blank panel would
 * leave a reader to conclude the floor has a clear machine standing there.
 *
 * The counts are `null` in that case rather than zero, and nothing here invents
 * a nought to fill the space — "no open work" is a claim about a machine, and
 * there is no machine to make it about.
 */
export function FloorAssetPanel({
  selected,
  role,
}: {
  selected: PlacedAsset | null;
  role: Role;
}) {
  const t = useTranslations("floorMap");
  const locale = useLocale();

  if (!selected) {
    return (
      <Empty className="border bg-card">
        <EmptyHeader>
          <EmptyTitle className="text-base">
            {t("nothingSelectedTitle")}
          </EmptyTitle>
          <EmptyDescription>{t("nothingSelectedBody")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  /*
   * The counts travel with the machine: a marker that resolves has all of them,
   * one that does not has none. Asked together rather than separately, because
   * reading them apart would let a `?? 0` in one branch print "no open work"
   * about a machine the records do not hold.
   */
  const { asset, openCount, overdueCount, lowParts, openOrders } = selected;
  if (
    !asset ||
    openCount === null ||
    overdueCount === null ||
    lowParts === null ||
    openOrders === null
  ) {
    return (
      <Empty className="border bg-card">
        <EmptyHeader>
          <EmptyTitle className="text-base">
            {t("unreadableMarkerTitle")}
          </EmptyTitle>
          <EmptyDescription>{t("unreadableMarkerBody")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <section
      aria-label={t("selectedTitle")}
      className="flex flex-col gap-3 rounded-md border bg-card p-4"
    >
      <div className="flex flex-col gap-1">
        <span className="font-mono text-sm font-medium">{asset.assetTag}</span>
        <span className="text-sm text-muted-foreground">
          {textFor(asset.name, locale)}
        </span>
      </div>

      <FloorMapStateChip state={selected.state} />

      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex gap-2">
          <dt className="sr-only">{t("open")}</dt>
          <dd>{t("openCount", { count: openCount })}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="sr-only">{t("overdue")}</dt>
          <dd>{t("overdueCount", { count: overdueCount })}</dd>
        </div>
        {/*
          The spares line is always drawn, including when it is a nought.

          The outline is ranked — late work outranks work in hand, which
          outranks a shelf running low — so a machine with open work never shows
          the low-stock colour even when a spare is under its minimum. Printing
          the count here is what stops the ranking from hiding a fact: the
          colour is a summary and this is the record.
        */}
        <div className="flex gap-2">
          <dt className="sr-only">{t("lowStock")}</dt>
          <dd>{t("lowPartsCount", { count: lowParts })}</dd>
        </div>
      </dl>

      {/*
        The open work itself, not only how much of it there is.

        A count tells a person there is something to look at and then makes them
        go and find it; the panel is opened from a machine on a plan, and the
        next thing anybody wants is the job. Newest first, the order the queue
        uses.
      */}
      {openOrders.length > 0 ? (
        <section
          className="flex flex-col gap-1"
          aria-label={t("openOrdersTitle")}
        >
          <h3 className="text-xs font-medium text-muted-foreground">
            {t("openOrdersTitle")}
          </h3>
          <ul className="flex flex-col">
            {openOrders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/work-orders/${order.number}`}
                  aria-label={t("openOrderLink", { number: order.number })}
                  className="flex min-h-11 flex-wrap items-center gap-2 rounded-sm px-1 underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="font-mono text-xs font-medium">
                    {order.number}
                  </span>
                  <span className="text-sm">
                    {textFor(order.title, locale)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {/*
          Raised here rather than on the work-order screen: the map is where the
          problem is noticed. The outline on the plan changes as soon as the
          order is stored, because the map is drawn from the same records the
          write lands in — no reload, and nothing to go and check.
        */}
        <RaiseFromMapDialog asset={asset} role={role} />
        <Link
          href={`/assets/${asset.assetTag}`}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          {t("openInRegister", { tag: asset.assetTag })}
        </Link>
      </div>
    </section>
  );
}
