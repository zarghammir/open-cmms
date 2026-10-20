import type { IsoDate, ScheduleFrequency } from "@/domain/types";

/**
 * How long a frequency is, in days.
 *
 * One definition, because two would drift. The seed builds its schedules from
 * this and the repository advances them by it, so "quarterly" cannot mean 91
 * days when a visit is planned and 90 when it is completed — which is the kind
 * of disagreement nobody notices until a compliance figure is wrong.
 *
 * Calendar months are deliberately not used. A plan that says "every quarter"
 * is a service interval, not a date in the month, and a technician servicing an
 * air handler on the 31st should not be asked to do it on the 28th in February.
 * Fixed periods also make the arithmetic the same on every machine.
 */
export const FREQUENCY_DAYS: Record<ScheduleFrequency, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 91,
  semiAnnual: 182,
  annual: 365,
};

/**
 * The next due date after a visit was completed.
 *
 * From the day it was **done**, not from the day it was due. A visit run three
 * weeks late does not owe the next one three weeks early: the interval is how
 * long the equipment can go between services, so it starts when the service
 * happened. Measuring from the due date would compress every interval after a
 * late visit and quietly make a plan stricter than it says it is.
 */
export function nextDueAfter(
  completedOn: IsoDate,
  frequency: ScheduleFrequency,
): IsoDate {
  const day = new Date(`${completedOn}T00:00:00.000Z`);
  day.setUTCDate(day.getUTCDate() + FREQUENCY_DAYS[frequency]);
  return day.toISOString().slice(0, 10) as IsoDate;
}

/**
 * The first day an order may be raised for a visit.
 *
 * `leadTimeDays` before it is due, so the work can be planned rather than
 * discovered on the day. A plan with no lead time is raised on the due date.
 */
export function raisableFrom(
  nextDueOn: IsoDate,
  leadTimeDays: number,
): IsoDate {
  const day = new Date(`${nextDueOn}T00:00:00.000Z`);
  day.setUTCDate(day.getUTCDate() - leadTimeDays);
  return day.toISOString().slice(0, 10) as IsoDate;
}
