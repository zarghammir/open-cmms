import { CalendarSync } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { DashboardPanel } from "@/components/dashboard/panel";
import type { MaintenanceRow } from "@/data/selectors/dashboard";
import { Link } from "@/i18n/navigation";
import { calendarDate } from "@/lib/dates";
import { textFor } from "@/lib/localized-text";

/**
 * The fortnight ahead.
 *
 * Deliberately only forward-looking: a visit whose date has already passed is
 * late maintenance, and late work belongs with the exceptions rather than in a
 * plan for the next two weeks. Showing it in both places would let a reviewer
 * count the same problem twice.
 */
export function UpcomingPanel({ rows }: { rows: MaintenanceRow[] | null }) {
  const t = useTranslations("dashboard.upcoming");
  const format = useFormatter();
  const locale = useLocale();

  return (
    <DashboardPanel
      title={t("title")}
      description={t("description")}
      rows={rows}
      emptyIcon={CalendarSync}
      emptyTitle={t("emptyTitle")}
      emptyBody={t("emptyBody")}
    >
      {(upcoming) => (
        <ul className="flex flex-col">
          {upcoming.map((row) => (
            <li key={row.id} className="border-b border-border last:border-b-0">
              <Link
                href={{
                  pathname: "/preventive-maintenance",
                  query: { plan: row.planId },
                }}
                className="flex flex-col gap-1 rounded-sm px-1 py-2.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono text-2xs tracking-[0.12em] text-muted-foreground uppercase">
                    {row.assetTag ?? t("unknownAsset")}
                  </span>
                  <span className="text-sm font-medium">
                    {row.planName
                      ? textFor(row.planName, locale)
                      : t("unknownPlan")}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {row.daysUntil === 0
                    ? t("dueToday")
                    : t("dueIn", {
                        days: row.daysUntil,
                        date: format.dateTime(
                          calendarDate(row.nextDueOn),
                          "day",
                        ),
                      })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}
