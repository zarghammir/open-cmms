"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useScheduleRows } from "@/hooks/use-schedule-rows";
import { useToday } from "@/hooks/use-today";
import { calendarDate } from "@/lib/dates";
import { Link } from "@/i18n/navigation";
import { monthOf, shiftMonth, weeksInMonth, type ScheduleRow } from "./rows";

/**
 * The month, as a list grouped by week.
 *
 * Ruled for Phase 1 in place of a grid, and the reason is worth keeping: a
 * month grid that only shows a dot per day looks like a calendar without
 * behaving like one — a planner cannot read what is due from it, and would
 * click every cell. A grouped list says the same thing in the order they read
 * it, and a real grid is its own ticket if the proposal wants the picture.
 *
 * Only days with visits appear. A month has thirty-odd days and a planner's has
 * work on a handful; drawing the empty ones buries the work in blanks.
 */
export function MonthScreen() {
  const t = useTranslations("maintenanceMonth");
  const tTable = useTranslations("maintenanceTable");
  const format = useFormatter();
  const today = useToday();
  const { rows, unreadable } = useScheduleRows();
  const [at, setAt] = useState(() => monthOf(today));

  const weeks = weeksInMonth(rows, at);
  // The first of the month, for naming it. Built from the picker's own numbers
  // rather than from a visit, so an empty month is still named.
  const firstOfMonth = calendarDate(
    `${at.year}-${String(at.month).padStart(2, "0")}-01`,
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          aria-label={t("previous")}
          onClick={() => setAt(shiftMonth(at, -1))}
        >
          <ChevronLeft />
        </Button>
        <span
          data-slot="month-label"
          className="min-w-44 text-center text-sm font-medium"
        >
          {format.dateTime(firstOfMonth, "monthYear")}
        </span>
        <Button
          variant="outline"
          size="sm"
          aria-label={t("next")}
          onClick={() => setAt(shiftMonth(at, 1))}
        >
          <ChevronRight />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setAt(monthOf(today))}>
          {t("thisMonth")}
        </Button>
      </div>

      {unreadable > 0 ? (
        <p
          data-slot="schedules-unreadable"
          className="text-sm text-muted-foreground"
        >
          {tTable("unreadable", { count: unreadable })}
        </p>
      ) : null}

      {weeks.length === 0 ? (
        /*
         * Named, not blank. "Nothing in September 2026" is an answer; an empty
         * area is a screen that might have failed to load.
         */
        <p data-slot="month-empty" className="text-sm text-muted-foreground">
          {t("nothing", { month: format.dateTime(firstOfMonth, "monthYear") })}
        </p>
      ) : (
        <ol data-slot="month-weeks" className="flex flex-col gap-4">
          {weeks.map((week) => (
            <li key={week.startsOn} className="flex flex-col gap-2">
              <h3 className="text-xs text-muted-foreground">
                {t("weekOf", {
                  date: format.dateTime(calendarDate(week.startsOn), "day"),
                })}
              </h3>
              <ol className="flex flex-col gap-2">
                {week.days.map((day) => (
                  <li
                    key={day.day}
                    data-slot="month-day"
                    className="flex flex-col gap-1 rounded-md border border-border bg-card p-3"
                  >
                    <p className="text-sm font-medium">
                      {format.dateTime(calendarDate(day.day), "dayWeekday")}
                    </p>
                    <ul className="flex flex-col gap-1">
                      {day.rows.map((row) => (
                        <li key={row.id}>
                          <Visit row={row} />
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** One visit on a day: what, on which machine, and whether it is late. */
function Visit({ row }: { row: ScheduleRow }) {
  const t = useTranslations("maintenanceTable");

  return (
    <span className="flex flex-wrap items-baseline gap-x-2 text-sm">
      <Link
        href={`/assets/${row.assetTag}`}
        className="rounded-sm font-mono text-xs font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {row.assetTag}
      </Link>
      <span>{row.planName}</span>
      {row.due.kind === "late" ? (
        <span className="text-xs text-status-critical tabular-nums">
          {t("due.late", { days: row.due.days })}
        </span>
      ) : null}
      {row.openOrderNumber ? (
        // The order already raised, named rather than implied — a planner
        // looking at the month wants to know this visit is in hand.
        <Link
          href={`/work-orders/${row.openOrderNumber}`}
          className="rounded-sm font-mono text-xs text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {row.openOrderNumber}
        </Link>
      ) : null}
    </span>
  );
}
