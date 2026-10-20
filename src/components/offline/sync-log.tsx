"use client";

import { CloudCheck } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useSyncLog } from "@/hooks/use-demo-data";

/**
 * What has been sent, and what was refused.
 *
 * The tender asks for synchronisation to be manageable, which means visible:
 * a queue that drains silently is indistinguishable from a queue that drops
 * things. Every entry says what it touched, when, and how it ended.
 */
export function SyncLog() {
  const t = useTranslations("offline");
  const format = useFormatter();
  const { entries } = useSyncLog();

  if (entries === null) return <DataTableSkeleton rows={3} columns={3} />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("syncTitle")}</CardTitle>
        <CardDescription>{t("syncBody")}</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <Empty className="border-0 py-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CloudCheck />
              </EmptyMedia>
              <EmptyTitle>{t("syncEmptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("syncEmptyBody")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul
            data-slot="sync-log"
            className="divide-y divide-border rounded-md border border-border"
          >
            {entries.map((entry) => (
              <li
                key={`${entry.id}-${entry.at}-${entry.outcome}`}
                className="flex flex-wrap items-baseline justify-between gap-2 p-3"
              >
                <span className="font-mono text-xs font-medium">
                  {entry.label}
                </span>
                <span className="text-sm">{t(`outcome.${entry.outcome}`)}</span>
                <span className="text-xs text-muted-foreground">
                  {format.dateTime(new Date(entry.at), "dayTime")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
