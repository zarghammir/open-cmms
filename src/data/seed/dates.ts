import type { IsoDate, IsoDateTime } from "@/domain/types";

/**
 * Dates in the seed are relative to the day the demo is opened, so a reviewer
 * never sees a dashboard full of work that was due last year.
 *
 * Everything is computed from one `today`, which `buildSeed` takes as an
 * argument. Nothing here reads the clock: a function that called `new Date()`
 * would make the seed untestable and unrepeatable.
 *
 * The application's time zone is fixed (America/Toronto) so a date never
 * changes between the server and the browser; these helpers work in whole
 * days on top of that.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The start of `today` in UTC terms, so day arithmetic never drifts. */
export function startOfDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** `2026-09-12`. */
export function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

/** A full instant. Minutes and hours are given, never taken from the clock. */
export function toIsoDateTime(
  day: Date,
  hour: number,
  minute: number,
): IsoDateTime {
  const withTime = new Date(day.getTime());
  withTime.setUTCHours(hour, minute, 0, 0);
  return withTime.toISOString();
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}
