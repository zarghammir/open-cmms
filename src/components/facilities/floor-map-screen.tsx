"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { FloorAssetPanel } from "@/components/facilities/floor-asset-panel";
import { FloorPlan } from "@/components/facilities/floor-plan";
import { FloorRoomPanel } from "@/components/facilities/floor-room-panel";
import { RecordMissing } from "@/components/shared/record-missing";
import { LoadingState } from "@/components/shared/state-panels";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import type { Role } from "@/domain/constants/roles";
import type { FloorMapDetail } from "@/hooks/use-floor-map";
import { useFloorMap } from "@/hooks/use-floor-map";
import { Link } from "@/i18n/navigation";

/**
 * One floor: the drawing, the rooms, and whatever is selected.
 *
 * **Four answers about the address, three about the drawing, and none of them
 * is drawn as an empty floor.** The store may still be unread; the code may
 * name nothing; it may name a room rather than a floor; and a floor that does
 * resolve may have a drawing, may have been surveyed with no drawing on file,
 * or may never have been looked at. Each says which of those it is, because a
 * blank plan says the floor is bare, which is a claim about the estate rather
 * than about our records.
 *
 * The room list is drawn in every one of those cases except the first. A floor
 * with no plan still has equipment standing on it, and the person reading the
 * screen came to find out what.
 */
export function FloorMapScreen({
  floorCode,
  role,
}: {
  floorCode: string;
  role: Role;
}) {
  const t = useTranslations("floorMap");
  // The kinds are the facilities catalogue’s, where the tree already names
  // them. One source, so the map cannot call a room something else.
  const kinds = useTranslations("facilities");
  const lookup = useFloorMap(floorCode);

  if (lookup.state === "unknown") return <LoadingState rows={6} />;

  if (lookup.state === "missing") {
    return (
      <RecordMissing
        identifier={floorCode}
        body={t("missingBody", { identifier: floorCode })}
        action={<BackToPlaces />}
      />
    );
  }

  if (lookup.state === "notAFloor") {
    return (
      <Empty className="border bg-card">
        <EmptyHeader>
          <EmptyTitle className="text-base">
            {t("notAFloorTitle", { code: lookup.location.code })}
          </EmptyTitle>
          <EmptyDescription>
            {t("notAFloorBody", {
              code: lookup.location.code,
              kind: kinds(`kind.${lookup.location.kind}`),
            })}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return <FloorMapBody detail={lookup.detail} role={role} />;
}

function BackToPlaces() {
  const t = useTranslations("floorMap");

  return (
    <Link
      href="/facilities"
      className="text-sm text-primary underline-offset-4 hover:underline"
    >
      {t("backToFacilities")}
    </Link>
  );
}

function FloorMapBody({
  detail,
  role,
}: {
  detail: FloorMapDetail;
  role: Role;
}) {
  const t = useTranslations("floorMap");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { view, rooms, floor } = detail;

  const selected =
    view.placed.find((one) => one.placement.id === selectedId) ?? null;

  return (
    /*
     * **Side by side only from 1440, and the value has moved twice today.**
     *
     * It was 1024. Six of eight footprints measured below the 24×24 target
     * floor there, because a true footprint is only as big as the machine and
     * the plan was 347px wide — so it went to 1280. Then the canvas grew a
     * metre on the west so the exit door could be drawn swinging out, which
     * made every shape 5.6% smaller on screen and took the smallest back to
     * **24.8 at 1280**: over the criterion and under the 26 we ship, which is
     * the criterion plus enough room that browser rounding cannot decide it.
     *
     * So 1280 stacks and the plan takes the full width. An arbitrary value
     * rather than a Tailwind step because the number is 1440: `2xl` is 1536 and
     * would have made 1440 itself stack, which is the width the plan is
     * measured at side by side.
     */
    <div className="flex flex-col gap-6 min-[1440px]:flex-row min-[1440px]:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {view.drawing.kind === "drawn" ? (
          <FloorPlan
            image={view.drawing.image}
            alt={t("planAlt", { floor: floor.code })}
            placed={view.placed}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        ) : (
          <Empty className="border bg-card">
            <EmptyHeader>
              <EmptyTitle className="text-base">
                {view.drawing.kind === "none"
                  ? t("noDrawingTitle")
                  : t("unrecordedTitle")}
              </EmptyTitle>
              <EmptyDescription>
                {view.drawing.kind === "none"
                  ? t("noDrawingBody")
                  : t("unrecordedBody")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        <FloorAssetPanel selected={selected} role={role} />

        {view.unplaced.length > 0 && view.drawing.kind === "drawn" ? (
          <section
            aria-label={t("unplacedTitle")}
            className="flex flex-col gap-1 rounded-md border bg-card p-4"
          >
            <h2 className="text-sm font-medium">{t("unplacedTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("unplacedBody")}</p>
            <ul className="flex flex-col pt-1">
              {view.unplaced.map((asset) => (
                <li key={asset.id} className="font-mono text-xs">
                  {asset.assetTag}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <FloorRoomPanel
          rooms={rooms}
          placed={view.placed}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>
    </div>
  );
}
