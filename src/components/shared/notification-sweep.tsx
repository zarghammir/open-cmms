"use client";

import { useNotificationSweep } from "@/hooks/use-notification-sweep";

/**
 * Runs the notification rules, on every screen, in both shells.
 *
 * Mounted beside `DemoBoot` for the same reason it is: the rules have to run
 * somewhere on the client, and a screen is the wrong place for it — a rule
 * that only fired on the work-orders page would leave a technician on the scan
 * screen never hearing that a job had landed on them.
 *
 * It draws nothing. The marker is for the browser tests, and it carries the
 * number of notices the last pass wrote rather than a bare "it ran": a test
 * that made an event happen can tell "the rules ran and found nothing" from
 * "the rules never ran", and those look identical from the outside.
 *
 * It takes no role. The rules address every person the records name, not the
 * one holding the demonstration — and since a sweep writes no trail entry,
 * there is nobody to sign it as either.
 */
export function NotificationSweep() {
  const marker = useNotificationSweep();

  return (
    <span
      ref={marker}
      hidden
      data-slot="notification-sweep"
      data-sweep-passes="0"
      data-sweep-wrote="0"
    />
  );
}
