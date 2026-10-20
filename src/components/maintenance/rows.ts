import type { Id, IsoDate, ScheduleFrequency } from "@/domain/types";

/**
 * The rows the two preventive-maintenance registers are drawn from.
 *
 * Type aliases rather than interfaces, for the reason `AssetRow` gives:
 * TanStack's `RowData` constraint is `Record<string, any>` and an interface has
 * no implicit index signature.
 *
 * Flat and already in the reader's language, so sorting and filtering work on
 * the value a person can see rather than on a nested record.
 */

/** How a visit's date reads, rather than a date to compare against today. */
export type DueReading =
  | { kind: "late"; days: number }
  | { kind: "today" }
  | { kind: "soon"; days: number }
  | { kind: "ahead"; days: number };

export type ScheduleRow = {
  id: Id;
  assetId: Id;
  assetTag: string;
  assetName: string;
  planId: Id;
  planName: string;
  frequency: ScheduleFrequency;
  frequencyLabel: string;
  nextDueOn: IsoDate;
  due: DueReading;
  lastCompletedOn: IsoDate | null;
  facilityId: Id;
  facilityCity: string;
  facilityName: string;
  /**
   * The number of the order already raised for this visit, or null.
   *
   * Null is two different things collapsed on purpose, and the collapse is safe
   * here: no order raised, and an order that has since been completed or
   * cancelled. Both mean the same thing to a planner looking at this column —
   * there is nothing outstanding — and the detail page is where the history
   * belongs.
   */
  openOrderNumber: string | null;
};

export type PlanRow = {
  id: Id;
  code: string;
  name: string;
  assetTypeLabel: string;
  frequency: ScheduleFrequency;
  frequencyLabel: string;
  leadTimeDays: number;
  estimatedMinutes: number;
  /** How many assets are on this plan. Zero is a real answer. */
  scheduleCount: number;
  active: boolean;
};

/**
 * Whether a schedule row matches what somebody typed.
 *
 * The asset tag, the asset name and the plan name. Not the frequency or the
 * site: both have facets, and a search that returned rows not containing what
 * was typed reads as broken rather than generous.
 */
export function matchesScheduleSearch(
  row: ScheduleRow,
  query: string,
): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (needle.length === 0) return true;

  return [row.assetTag, row.assetName, row.planName].some((value) =>
    value.toLocaleLowerCase().includes(needle),
  );
}

/** The code and the name, for the same reason. */
export function matchesPlanSearch(row: PlanRow, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (needle.length === 0) return true;

  return [row.code, row.name].some((value) =>
    value.toLocaleLowerCase().includes(needle),
  );
}

/**
 * How far off a visit is, as the four answers a planner acts on.
 *
 * `soon` is separated from `ahead` because they are different decisions: a
 * visit inside its lead time can be raised now, and one beyond it cannot be
 * raised at all yet. Drawing them the same way would put a row on the screen
 * that looks actionable and is not.
 *
 * Late is late by whole days, counted from the due date rather than described
 * as a date the reader has to compare — that comparison is the one thing the
 * screen can do better than the person reading it.
 */
export function readDue(
  nextDueOn: IsoDate,
  today: IsoDate,
  leadTimeDays: number,
): DueReading {
  const days = Math.round(
    (Date.parse(`${nextDueOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      86_400_000,
  );
  if (days < 0) return { kind: "late", days: -days };
  if (days === 0) return { kind: "today" };
  return days <= leadTimeDays
    ? { kind: "soon", days }
    : { kind: "ahead", days };
}

/** A month, as the picker moves through them. `month` is 1-12. */
export interface CalendarMonth {
  year: number;
  month: number;
}

export interface CalendarDay {
  day: IsoDate;
  rows: ScheduleRow[];
}

export interface CalendarWeek {
  /** The Monday the week starts on, whether or not it is in this month. */
  startsOn: IsoDate;
  days: CalendarDay[];
}

function isoDay(date: Date): IsoDate {
  return date.toISOString().slice(0, 10) as IsoDate;
}

/** The Monday on or before a day. */
export function startOfWeek(day: IsoDate): IsoDate {
  const date = new Date(`${day}T00:00:00.000Z`);
  // `getUTCDay` is 0 for Sunday, and the week starts on Monday here — so
  // Sunday walks back six days rather than none.
  const back = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - back);
  return isoDay(date);
}

export function monthOf(day: IsoDate): CalendarMonth {
  return { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) };
}

/** The month before or after this one, rolling the year over. */
export function shiftMonth(at: CalendarMonth, by: number): CalendarMonth {
  const zero = at.month - 1 + by;
  return {
    year: at.year + Math.floor(zero / 12),
    month: (((zero % 12) + 12) % 12) + 1,
  };
}

/**
 * One month's visits, grouped by week and then by day.
 *
 * **Only days that have visits become rows.** A month is thirty-odd days and a
 * planner's month has visits on perhaps eight of them; drawing the empty ones
 * would bury the work in blanks. This is a list grouped by week rather than a
 * grid, which is the shape ruled for Phase 1 — a real month grid is its own
 * ticket, and a thin one would look like a calendar without behaving like one.
 *
 * Weeks are keyed on the Monday they start, including a Monday in the previous
 * month: a visit on the 1st belongs to the week it falls in, not to a week that
 * starts on the 1st because the month does.
 */
export function weeksInMonth(
  rows: readonly ScheduleRow[],
  at: CalendarMonth,
): CalendarWeek[] {
  const prefix = `${at.year}-${String(at.month).padStart(2, "0")}`;
  const byDay = new Map<string, ScheduleRow[]>();

  for (const row of rows) {
    if (!row.nextDueOn.startsWith(prefix)) continue;
    const existing = byDay.get(row.nextDueOn);
    if (existing) existing.push(row);
    else byDay.set(row.nextDueOn, [row]);
  }

  const byWeek = new Map<string, CalendarDay[]>();
  for (const day of [...byDay.keys()].sort()) {
    const week = startOfWeek(day as IsoDate);
    const entry: CalendarDay = { day: day as IsoDate, rows: byDay.get(day)! };
    const existing = byWeek.get(week);
    if (existing) existing.push(entry);
    else byWeek.set(week, [entry]);
  }

  return [...byWeek.keys()].sort().map((startsOn) => ({
    startsOn: startsOn as IsoDate,
    days: byWeek.get(startsOn)!,
  }));
}
