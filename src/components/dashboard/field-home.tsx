"use client";

import { CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { DashboardPanel } from "@/components/dashboard/panel";
import { WorkRowItem } from "@/components/dashboard/work-row-item";
import type { Role } from "@/domain/constants/roles";
import { useMyWork } from "@/hooks/use-dashboard";

/**
 * The field home: this person's own open work, most urgent first.
 *
 * Not a dashboard. A technician standing in a corridor does not need the
 * organisation's totals; they need to know what to do next and to be able to
 * hit it with a thumb, which is why the rows are 44px and there is nothing else
 * on the screen competing with them.
 *
 * "Assigned to me" means assigned to this person. Work carrying a crew code and
 * nobody's name is somebody's problem but it is not this person's, and the
 * selector keeps the two apart rather than showing everything unclaimed.
 */
export function FieldHome({ role }: { role: Role }) {
  const t = useTranslations("dashboard.myWork");
  const { rows } = useMyWork(role);

  return (
    <DashboardPanel
      title={t("title")}
      description={t("description")}
      rows={rows}
      emptyIcon={CircleCheck}
      emptyTitle={t("emptyTitle")}
      emptyBody={t("emptyBody")}
      skeletonRows={4}
    >
      {(assignments) => (
        <ul data-testid="my-work-rows" className="flex flex-col">
          {assignments.map((row) => (
            <WorkRowItem key={row.id} row={row} size="field" />
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}
