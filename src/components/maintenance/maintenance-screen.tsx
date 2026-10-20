"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Role } from "@/domain/constants/roles";
import { MonthScreen } from "./month-screen";
import { PlansScreen } from "./plans-screen";
import { SchedulesScreen } from "./schedules-screen";

/**
 * Preventive maintenance, which is two questions rather than one.
 *
 * "What is due?" is the planner's daily screen and "what do we service, and how
 * often?" is the one they set up and then rarely touch. They are different
 * enough that a single table would have to answer both badly — the visits list
 * repeats a plan's name once per machine, and the plans list cannot say what is
 * late. The month is the first question again, read by date instead of by
 * urgency, which is how somebody plans a week rather than works a day.
 *
 * A toggle rather than two navigation entries, because the module has one place
 * in the sidebar and a second would suggest two features. The state is local:
 * a reader who wants to send somebody a link is sending them the module, and
 * `?view=` would be machinery for a case the demonstration does not have.
 * Worth revisiting if anyone asks for a deep link.
 */
export function MaintenanceScreen({ role }: { role: Role }) {
  const t = useTranslations("maintenanceViews");
  const [view, setView] = useState<"visits" | "month" | "plans">("visits");

  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup
        type="single"
        value={view}
        /*
         * `type="single"` hands back an **empty string** when the pressed item
         * is pressed again, and an empty view is not one of the three answers —
         * so a repeated press keeps the current view rather than emptying the
         * screen.
         *
         * Every caller of this control in the product guards that case, in
         * three different ways: `locale-switcher` with `if (!next …) return`,
         * `asset-edit-dialog` with `value && setValue(…)`, and this one by
         * naming its three answers. That it is handled everywhere is the point
         * — it is a contract each caller has had to learn separately rather
         * than a defect anyone has hit.
         */
        onValueChange={(next) => {
          if (next === "visits" || next === "month" || next === "plans") {
            setView(next);
          }
        }}
        variant="outline"
        size="sm"
        aria-label={t("label")}
        data-slot="maintenance-views"
      >
        <ToggleGroupItem value="visits">{t("visits")}</ToggleGroupItem>
        <ToggleGroupItem value="month">{t("month")}</ToggleGroupItem>
        <ToggleGroupItem value="plans">{t("plans")}</ToggleGroupItem>
      </ToggleGroup>

      {view === "visits" ? <SchedulesScreen role={role} /> : null}
      {view === "month" ? <MonthScreen /> : null}
      {view === "plans" ? <PlansScreen /> : null}
    </div>
  );
}
