"use client";

import { CloudOff, TriangleAlert } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { ModulePanel } from "@/components/shared/module-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { Role } from "@/domain/constants/roles";
import { useAuditSummary } from "@/hooks/use-audit-summary";
import { usePendingQueue } from "@/hooks/use-demo-data";

/**
 * What this device has not sent yet.
 *
 * The same reads as the synchronisation log in Settings, on a screen every role
 * can open: Settings is Administrator and Facility manager, and a technician
 * working in a plant room is exactly the person who needs to know whether the
 * work they just recorded has left the tablet.
 *
 * Each change says what it will do rather than which record it touched, in the
 * words the trail will use once it has — one vocabulary, so "raised work order
 * WO-2026-0041" reads the same before and after it is sent.
 *
 * Nothing here writes. A queue a person can push is a queue with two answers
 * about when a change is sent, and the one that matters is the connection's.
 */
export function PendingQueue({ role }: { role: Role }) {
  const t = useTranslations("offline");
  const tRoles = useTranslations("roles");
  const format = useFormatter();
  const { changes, online, stoppedOn, last } = usePendingQueue();
  const summarise = useAuditSummary(t("unreadableChange"));

  // Nothing read back yet: no records *and no answer*. Drawing "nothing
  // waiting" here would be the one claim this screen exists to be right about.
  if (changes === null) return <DataTableSkeleton rows={3} columns={2} />;

  return (
    <div className="flex flex-col gap-4">
      {stoppedOn === null ? null : (
        <Alert data-slot="queue-stopped" variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>{t("conflictTitle", { record: stoppedOn })}</AlertTitle>
          <AlertDescription>
            {t("queueStopped", { record: stoppedOn })}
          </AlertDescription>
        </Alert>
      )}

      {changes.length === 0 ? (
        emptyQueue()
      ) : (
        <ul
          data-slot="pending-queue"
          className="divide-y divide-border rounded-md border border-border bg-card"
        >
          {changes.map((change) => (
            <li key={change.id} className="flex flex-col gap-1 p-3">
              <span className="text-sm">{summarise(change.phrase)}</span>
              <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono font-medium">{change.label}</span>
                <span>
                  {format.dateTime(new Date(change.queuedAt), "time")}
                </span>
                {change.queuedOffline ? (
                  <Badge variant="outline">{t("queuedWhileOffline")}</Badge>
                ) : null}
                {change.actorRole === role ? null : (
                  <span>
                    {t("queuedByRole", {
                      role: tRoles(`${change.actorRole}.name`),
                    })}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="queue-last" className="flex flex-col gap-2">
        <h2
          id="queue-last"
          className="font-mono text-2xs tracking-[0.12em] text-muted-foreground uppercase"
        >
          {t("queueLastTitle")}
        </h2>
        {last === null ? (
          <p className="text-sm text-muted-foreground">{t("syncEmptyTitle")}</p>
        ) : (
          <p
            data-slot="queue-last"
            className="flex flex-wrap items-baseline gap-2 rounded-md border border-border bg-card p-3 text-sm"
          >
            <span className="font-mono text-xs font-medium">{last.label}</span>
            <span>{t(`outcome.${last.outcome}`)}</span>
            <span className="text-xs text-muted-foreground">
              {format.dateTime(new Date(last.at), "dayTime")}
            </span>
          </p>
        )}
      </section>
    </div>
  );

  /**
   * An empty queue reads two ways, and they are not interchangeable. With a
   * connection, nothing waiting means everything has reached the server.
   * Offline it means only that nothing has been changed yet — a queue that is
   * empty because there is nothing to send is not a queue that has been sent.
   */
  function emptyQueue() {
    if (online) return <ModulePanel moduleKey="waitingToSend" />;

    return (
      <Empty className="border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CloudOff />
          </EmptyMedia>
          <EmptyTitle className="text-base">
            {t("queueEmptyOfflineTitle")}
          </EmptyTitle>
          <EmptyDescription>{t("queueEmptyOfflineBody")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
}
