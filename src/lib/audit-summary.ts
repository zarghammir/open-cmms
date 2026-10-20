/**
 * Which audit entries a screen knows how to say out loud.
 *
 * An entry stores a catalogue key and its arguments rather than a sentence, so
 * a change recorded in August still reads correctly in the French demo in
 * October. The catalogue is typed, which means the sentence has to be built by
 * naming the key and its arguments explicitly — and that in turn means there is
 * a set of keys the screens handle, and the possibility of an entry outside it.
 *
 * This is that set, kept away from the component so it can be checked without a
 * browser. `tests/unit/audit-keys.test.ts` reads the repositories and the
 * catalogue and fails if either grows a key that is not listed here, which is
 * the only thing standing between a new audit entry and a row that reads "a
 * change was recorded" in a demonstration.
 */

import type { AuditEvent } from "@/domain/types";

/**
 * The half of an audit entry a sentence is built from.
 *
 * A change that is waiting to be sent and a change that has been recorded are
 * the same sentence at two different times: the outbox carries a
 * `MutationAudit`, the trail carries an `AuditEvent`, and both hold a catalogue
 * key and its arguments. Naming that shape is what lets the screen saying what
 * a change *will* do use the same words as the screen saying what it *did* —
 * the alternative is a second vocabulary, which is a second place for an entry
 * to come out as "a change was recorded".
 */
export type AuditPhrase = Pick<AuditEvent, "summaryKey" | "summaryParams">;

export const HANDLED_AUDIT_KEYS = [
  "workOrderCreated",
  "statusChanged",
  "workOrderAssigned",
  "workOrderReassigned",
  "workOrderReassignedFromCrew",
  "workOrderReassignedFromUnreadable",
  "workOrderCompleted",
  "workOrderCancelled",
  "taskTicked",
  "taskUnticked",
  "labourLogged",
  "assetUpdated",
  "partIssued",
  "partAdjusted",
  "notificationRead",
  "notificationsAllRead",
  "notificationsRaised",
  "notificationChannelOn",
  "notificationChannelOff",
  "demoReset",
  "documentUploaded",
  "reportExported",
  "importCommitted",
  "importRolledBack",
  "conflictKeptMine",
  "conflictKeptTheirs",
  "dataRebuilt",
  "dataRefreshed",
  // WA-124: an administrator managing people. Separate keys rather than one
  // "user updated" with the field as an argument, because the four sentences
  // differ in more than a noun and a catalogue cannot build grammar.
  "userRoleChanged",
  "userSiteChanged",
  "userDeactivated",
  "userReactivated",
  // WA-112: the rules an administrator changes. Each is a separate key rather
  // than one "a rule changed" with the rule as an argument, because the
  // sentences differ in more than a noun and a catalogue cannot build grammar.
  "workflowMoveEnabled",
  "workflowMoveDisabled",
  "waitingForPartsEnabled",
  "waitingForPartsDisabled",
  "completionNoteRequired",
  "completionNoteOptional",
  "prioritySlaChanged",
  "notificationDefaultOn",
  "notificationDefaultOff",
] as const;

export type HandledAuditKey = (typeof HANDLED_AUDIT_KEYS)[number];

export const AUDIT_NAMESPACE = "audit.";
export const STATUS_NAMESPACE = "workOrderStatus.";
export const REASON_NAMESPACE = "cancellationReason.";
export const ROLE_NAMESPACE = "roles.";
export const PRIORITY_NAMESPACE = "priority.";

/**
 * Every namespace a key-valued argument can be stamped with.
 *
 * One list, read from three places: `auditSummaryParams` stamps them,
 * `useAuditSummary` dispatches on them, and the hook's own test asserts no
 * rendered sentence still contains one. That third reader is the reason this
 * is a list rather than four loose constants — a namespace stamped with no
 * branch to turn it back into a word renders the raw key in the middle of a
 * sentence, identically in both languages, and every other check passes
 * because a sentence with a key in it is still a sentence.
 *
 * Two shipped that way before the list existed: `roles.` in WA-124, caught by
 * a browser test reading the trail, and `priority.` in WA-112, which had been
 * on main reading "Set the priority.critical target to 4 hours" and was found
 * only by sweeping the family the first one belonged to.
 */
export const KEY_VALUED_NAMESPACES = [
  STATUS_NAMESPACE,
  REASON_NAMESPACE,
  ROLE_NAMESPACE,
  PRIORITY_NAMESPACE,
] as const;

/** The bare key when a screen can render it, null when it cannot. */
export function handledAuditKey(summaryKey: string): HandledAuditKey | null {
  const bare = summaryKey.startsWith(AUDIT_NAMESPACE)
    ? summaryKey.slice(AUDIT_NAMESPACE.length)
    : summaryKey;

  return (HANDLED_AUDIT_KEYS as readonly string[]).includes(bare)
    ? (bare as HandledAuditKey)
    : null;
}

/**
 * An argument that is present and has something in it, or null.
 *
 * A missing argument is not an empty one: `"{number} moved to {status}"` with
 * no number reads as a sentence with a hole in it, and a hole in a maintenance
 * record is worse than an honest "a change was recorded".
 */
export function auditArgument(
  params: Record<string, string | number>,
  name: string,
): string | null {
  const found = params[name];
  if (found === undefined || found === null) return null;
  const text = String(found);
  return text.trim() === "" ? null : text;
}
