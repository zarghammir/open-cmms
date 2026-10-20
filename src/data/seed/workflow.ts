import { NOTIFIABLE_KINDS } from "@/domain/types/notification";
import type {
  Id,
  NotificationDefault,
  WorkflowRule,
  WorkOrderPriority,
} from "@/domain/types";

/**
 * The administrator's rules, seeded to exactly what the application already did.
 *
 * **Nothing here changes a single thing a person can see.** That is the point
 * and it is worth stating as a requirement rather than a nicety: the version
 * bump that carries these two collections rebuilds every reviewer's records,
 * and a rebuild that also changed behaviour would make it impossible to tell
 * the two apart the first time somebody said "this screen looks different".
 *
 * So: no transition is switched off, a completion note is still required, and
 * every notifiable kind still arrives both in the bell and in the mail log —
 * which is what `notificationPreferences` already seeds for every person.
 */

/**
 * How long each priority is meant to take.
 *
 * **Displayed, never enforced**, and the numbers are a plausible target for a
 * laboratory estate rather than a standard anybody has ratified: same day for
 * critical, one working day for high, a week for medium, a month for low.
 * Nothing measures an order against them yet — see the type's own note and this
 * ticket's Deviations.
 */
const SLA_HOURS: Readonly<Record<WorkOrderPriority, number>> = {
  critical: 4,
  high: 24,
  medium: 168,
  low: 720,
};

export function buildWorkflowRules(organizationId: Id): WorkflowRule[] {
  return [
    {
      id: "wfr-1",
      organizationId,
      // Empty, so the effective flow is the domain's map exactly as it was.
      disabledTransitions: [],
      // True, which is what `complete()` enforced unconditionally before it
      // was a rule at all.
      requireCompletionNote: true,
      prioritySlaHours: SLA_HOURS,
    },
  ];
}

/**
 * What somebody who has never opened the preferences screen hears about.
 *
 * One row per notifiable kind, both channels on — the same answer
 * `notificationPreferences` already seeds for every person, so an
 * administrator reading this panel sees the organisation's actual behaviour
 * rather than a second set of numbers that happens to agree with it today.
 */
export function buildNotificationDefaults(
  organizationId: Id,
): NotificationDefault[] {
  return NOTIFIABLE_KINDS.map((kind) => ({
    id: `nde-${kind}`,
    organizationId,
    kind,
    inApp: true,
    email: true,
  }));
}
