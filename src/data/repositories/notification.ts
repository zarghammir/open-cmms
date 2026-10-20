import type { Role } from "@/domain/constants/roles";
import type {
  EmailLogEntry,
  Id,
  NotifiableKind,
  Notification,
  NotificationKind,
  NotificationPreference,
} from "@/domain/types";
import {
  evaluateAll,
  type ConflictedChange,
  type NotificationEvent,
} from "@/domain/notifications/rules";
import type { Actor, Mutation } from "@/stores/mutations";
import { freeId } from "./ids";
import type { RepositoryContext } from "./types";

/** Notifications for one person, gathered under the kind they belong to. */
export interface NotificationGroup {
  kind: NotificationKind;
  items: Notification[];
  unread: number;
}

export interface NotificationRepository {
  /** Everything addressed to this person or to the role they hold. */
  forRole: (role: Role, userId?: Id) => Notification[];
  /** The same, gathered by kind, newest first inside each group. */
  groupedForRole: (role: Role, userId?: Id) => NotificationGroup[];
  unreadCount: (role: Role, userId?: Id) => number;
  markRead: (id: Id, actor: Actor) => void;
  /** Clears the badge for this person, in one act rather than one per item. */
  markAllRead: (role: Role, userId: Id | undefined, actor: Actor) => void;
  /** One person's choices, or null when there is no row for them. */
  preferencesFor: (userId: Id) => NotificationPreference | null;
  setChannel: (
    userId: Id,
    kind: NotifiableKind,
    channel: "inApp" | "email",
    on: boolean,
    actor: Actor,
  ) => void;
  /** What would have been sent, newest first. */
  emailLog: () => EmailLogEntry[];
  /**
   * Runs the rules and returns what is new, **without writing anything.**
   *
   * It used to write, through `commitMany`, and that was wrong twice over: a
   * notice is derived from the records rather than done to them, so queueing
   * it asked a server to accept a conclusion, and recording it in the trail
   * put "raised 67 notifications" above the line explaining why somebody's
   * records had just been discarded — attributed to whoever was holding the
   * demonstration. The browser suite named both.
   *
   * So this computes and the store appends: `useDemoStore.applyDerived`, one
   * persisted serialised write, no queue entry and no trail entry. Computing
   * without writing also makes the result something a test can read.
   */
  pendingNotices: (conflicts?: readonly ConflictedChange[]) => {
    notifications: Notification[];
    emailLog: EmailLogEntry[];
  };
}

export function createNotificationRepository(
  context: RepositoryContext,
): NotificationRepository {
  function addressedTo(
    notification: Notification,
    role: Role,
    userId?: Id,
  ): boolean {
    // Addressed to one person beats addressed to a role.
    if (notification.forUserId) return notification.forUserId === userId;

    // The administrator oversees every other role, so everything addressed to
    // any of them is addressed to the administrator too. Without this the
    // administrator — the role a reviewer opens the demonstration in — has an
    // empty inbox while overdue work and short stock sit in the records.
    if (role === "administrator") return true;

    return notification.forRole === role;
  }

  /**
   * What this person has already been told, as a set of event names.
   *
   * The whole of "never a duplicate" is this lookup. The rules are re-run on
   * every write and on every boot, and they deliberately do not remember
   * anything: what stops a second copy is that the first one is still in the
   * records, carrying the name of the event it reported.
   */
  function alreadyToldOf(): Set<string> {
    const seen = new Set<string>();
    for (const notification of context.data.notifications) {
      if (notification.eventKey && notification.forUserId) {
        seen.add(`${notification.eventKey}|${notification.forUserId}`);
      }
    }
    return seen;
  }

  function preferenceFor(userId: Id): NotificationPreference | undefined {
    return context.data.notificationPreferences.find(
      (row) => row.userId === userId,
    );
  }

  /**
   * Whether this person wants this kind, on this channel.
   *
   * A person with no preference row hears everything. That is the safer answer:
   * the alternative is that a user the seed did not write a row for silently
   * receives nothing, which looks exactly like a rule that does not work.
   */
  function wants(
    userId: Id,
    kind: NotifiableKind,
    channel: "inApp" | "email",
  ): boolean {
    const preference = preferenceFor(userId);
    if (!preference) return true;
    return preference.kinds[kind][channel];
  }

  return {
    forRole(role, userId) {
      return context.data.notifications
        .filter((notification) => addressedTo(notification, role, userId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    groupedForRole(role, userId) {
      const groups = new Map<NotificationKind, Notification[]>();
      for (const notification of this.forRole(role, userId)) {
        const items = groups.get(notification.kind) ?? [];
        items.push(notification);
        groups.set(notification.kind, items);
      }

      /*
       * The group with unread items first, then by how recent its newest item
       * is. A fixed order by kind would bury the one thing that changed under
       * four kinds that did not, which is the failure mode of every grouped
       * inbox.
       */
      return [...groups.entries()]
        .map(([kind, items]) => ({
          kind,
          items,
          unread: items.filter((item) => item.readAt === null).length,
        }))
        .sort((a, b) => {
          if (a.unread > 0 !== b.unread > 0) return a.unread > 0 ? -1 : 1;
          return (b.items[0]?.createdAt ?? "").localeCompare(
            a.items[0]?.createdAt ?? "",
          );
        });
    },

    unreadCount(role, userId) {
      return this.forRole(role, userId).filter(
        (notification) => notification.readAt === null,
      ).length;
    },

    markRead(id, actor) {
      const at = context.now().toISOString();
      context.commit(
        {
          operation: "update",
          collection: "notifications",
          id,
          changes: { readAt: at },
          actor,
          audit: {
            entity: "notification",
            action: "updated",
            summaryKey: "audit.notificationRead",
            summaryParams: {},
          },
        },
        at,
      );
    },

    markAllRead(role, userId, actor) {
      const at = context.now().toISOString();
      const unread = this.forRole(role, userId).filter(
        (notification) => notification.readAt === null,
      );
      if (unread.length === 0) return;

      /*
       * One act, not one per item. Pressing "Mark all read" is a single thing
       * a person did; committing it as thirty separate changes would put
       * thirty entries in the trail and thirty in the offline queue, and the
       * pending count would read thirty for one click.
       */
      const audit = {
        entity: "notification" as const,
        action: "updated" as const,
        summaryKey: "audit.notificationsAllRead",
        summaryParams: { count: unread.length },
      };

      context.commitMany(
        unread.map((notification) => ({
          operation: "update" as const,
          collection: "notifications" as const,
          id: notification.id,
          changes: { readAt: at },
          actor,
          audit,
        })),
        audit,
        actor,
        unread[0]!.id,
        at,
      );
    },

    preferencesFor(userId) {
      return preferenceFor(userId) ?? null;
    },

    setChannel(userId, kind, channel, on, actor) {
      const existing = preferenceFor(userId);
      if (!existing) return;
      const at = context.now().toISOString();

      context.commit(
        {
          operation: "update",
          collection: "notificationPreferences",
          id: existing.id,
          changes: {
            kinds: {
              ...existing.kinds,
              [kind]: { ...existing.kinds[kind], [channel]: on },
            },
          },
          actor,
          audit: {
            /*
             * The person, not a name of its own. `EntityName` is the list a
             * trail entry can point at, and a preference row is a fact about
             * a user — adding an eighth entity so one row can be its own kind
             * would make every reader of the trail learn a word for it.
             */
            entity: "user",
            action: "updated",
            summaryKey: on
              ? "audit.notificationChannelOn"
              : "audit.notificationChannelOff",
            summaryParams: { kind, channel },
          },
        },
        at,
      );
    },

    emailLog() {
      return [...context.data.emailLog].sort((a, b) =>
        b.queuedAt.localeCompare(a.queuedAt),
      );
    },

    pendingNotices(conflicts = []) {
      const now = context.now();
      const at = now.toISOString();
      const seen = alreadyToldOf();

      /*
       * Everything the rules report, minus what this person already knows.
       *
       * The filter runs against a set built once, and then against the events
       * accepted so far in this same pass — two rules can report the same
       * event to the same person in one evaluation, and a set that only knew
       * about the records would let the second one through.
       */
      const fresh: NotificationEvent[] = [];
      for (const event of evaluateAll({
        data: context.data,
        conflicts,
        now,
      })) {
        const name = `${event.eventKey}|${event.forUserId}`;
        if (seen.has(name)) continue;
        if (!wants(event.forUserId, event.kind, "inApp")) continue;
        seen.add(name);
        fresh.push(event);
      }

      const notifications: Notification[] = [];
      const emailLog: EmailLogEntry[] = [];
      // Ids are asked of the collection plus whatever this pass has already
      // taken, since none of these are in the records until they are applied.
      const taken: { id: Id }[] = [...context.data.notifications];
      const takenMail: { id: Id }[] = [...context.data.emailLog];

      for (const event of fresh) {
        const id = freeId(taken, `ntf-${event.eventKey}-${event.forUserId}`);
        taken.push({ id });

        notifications.push({
          id,
          organizationId: context.data.organization.id,
          kind: event.kind,
          messageKey: event.messageKey,
          params: event.params,
          subject: event.subject,
          createdAt: at,
          readAt: null,
          forUserId: event.forUserId,
          forRole: null,
          eventKey: event.eventKey,
        });

        /*
         * The mail that would have gone, in the recipient's language.
         *
         * Only when they asked for mail: the two switches are separate on
         * purpose, so somebody can keep the bell and stop the mail. Nothing is
         * sent and nothing will be in Phase 1 — this is the record of a
         * decision, and Phase 2 sends the same lines for real.
         */
        if (!wants(event.forUserId, event.kind, "email")) continue;
        const person = context.data.users.find(
          (user) => user.id === event.forUserId,
        );
        if (!person) continue;

        const mailId = freeId(takenMail, `eml-${id}`);
        takenMail.push({ id: mailId });
        emailLog.push({
          id: mailId,
          organizationId: context.data.organization.id,
          notificationId: id,
          toUserId: person.id,
          toEmail: person.email,
          language: preferenceFor(person.id)?.language ?? "en",
          subjectKey: `${event.messageKey}Subject`,
          params: event.params,
          queuedAt: at,
        });
      }

      return { notifications, emailLog };
    },
  };
}
