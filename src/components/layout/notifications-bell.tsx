"use client";

import { BellRing } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { NotificationGroups } from "@/components/notifications/notification-groups";
import type { Role } from "@/domain/constants/roles";
import { useActor, useRepositories } from "@/hooks/use-demo-data";
import { useSaving } from "@/hooks/use-saving";

/**
 * The bell, connected to the records.
 *
 * `NotificationsMenu` stays a component that is handed a number, so it can be
 * unit tested without a store. This is the piece that knows where the number
 * comes from.
 *
 * While the records are still being read the menu is told so, rather than
 * being told zero: "nothing needs your attention" is a claim, and making it
 * before anything has been read would be making it up.
 */
export function NotificationsBell({ role }: { role: Role }) {
  const { status, repositories } = useRepositories();
  const actor = useActor(role);
  const { save } = useSaving();
  const t = useTranslations("shell.notifications");
  const loading = status !== "ready" || repositories === null;

  const count = loading
    ? 0
    : repositories.notifications.unreadCount(role, actor.userId);
  const groups = loading
    ? []
    : repositories.notifications.groupedForRole(role, actor.userId);

  /**
   * Marking everything read is a write, so it goes through `useSaving`.
   *
   * WA-67's rule, and it applies here even though nothing says "saved": the
   * badge is the claim. A badge that clears the instant it is pressed, on a
   * browser that then fails to store the change, is a screen telling somebody
   * their inbox is clear when a reload will bring it all back. `save` holds
   * the change until the browser has it and raises the standing notice when
   * it has not.
   */
  async function markAllRead() {
    if (!repositories) return;
    await save(() => {
      repositories.notifications.markAllRead(role, actor.userId, actor);
    });
  }

  return (
    <NotificationsMenu
      loading={loading}
      count={count}
      list={
        groups.length > 0
          ? (close) => <NotificationGroups groups={groups} onNavigate={close} />
          : undefined
      }
      onMarkAllRead={count > 0 ? () => void markAllRead() : undefined}
      footer={(close) => (
        <Button
          asChild
          size="sm"
          variant="ghost"
          className="w-full justify-start"
          data-slot="notification-settings-link"
        >
          <Link href="/my-notifications" onClick={close}>
            <BellRing data-icon="inline-start" />
            {t("settingsLink")}
          </Link>
        </Button>
      )}
    />
  );
}
