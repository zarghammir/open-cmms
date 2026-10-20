"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { FloorMapScreen } from "@/components/facilities/floor-map-screen";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, Select } from "@/components/work-orders/field";
import type { Role } from "@/domain/constants/roles";
import { hasRecords } from "@/hooks/use-demo-data";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useDrawnFloors } from "@/hooks/use-floor-map";
import { textFor } from "@/lib/localized-text";

/**
 * The map half of the Facilities screen.
 *
 * **The phone gets the list, and that is the ticket's decision rather than a
 * shortcut.** A floor plan at 390 is smaller than the machines drawn on it: the
 * narrowest marker measures 25px across, the plan itself about 356px wide, and
 * a person holding a phone in a plant room is looking for one machine rather
 * than surveying a floor. The rooms carry everything the plan does, so this
 * says which width the plan starts at and shows the list instead of a picture
 * nobody can use.
 *
 * **A picker rather than a route per floor.** The route still exists and still
 * works — it is what the tree's own link opens — but a reader who chose "Map"
 * asked to look at floors, and making them go back to the tree to pick a second
 * one is the kind of navigation that reads as a prototype.
 */
export function FacilitiesMapView({
  role,
  list,
}: {
  role: Role;
  /** The list view, drawn instead of the plan on a phone. */
  list: React.ReactNode;
}) {
  const t = useTranslations("floorMap");
  const locale = useLocale();
  const width = useBreakpoint();
  const { status, floors } = useDrawnFloors();
  const [chosen, setChosen] = useState<string | null>(null);

  if (!hasRecords(status)) {
    // Never an empty picker while the store is unread: no floors and no answer
    // are different claims, and only one of them is true at that moment.
    return <DataTableSkeleton columns={2} />;
  }

  if (width === "phone") {
    return (
      <div className="flex flex-col gap-4">
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyTitle className="text-base">{t("onPhoneTitle")}</EmptyTitle>
            <EmptyDescription>{t("onPhoneBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
        {list}
      </div>
    );
  }

  if (floors.length === 0) {
    /*
     * A real answer, not an error. One drawing is on file today; the rest of
     * the estate has none, and a reader who switches to Map before any exist
     * should be told that rather than shown an empty frame.
     */
    return (
      <div className="flex flex-col gap-4">
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyTitle className="text-base">{t("noPlansTitle")}</EmptyTitle>
            <EmptyDescription>{t("noPlansBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
        {list}
      </div>
    );
  }

  const code = chosen ?? floors[0]!.code;

  return (
    <div className="flex flex-col gap-4">
      {/*
        One drawing, one floor: a picker offering a single answer is a control
        that cannot be used, so it is drawn only when there is a choice to make.
      */}
      {floors.length > 1 ? (
        <Field id="facilities-map-floor" label={t("floorLabel")}>
          {(props) => (
            <Select
              {...props}
              value={code}
              onChange={(event) => setChosen(event.target.value)}
            >
              {floors.map((floor) => (
                <option key={floor.id} value={floor.code}>
                  {floor.code} — {textFor(floor.name, locale)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}

      <FloorMapScreen floorCode={code} role={role} />
    </div>
  );
}
