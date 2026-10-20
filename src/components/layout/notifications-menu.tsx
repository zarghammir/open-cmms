"use client";

import { useState, type ReactNode } from "react";
import { Bell, Inbox } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LoadingState } from "@/components/shared/state-panels";

/**
 * The notifications bell. `count` is the number of unread items, which
 * `NotificationsBell` reads from the store.
 *
 * Three states, not two. Zero is a state of its own, not a blank panel: an
 * empty inbox says what would have appeared in it. `loading` is the third —
 * the records have not been read yet, so the count is not zero, it is not yet
 * known, and saying "nothing needs your attention" would be inventing an
 * answer.
 */
export function NotificationsMenu({
  count = 0,
  loading = false,
  list,
  footer,
  onMarkAllRead,
  className,
}: {
  count?: number;
  loading?: boolean;
  /**
   * The list itself, drawn by the caller and handed a way to close the
   * popover.
   *
   * Passed in rather than built here, and the reason is the docblock above:
   * this component is handed what it shows so it can be unit tested without a
   * store, and the list needs `Link`, which needs a router. Building the list
   * in here made the existing test fail to resolve `next/navigation` — the
   * component had quietly stopped being testable, and the test said so.
   */
  list?: (close: () => void) => ReactNode;
  /** The foot of the menu, drawn by the caller and handed the same closer. */
  footer?: (close: () => void) => ReactNode;
  /** Absent when nothing is unread, so the control is not offered for nothing. */
  onMarkAllRead?: () => void;
  className?: string;
}) {
  const t = useTranslations("shell.notifications");
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn("relative", className)}
          aria-label={
            loading ? t("label") : `${t("label")}: ${t("count", { count })}`
          }
        >
          <Bell />
          {!loading && count > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-2xs font-semibold text-white"
            >
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-3 py-2">
          <p className="font-medium">{t("title")}</p>
          <p className="text-xs text-muted-foreground">
            {loading ? t("loading") : t("count", { count })}
          </p>
        </div>
        {loading ? (
          <div className="p-3">
            <LoadingState rows={2} />
          </div>
        ) : list ? (
          <>
            <div className="max-h-96 overflow-y-auto">
              {list(() => setOpen(false))}
            </div>
            {/*
             * Offered only when there is something unread. A control that is
             * always there and does nothing on most presses teaches a person
             * to stop pressing it — and the badge it clears is the only
             * signal that anything is waiting.
             */}
            {onMarkAllRead ? (
              <div className="border-t border-border p-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  data-slot="mark-all-read"
                  onClick={onMarkAllRead}
                >
                  {t("markAllRead")}
                </Button>
              </div>
            ) : (
              <div className="border-t border-border px-3 py-2">
                <p className="text-xs font-medium">{t("allReadTitle")}</p>
                <p className="text-2xs text-muted-foreground">
                  {t("allReadBody")}
                </p>
              </div>
            )}
          </>
        ) : count === 0 ? (
          <Empty className="border-0 py-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Inbox />
              </EmptyMedia>
              <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("emptyBody")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
        {/*
         * The way out of the bell, on every state of it including the empty
         * one: somebody who is hearing too much opens this to stop hearing it,
         * and an empty bell is exactly when a person wonders whether anything
         * is switched on at all.
         *
         * Handed in like the list, and for the reason the list is: a `Link`
         * needs a router, and this component is unit tested without one. It
         * had already cost that test once on this branch.
         */}
        {footer ? (
          <div className="border-t border-border p-2">
            {footer(() => setOpen(false))}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
