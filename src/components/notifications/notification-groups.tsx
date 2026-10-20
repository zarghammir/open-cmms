"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { Notification, NotificationKind } from "@/domain/types";
import { Link } from "@/i18n/navigation";
import { hrefFor } from "./notification-link";

/**
 * What the bell shows, once there is something in it.
 *
 * A list of one kind of thing is a list; a list of six kinds of thing is a
 * pile. The rules put overdue work, jobs landing on people, short parts and
 * refused changes into the same bell, so they are gathered under the kind they
 * belong to, with the group holding unread items first — a fixed order by kind
 * would bury the one thing that changed under four kinds that did not.
 *
 * Each item is a **link to its record**, because the question a person has on
 * reading "WO-2026-0041 is past its due date" is "what is that", and the answer
 * should be one press away. Where there is no screen to go to — an inspection,
 * until WA-20 — the item is plain text rather than a control that does nothing.
 *
 * Every line is drawn from the catalogue key and its arguments, never from a
 * stored sentence: the same notice has to read correctly in French, and a
 * sentence frozen when it was created could not.
 */
export interface NotificationGroupView {
  kind: NotificationKind;
  unread: number;
  items: Notification[];
}

/** The catalogue namespace every notification's `messageKey` lives under. */
const NAMESPACE = "notifications.";

export function NotificationGroups({
  groups,
  onNavigate,
}: {
  groups: readonly NotificationGroupView[];
  /** Closes the popover, so a record does not open behind it. */
  onNavigate?: () => void;
}) {
  const t = useTranslations("notifications");
  const tShell = useTranslations("shell.notifications");
  const format = useFormatter();

  /**
   * The sentence for one notice.
   *
   * `messageKey` is the contract and is read rather than reconstructed from
   * `kind`, even though the two agree today: the field exists so a kind can
   * one day carry more than one sentence, and a component that ignored it
   * would make that impossible without anybody noticing. The prefix is
   * stripped rather than assumed away, and a key that does not carry it falls
   * back to the kind — which is a real sentence rather than a blank line.
   */
  function sentence(notification: Notification): string {
    const bare = notification.messageKey.startsWith(NAMESPACE)
      ? notification.messageKey.slice(NAMESPACE.length)
      : notification.kind;
    return t(bare as Parameters<typeof t>[0], notification.params);
  }

  return (
    <ul className="divide-y divide-border" data-slot="notification-groups">
      {groups.map((group) => (
        <li
          key={group.kind}
          data-slot="notification-group"
          data-kind={group.kind}
        >
          <div className="flex items-baseline justify-between gap-2 bg-muted/40 px-3 py-1.5">
            <p className="text-xs font-semibold">{t(`kind.${group.kind}`)}</p>
            <p className="text-2xs text-muted-foreground">
              {tShell("unreadInGroup", { count: group.unread })}
            </p>
          </div>
          <ul>
            {group.items.map((item) => {
              const href = hrefFor(item);
              const body = (
                <>
                  <span className="block text-sm">{sentence(item)}</span>
                  <span className="block text-2xs text-muted-foreground">
                    {format.dateTime(new Date(item.createdAt), "dayTime")}
                  </span>
                </>
              );

              return (
                <li
                  key={item.id}
                  data-slot="notification-item"
                  data-read={item.readAt === null ? "false" : "true"}
                  className="border-t border-border/60 first:border-t-0"
                >
                  {href ? (
                    <Link
                      href={href}
                      onClick={onNavigate}
                      className="block px-3 py-2 outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="px-3 py-2">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}
