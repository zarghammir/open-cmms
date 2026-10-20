import { History } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { DashboardPanel } from "@/components/dashboard/panel";
import type { ActivityRow } from "@/data/selectors/dashboard";
import { useAuditSummary } from "@/hooks/use-audit-summary";

/**
 * The trail, in words.
 *
 * An audit entry stores a catalogue key and its arguments, never a sentence, so
 * a change recorded in August still reads correctly in the French demo in
 * October. Turning that back into a sentence is this file's whole job.
 *
 * The sentence-building itself lives in `useAuditSummary`, which the asset
 * page also reads the trail through. This supplies the words for an entry
 * nobody can phrase — a stated "a change was recorded" rather than a raw key on
 * screen — because that line belongs to the screen saying it.
 */
export function ActivityPanel({ rows }: { rows: ActivityRow[] | null }) {
  const t = useTranslations("dashboard.activity");
  const format = useFormatter();

  const summarise = useAuditSummary(t("unreadableChange"));

  /**
   * Three answers, named apart. "Unattributed" is not the application: one is
   * an entry whose author the records no longer hold, the other is an entry
   * nobody wrote. Reading the second as the first would tell a reviewer that a
   * rebuild of their records was somebody's untraceable doing.
   */
  function who(actor: ActivityRow["actor"]): string {
    if (actor.kind === "person") return actor.name;
    if (actor.kind === "system") return t("systemActor");
    return t("unknownActor");
  }

  return (
    <DashboardPanel
      title={t("title")}
      description={t("description")}
      rows={rows}
      emptyIcon={History}
      emptyTitle={t("emptyTitle")}
      emptyBody={t("emptyBody")}
    >
      {(activity) => (
        <ol data-slot="activity-feed" className="flex flex-col">
          {activity.map((row) => (
            <li
              key={row.event.id}
              className="flex flex-col gap-0.5 border-b border-border py-2 last:border-b-0"
            >
              <span className="text-sm">{summarise(row.event)}</span>
              <span className="text-xs text-muted-foreground">
                {t("byline", {
                  who: who(row.actor),
                  when: format.dateTime(new Date(row.event.at), "dayTime"),
                })}
              </span>
            </li>
          ))}
        </ol>
      )}
    </DashboardPanel>
  );
}
