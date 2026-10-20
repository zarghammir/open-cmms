import type { Formats } from "next-intl";

/**
 * Global formats, so a date or a quantity looks identical everywhere it
 * appears. Reference them by name: `format.dateTime(value, "day")`.
 */
export const formats = {
  dateTime: {
    /** 12 Sep 2026 — the default for a date shown in a table cell. */
    day: {
      year: "numeric",
      month: "short",
      day: "numeric",
    },
    /** Friday 12 September 2026 — for the "today" line on a home screen. */
    dayFull: {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    },
    /** 12 September 2026 — for record detail headers. */
    dayLong: {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
    /**
     * 12 Sep 2026, 14:05 — for audit and history entries.
     *
     * `hour12: false` is deliberate. Left to itself en-CA prints "02:05 p.m."
     * while fr-CA prints "14:05", and a maintenance record that changes clock
     * convention with the interface language is unreadable across a shift
     * handover. Both languages use the 24-hour clock.
     */
    dayTime: {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
    /**
     * September 2026 — for naming the month a calendar is showing.
     *
     * The month in words rather than a number, because "09/2026" is read
     * differently on either side of an ocean and this application is read in
     * two languages already.
     */
    monthYear: {
      year: "numeric",
      month: "long",
    },
    /**
     * Monday, 14 Sep — for a day inside a month that is already named.
     *
     * The weekday is the point: a planner reading a month decides what to do on
     * a Tuesday, and the year is redundant under a heading that carries it.
     */
    dayWeekday: {
      weekday: "long",
      month: "short",
      day: "numeric",
    },
    /** 14:05 — for a time on its own. */
    time: {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
  },
  number: {
    integer: {
      maximumFractionDigits: 0,
    },
    decimal: {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
    currency: {
      style: "currency",
      currency: "CAD",
      currencyDisplay: "narrowSymbol",
    },
  },
} satisfies Formats;
