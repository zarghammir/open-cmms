import { CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { DashboardPanel } from "@/components/dashboard/panel";
import { WorkRowItem } from "@/components/dashboard/work-row-item";
import type { WorkRow } from "@/data/selectors/dashboard";

/**
 * What is wrong, first thing.
 *
 * This is the panel the demonstration opens on, and the reason the dashboard
 * exists: an evaluator should see the worst thing in the organisation without
 * scrolling and without choosing a filter. The ordering is the selector's —
 * late work before merely critical work — so what is at the top of this list is
 * a fact about the records, not about the markup.
 */
export function ExceptionsPanel({ rows }: { rows: WorkRow[] | null }) {
  const t = useTranslations("dashboard.exceptions");

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
      {(exceptions) => (
        <ul data-testid="exception-rows" className="flex flex-col">
          {exceptions.map((row) => (
            <WorkRowItem key={row.id} row={row} />
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}
