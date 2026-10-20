import type { IsoDate } from "@/domain/types";

/**
 * Calendar days, for screens.
 *
 * `src/data/seed/dates.ts` builds the records; this is the other end — turning
 * a stored day into something the formatter can print, and measuring the
 * distance between two days.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * A stored day as a `Date` the formatter will print unchanged.
 *
 * `new Date("2026-09-12")` is midnight UTC, and every screen renders in
 * America/Toronto, four or five hours behind it — so a due date handed over
 * that way prints as the eleventh. Every date in the demo would be a day early,
 * consistently enough to look deliberate.
 *
 * Noon UTC is the same calendar day in every zone this product runs in, which
 * is what makes it safe to hand to `format.dateTime`.
 */
export function calendarDate(day: IsoDate): Date {
  return new Date(`${day}T12:00:00.000Z`);
}

/**
 * Whole days from one stored day to another. Negative when `to` is the earlier
 * of the two, zero when they are the same day.
 */
export function daysBetweenDays(from: IsoDate, to: IsoDate): number {
  return Math.round(
    (calendarDate(to).getTime() - calendarDate(from).getTime()) / MS_PER_DAY,
  );
}
