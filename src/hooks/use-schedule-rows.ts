"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { scheduleReading } from "@/data/selectors/maintenance-schedules";
import { useDemoData } from "@/hooks/use-demo-data";
import { useToday } from "@/hooks/use-today";
import { readDue, type ScheduleRow } from "@/components/maintenance/rows";
import { textFor } from "@/lib/localized-text";

/**
 * The planned visits as rows, and how many could not be read.
 *
 * Shared by the two views of the same records — the list and the month — so
 * that "12 days late" and "could not be read" cannot come out differently
 * depending on which one a planner is looking at. Written once here rather than
 * twice in the screens, which is the mistake the inventory work kept finding in
 * other people's code and would have made here.
 */
export interface ScheduleRows {
  rows: ScheduleRow[];
  /** Visits whose plan or asset this system cannot read. Zero is an answer. */
  unreadable: number;
}

export function useScheduleRows(): ScheduleRows {
  const { data } = useDemoData();
  const locale = useLocale();
  const today = useToday();
  const tFrequency = useTranslations("scheduleFrequency");

  return useMemo<ScheduleRows>(() => {
    if (!data) return { rows: [], unreadable: 0 };
    const reading = scheduleReading(data);

    return {
      unreadable: reading.unreadable,
      rows: reading.resolved.map(
        ({ schedule, plan, asset, facility, openOrder }) => ({
          id: schedule.id,
          assetId: asset.id,
          assetTag: asset.assetTag,
          assetName: textFor(asset.name, locale),
          planId: plan.id,
          planName: textFor(plan.name, locale),
          frequency: plan.frequency,
          frequencyLabel: tFrequency(plan.frequency),
          nextDueOn: schedule.nextDueOn,
          due: readDue(schedule.nextDueOn, today, plan.leadTimeDays),
          lastCompletedOn: schedule.lastCompletedOn,
          facilityId: asset.facilityId,
          facilityCity: facility
            ? textFor(facility.city, locale)
            : asset.facilityId,
          facilityName: facility
            ? textFor(facility.name, locale)
            : asset.facilityId,
          openOrderNumber: openOrder ? openOrder.number : null,
        }),
      ),
    };
  }, [data, locale, today, tFrequency]);
}
