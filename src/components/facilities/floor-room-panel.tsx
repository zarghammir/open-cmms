"use client";

import { useLocale, useTranslations } from "next-intl";
import { FloorMapStateChip } from "@/components/facilities/floor-map-chips";
import { Badge } from "@/components/ui/badge";
import type { PlacedAsset } from "@/data/selectors/floor-map";
import type { Asset, Location } from "@/domain/types";
import { Link } from "@/i18n/navigation";
import { textFor } from "@/lib/localized-text";
import { cn } from "cn";

/**
 * The floor read as rooms rather than as a picture.
 *
 * **The list is the map's equal, not its caption.** Every machine on the floor
 * appears here whether or not the plan can draw it, so a reader who cannot use
 * the drawing — no plan on file, a phone, a screen reader — still gets the
 * whole floor. A room with nothing in it says so; it is not left out, because
 * an absent room reads as a room that does not exist.
 *
 * A machine that is on the plan carries a button that selects its marker, and
 * one that is not carries a badge saying so. Both are shown: hiding the ones
 * the drawing cannot place would make the map look complete when it is not.
 */
export function FloorRoomPanel({
  rooms,
  placed,
  selectedId,
  onSelect,
}: {
  rooms: { room: Location; assets: Asset[] }[];
  placed: PlacedAsset[];
  selectedId: string | null;
  onSelect: (placementId: string) => void;
}) {
  const t = useTranslations("floorMap");
  const locale = useLocale();

  const markerFor = new Map(
    placed.flatMap((one) => (one.asset ? [[one.asset.id, one] as const] : [])),
  );

  return (
    <section aria-label={t("roomsTitle")} className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">{t("roomsTitle")}</h2>

      <ul className="flex flex-col gap-3">
        {rooms.map(({ room, assets }) => (
          <li key={room.id} className="rounded-md border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-medium">{room.code}</span>
              <span className="text-sm text-muted-foreground">
                {textFor(room.name, locale)}
              </span>
            </div>

            {assets.length === 0 ? (
              <p className="pt-2 text-sm text-muted-foreground">
                {t("roomEmpty")}
              </p>
            ) : (
              <ul className="flex flex-col gap-2 pt-2">
                {assets.map((asset) => {
                  const marker = markerFor.get(asset.id);
                  const selected =
                    marker !== undefined && marker.placement.id === selectedId;

                  return (
                    <li
                      key={asset.id}
                      className="flex flex-wrap items-center gap-2"
                    >
                      {marker ? (
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => onSelect(marker.placement.id)}
                          className={cn(
                            "flex min-h-11 items-center gap-2 rounded-sm px-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                            selected && "bg-accent",
                          )}
                        >
                          <span className="font-mono text-xs font-medium">
                            {asset.assetTag}
                          </span>
                          <span className="text-sm">
                            {textFor(asset.name, locale)}
                          </span>
                          <span className="sr-only">
                            {t("showOnPlan", { tag: asset.assetTag })}
                          </span>
                        </button>
                      ) : (
                        <span className="flex min-h-11 items-center gap-2 px-1">
                          <span className="font-mono text-xs font-medium">
                            {asset.assetTag}
                          </span>
                          <span className="text-sm">
                            {textFor(asset.name, locale)}
                          </span>
                          <Badge variant="outline">{t("notOnThePlan")}</Badge>
                        </span>
                      )}

                      {marker ? (
                        <FloorMapStateChip state={marker.state} />
                      ) : null}

                      <Link
                        href={`/assets/${asset.assetTag}`}
                        aria-label={t("openInRegister", {
                          tag: asset.assetTag,
                        })}
                        className="text-xs text-primary underline-offset-4 hover:underline"
                      >
                        {t("registerLink")}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
