import type { Notification } from "@/domain/types";

/**
 * Where a notification goes when somebody presses it.
 *
 * Built from the notification's own **arguments**, not from the record it
 * points at. `subject` holds an `Id`, and AGENTS.md is explicit that a route
 * names a record by the identifier people say out loud — an address built on
 * an `Id` stops resolving the moment somebody presses Reset, because the seed
 * rebuilds every record. The work-order number and the stock number are
 * already in `params`, because they are what the sentence says.
 *
 * **Null is an answer.** An inspection has no screen of its own until WA-20,
 * so an inspection notice is drawn without a link rather than with one that
 * goes nowhere: a control that looks like a link and does nothing is worse
 * than a line of text, and a person who presses it twice concludes the
 * application is broken.
 */
export function hrefFor(notification: Notification): string | null {
  const { entity } = notification.subject;
  const params = notification.params;

  if (entity === "workOrder" && typeof params.number === "string") {
    return `/work-orders/${params.number}`;
  }
  if (entity === "part" && typeof params.partNumber === "string") {
    return `/inventory/${params.partNumber}`;
  }
  return null;
}
