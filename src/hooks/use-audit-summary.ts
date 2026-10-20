"use client";

import { useFormatter, useTranslations } from "next-intl";
import { auditSummaryParams } from "@/data/selectors/audit-text";
import { calendarDate } from "@/lib/dates";
import { isWorkOrderStatus } from "@/domain/constants/work-order-status";
import { ROLES } from "@/domain/constants/roles";
import {
  CANCELLATION_REASONS,
  WORK_ORDER_PRIORITIES,
} from "@/domain/types/work-order";
import {
  auditArgument,
  handledAuditKey,
  PRIORITY_NAMESPACE,
  REASON_NAMESPACE,
  ROLE_NAMESPACE,
  STATUS_NAMESPACE,
  type AuditPhrase,
} from "@/lib/audit-summary";

/**
 * Turns one audit entry into a sentence.
 *
 * An entry stores a catalogue key and its arguments, never a sentence, so a
 * change recorded in August still reads correctly in the French demo in
 * October. This is the half that turns it back.
 *
 * Each key is named in its own branch rather than passed through in a variable,
 * because the catalogue is typed down to the arguments a message takes: naming
 * them is the only way to be sure `statusChanged` is given a number and a
 * status. `tests/unit/audit-keys.test.ts` reads the repositories and fails if
 * any of them writes a key this does not handle.
 *
 * Extracted from the dashboard's activity feed when the asset page became the
 * second thing that had to read the trail. The `fallback` is the caller's
 * because the sentence for an entry nobody can phrase belongs to the screen
 * saying it, not to this.
 *
 * It takes the phrase-shaped half of an entry rather than a whole `AuditEvent`,
 * because a change waiting in the outbox carries the same key and arguments
 * before it is sent as the trail carries after. One vocabulary for what a
 * change will do and what it did; a second would be a second place to drift.
 */
export function useAuditSummary(
  fallback: string,
): (event: AuditPhrase) => string {
  const tAudit = useTranslations("audit");
  const tStatus = useTranslations("workOrderStatus");
  const tReason = useTranslations("cancellationReason");
  const tRoles = useTranslations("roles");
  const tPriority = useTranslations("priority");
  const format = useFormatter();

  /**
   * The other half of `auditSummaryParams`' contract: it hands back
   * `workOrderStatus.<value>` for the one argument holding a domain value, and
   * this turns that into the word for it. A value the domain does not know is
   * shown as it was stored rather than swallowed.
   */
  function translateStatus(key: string): string {
    const bare = key.startsWith(STATUS_NAMESPACE)
      ? key.slice(STATUS_NAMESPACE.length)
      : key;
    return isWorkOrderStatus(bare) ? tStatus(bare) : bare;
  }

  /**
   * The other kind of argument that is not a literal.
   *
   * A stored day is `2026-09-14`, and printing it into a sentence puts an
   * unformatted date beside a formatted timestamp on the same row — and in
   * French it reads "pour le 2026-09-14", which is not French. Same shape as
   * `translateStatus` above: the value is stored as the record of a fact, and
   * turned into the reader's words on the way out.
   *
   * `calendarDate` rather than `new Date(day)`, because every screen renders
   * in America/Toronto and midnight UTC is the day before there.
   */
  function asCalendarDay(day: string): string {
    return format.dateTime(calendarDate(day), "day");
  }

  /**
   * The cancellation reason, the same way the status is handled.
   *
   * `auditSummaryParams` hands back `cancellationReason.<value>`; this turns it
   * into the words for it. A reason the domain does not know is shown as it was
   * stored rather than swallowed — an unrecognised value is still a record of
   * something, and hiding it would leave a sentence with a hole where the
   * decision should be.
   */
  function translateReason(key: string): string {
    const bare = key.startsWith(REASON_NAMESPACE)
      ? key.slice(REASON_NAMESPACE.length)
      : key;
    return (CANCELLATION_REASONS as readonly string[]).includes(bare)
      ? tReason(bare as (typeof CANCELLATION_REASONS)[number])
      : bare;
  }

  /**
   * A role, which is stored as `technician` and is not a word in either
   * language. `auditSummaryParams` hands back `roles.<value>.name`, so the
   * suffix comes off as well as the prefix. A role the system does not know is
   * shown as it was stored rather than swallowed, the same as a status.
   */
  function translateRole(key: string): string {
    const bare = key
      .slice(key.startsWith(ROLE_NAMESPACE) ? ROLE_NAMESPACE.length : 0)
      .replace(/\.name$/, "");
    return (ROLES as readonly string[]).includes(bare)
      ? tRoles(`${bare as (typeof ROLES)[number]}.name`)
      : bare;
  }

  /**
   * A work-order priority, for WA-112's target sentence. Same shape and the
   * same reason: it had no branch, so the trail read "Set the
   * priority.critical target to 4 hours".
   */
  function translatePriority(key: string): string {
    const bare = key.startsWith(PRIORITY_NAMESPACE)
      ? key.slice(PRIORITY_NAMESPACE.length)
      : key;
    return (WORK_ORDER_PRIORITIES as readonly string[]).includes(bare)
      ? tPriority(bare as (typeof WORK_ORDER_PRIORITIES)[number])
      : bare;
  }

  return (event: AuditPhrase): string => {
    const key = handledAuditKey(event.summaryKey);
    if (key === null) return fallback;

    /*
     * One branch per namespace in `KEY_VALUED_NAMESPACES`, and the status one
     * is last because it is the only one whose key arrives unprefixed from
     * older callers.
     *
     * THE SHAPE THIS REPLACES IS THE DEFECT. It read "reason, else status" —
     * so a namespace with no branch fell into `translateStatus`, failed its
     * `isWorkOrderStatus` check, and returned the key itself. The sentence
     * then rendered `roles.administrator.name` in the middle of the trail, in
     * both languages, and everything stayed green because a sentence with a
     * key in it is still a sentence. `priority.` had been doing the same since
     * WA-112.
     */
    const params = auditSummaryParams(event, (valueKey) => {
      if (valueKey.startsWith(REASON_NAMESPACE))
        return translateReason(valueKey);
      if (valueKey.startsWith(ROLE_NAMESPACE)) return translateRole(valueKey);
      if (valueKey.startsWith(PRIORITY_NAMESPACE)) {
        return translatePriority(valueKey);
      }
      return translateStatus(valueKey);
    });
    const number = auditArgument(params, "number");

    switch (key) {
      case "workOrderCreated":
        return number ? tAudit("workOrderCreated", { number }) : fallback;
      case "statusChanged": {
        const status = auditArgument(params, "status");
        return number && status
          ? tAudit("statusChanged", { number, status })
          : fallback;
      }
      case "workOrderAssigned": {
        const user = auditArgument(params, "user");
        return number && user
          ? tAudit("workOrderAssigned", { number, user })
          : fallback;
      }
      case "workOrderReassigned": {
        // Both names or nothing. A handover that names only where the work
        // went is the entry `workOrderAssigned` already writes, and printing
        // it here would quietly turn a reassignment back into an assignment.
        const from = auditArgument(params, "from");
        const to = auditArgument(params, "to");
        return number && from && to
          ? tAudit("workOrderReassigned", { number, from, to })
          : fallback;
      }
      case "workOrderReassignedFromCrew": {
        // The crew code IS the previous holder's name here. There is no person
        // to name, and writing the handover without it would be the very loss
        // this family of entries exists to stop.
        const crew = auditArgument(params, "crew");
        const to = auditArgument(params, "to");
        return number && crew && to
          ? tAudit("workOrderReassignedFromCrew", { number, crew, to })
          : fallback;
      }
      case "workOrderReassignedFromUnreadable": {
        // Somebody held it and this system cannot say who. That is a third
        // answer, not "nobody" — printing it as a first assignment would be
        // the trail asserting the work was unheld, which is the one thing it
        // is not allowed to claim falsely.
        const to = auditArgument(params, "to");
        return number && to
          ? tAudit("workOrderReassignedFromUnreadable", { number, to })
          : fallback;
      }
      case "workOrderCompleted": {
        // The minutes are the half `statusChanged` had nowhere to put. An order
        // that closed and an order that closed after three hours are different
        // records, and only one of them answers a question six months later.
        const minutes = auditArgument(params, "minutes");
        return number && minutes
          ? tAudit("workOrderCompleted", { number, minutes })
          : fallback;
      }
      case "workOrderCancelled": {
        // Likewise the reason. Cancelling is the one move with no way back, so
        // a trail that records the fact and drops the decision is the trail
        // somebody will be asked about and cannot answer from.
        const reason = auditArgument(params, "reason");
        return number && reason
          ? tAudit("workOrderCancelled", { number, reason })
          : fallback;
      }
      case "taskTicked":
        return number ? tAudit("taskTicked", { number }) : fallback;
      case "taskUnticked":
        return number ? tAudit("taskUnticked", { number }) : fallback;
      case "labourLogged": {
        const minutes = auditArgument(params, "minutes");
        return number && minutes
          ? tAudit("labourLogged", { number, minutes })
          : fallback;
      }
      case "assetUpdated": {
        const tag = auditArgument(params, "tag");
        return tag ? tAudit("assetUpdated", { tag }) : fallback;
      }
      case "partIssued": {
        const quantity = auditArgument(params, "quantity");
        const partNumber = auditArgument(params, "partNumber");
        return quantity && partNumber
          ? tAudit("partIssued", { quantity, partNumber })
          : fallback;
      }
      case "partAdjusted": {
        // Arrived on main with WA-16's stock count while this switch was being
        // extracted out of the dashboard. Carried across by hand rather than
        // left to the fallback, which would have rendered every counted part as
        // "a change was recorded" — silently, and only in the trail.
        const partNumber = auditArgument(params, "partNumber");
        const from = auditArgument(params, "from");
        const to = auditArgument(params, "to");
        return partNumber && from && to
          ? tAudit("partAdjusted", { partNumber, from, to })
          : fallback;
      }
      case "conflictKeptMine": {
        // WA-15's two keys, carried into this switch rather than left to the
        // fallback. The extraction of this hook and the arrival of these keys
        // crossed in the same merge, and taking either side whole would have
        // compiled, passed the audit-keys test — which only checks the key is
        // registered — and rendered every conflict resolution as "a change was
        // recorded", in the trail, where nobody would look until an evaluator
        // did.
        const record = auditArgument(params, "record");
        return record ? tAudit("conflictKeptMine", { record }) : fallback;
      }
      case "conflictKeptTheirs": {
        const record = auditArgument(params, "record");
        return record ? tAudit("conflictKeptTheirs", { record }) : fallback;
      }
      case "documentUploaded": {
        /*
         * A case, not only a registration. `audit-keys.test.ts` checks the key
         * is in the registry and in both catalogues — it cannot see this
         * switch, so a key registered without a case here renders every upload
         * as "a change was recorded", in the trail, where nobody looks until an
         * evaluator does.
         */
        const fileName = auditArgument(params, "fileName");
        const version = auditArgument(params, "version");
        return fileName && version
          ? tAudit("documentUploaded", { fileName, version })
          : fallback;
      }
      case "reportExported": {
        const report = auditArgument(params, "report");
        const rows = auditArgument(params, "rows");
        return report && rows
          ? tAudit("reportExported", { report, rows })
          : fallback;
      }
      case "importCommitted": {
        const fileName = auditArgument(params, "fileName");
        const records = auditArgument(params, "records");
        return fileName && records
          ? tAudit("importCommitted", { fileName, records })
          : fallback;
      }
      case "importRolledBack": {
        const fileName = auditArgument(params, "fileName");
        const records = auditArgument(params, "records");
        return fileName && records
          ? tAudit("importRolledBack", { fileName, records })
          : fallback;
      }
      case "dataRebuilt": {
        // The two versions, both of them: "rebuilt for version 4" alone leaves
        // a reader wondering whether anything was lost, which is the question
        // the entry exists to answer.
        const version = auditArgument(params, "version");
        const previousVersion = auditArgument(params, "previousVersion");
        return version && previousVersion
          ? tAudit("dataRebuilt", { version, previousVersion })
          : fallback;
      }
      case "dataRefreshed": {
        const day = auditArgument(params, "day");
        const previousDay = auditArgument(params, "previousDay");
        return day && previousDay
          ? tAudit("dataRefreshed", {
              day: asCalendarDay(day),
              previousDay: asCalendarDay(previousDay),
            })
          : fallback;
      }
      case "notificationRead":
        return tAudit("notificationRead");
      case "notificationsAllRead": {
        const count = auditArgument(params, "count");
        return count ? tAudit("notificationsAllRead", { count }) : fallback;
      }
      case "notificationsRaised": {
        const count = auditArgument(params, "count");
        return count ? tAudit("notificationsRaised", { count }) : fallback;
      }
      case "notificationChannelOn":
      case "notificationChannelOff": {
        /*
         * The two share a body because they differ only in the word "on" or
         * "off", and that word is the key. Splitting them into two identical
         * blocks would be two places to forget the same argument.
         */
        const channel = auditArgument(params, "channel");
        const kind = auditArgument(params, "kind");
        if (!channel || !kind) return fallback;
        return key === "notificationChannelOn"
          ? tAudit("notificationChannelOn", { channel, kind })
          : tAudit("notificationChannelOff", { channel, kind });
      }
      case "workflowMoveEnabled":
      case "workflowMoveDisabled": {
        /*
         * The statuses arrive already turned into words: `auditSummaryParams`
         * maps `fromStatus` and `toStatus` through the status catalogue before
         * this runs. Without that the sentence would read "from inProgress to
         * completed" — identically in both languages, which is the half that
         * makes it a defect rather than a wording preference.
         */
        const fromStatus = auditArgument(params, "fromStatus");
        const toStatus = auditArgument(params, "toStatus");
        if (!fromStatus || !toStatus) return fallback;
        return key === "workflowMoveEnabled"
          ? tAudit("workflowMoveEnabled", { fromStatus, toStatus })
          : tAudit("workflowMoveDisabled", { fromStatus, toStatus });
      }
      case "waitingForPartsEnabled":
        return tAudit("waitingForPartsEnabled");
      case "waitingForPartsDisabled":
        return tAudit("waitingForPartsDisabled");
      case "completionNoteRequired":
        return tAudit("completionNoteRequired");
      case "completionNoteOptional":
        return tAudit("completionNoteOptional");
      case "prioritySlaChanged": {
        const slaPriority = auditArgument(params, "slaPriority");
        const hours = auditArgument(params, "hours");
        if (!slaPriority || !hours) return fallback;
        return tAudit("prioritySlaChanged", { slaPriority, hours });
      }
      case "notificationDefaultOn":
      case "notificationDefaultOff": {
        const channel = auditArgument(params, "channel");
        const kind = auditArgument(params, "kind");
        if (!channel || !kind) return fallback;
        return key === "notificationDefaultOn"
          ? tAudit("notificationDefaultOn", { channel, kind })
          : tAudit("notificationDefaultOff", { channel, kind });
      }
      case "userRoleChanged": {
        // The roles arrive as words: `auditSummaryParams` maps them through
        // the role catalogue before this runs, or the sentence would read
        // "from technician to maintenanceCoordinator" in both languages.
        const user = auditArgument(params, "user");
        const fromRole = auditArgument(params, "fromRole");
        const toRole = auditArgument(params, "toRole");
        if (!user || !fromRole || !toRole) return fallback;
        return tAudit("userRoleChanged", { user, fromRole, toRole });
      }
      case "userSiteChanged": {
        const user = auditArgument(params, "user");
        const fromSite = auditArgument(params, "fromSite");
        const toSite = auditArgument(params, "toSite");
        if (!user || !fromSite || !toSite) return fallback;
        return tAudit("userSiteChanged", { user, fromSite, toSite });
      }
      case "userDeactivated":
      case "userReactivated": {
        const user = auditArgument(params, "user");
        if (!user) return fallback;
        return key === "userDeactivated"
          ? tAudit("userDeactivated", { user })
          : tAudit("userReactivated", { user });
      }
      case "demoReset":
        return tAudit("demoReset");
      default: {
        /*
         * Every handled key has a case above, and this is the line that says so
         * out loud.
         *
         * Until now the switch had no `default` at all, and exhaustiveness was
         * enforced by accident: with no fallthrough the function lacked an
         * ending return, so a key added to `HANDLED_AUDIT_KEYS` without a case
         * gave TS2366. That works, but it is one `default: return fallback`
         * away from silence — and that line is exactly what somebody adds to
         * quiet a red build they did not expect.
         *
         * Assigning to `never` turns a negative error about a missing return
         * into a positive one, TS2322, that **names the key with no case**. The
         * registry test cannot catch this: it checks a key is registered, and a
         * registered key with no case compiles and renders "a change was
         * recorded" in the trail, which is how WA-15's conflict keys nearly
         * shipped.
         */
        const unhandled: never = key;
        return unhandled;
      }
    }
  };
}
