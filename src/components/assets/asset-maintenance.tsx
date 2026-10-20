import { CalendarSync } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { AssetPanel } from "@/components/assets/asset-panel";
import type {
  IsoDate,
  MaintenancePlan,
  MaintenanceSchedule,
} from "@/domain/types";
import { calendarDate, daysBetweenDays } from "@/lib/dates";
import { textFor } from "@/lib/localized-text";

/**
 * The plans this asset is on, and when each is next due.
 *
 * A visit whose date has passed is said to be late in words, not left as a date
 * the reader has to compare against today themselves — that comparison is the
 * one thing the screen can do better than the person reading it.
 */
export function AssetMaintenance({
  schedules,
  plans,
  today,
}: {
  schedules: MaintenanceSchedule[];
  plans: MaintenancePlan[];
  today: IsoDate;
}) {
  const t = useTranslations("assetDetail.maintenance");
  const format = useFormatter();
  const locale = useLocale();

  const planById = new Map(plans.map((plan) => [plan.id, plan]));

  return (
    <AssetPanel
      title={t("title")}
      description={t("description")}
      rows={schedules}
      emptyIcon={CalendarSync}
      emptyTitle={t("emptyTitle")}
      emptyBody={t("emptyBody")}
    >
      {(rows) => (
        <ul className="flex flex-col">
          {rows.map((schedule) => {
            const plan = planById.get(schedule.planId);
            const days = daysBetweenDays(today, schedule.nextDueOn);

            return (
              <li
                key={schedule.id}
                className="flex flex-col gap-1 border-b border-border py-2.5 last:border-b-0"
              >
                <span className="text-sm font-medium">
                  {plan ? textFor(plan.name, locale) : t("unreadablePlan")}
                </span>
                <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span>
                    {days < 0
                      ? t("overdueBy", { days: Math.abs(days) })
                      : days === 0
                        ? t("dueToday")
                        : t("dueIn", {
                            days,
                            date: format.dateTime(
                              calendarDate(schedule.nextDueOn),
                              "day",
                            ),
                          })}
                  </span>
                  {plan ? (
                    <>
                      <span aria-hidden="true">{"·"}</span>
                      <span>{t(`frequency.${plan.frequency}`)}</span>
                    </>
                  ) : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  {schedule.lastCompletedOn
                    ? t("lastDone", {
                        date: format.dateTime(
                          calendarDate(schedule.lastCompletedOn),
                          "day",
                        ),
                      })
                    : t("neverDone")}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </AssetPanel>
  );
}
