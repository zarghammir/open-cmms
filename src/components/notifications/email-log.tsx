"use client";

import { Mail } from "lucide-react";
import { ScrollableRegion } from "@/components/shared/scrollable-region";
import { useFormatter, useTranslations } from "next-intl";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { useEmailLog } from "@/hooks/use-notifications";

/**
 * The mail this demonstration would have sent.
 *
 * There is no mail server and Phase 1 will not have one, so rather than
 * pretend, the application writes down what it would have sent and shows the
 * list. An evaluator asked to believe that alerts reach people can read the
 * decision instead of taking it on trust, and Phase 2 sends these same lines
 * for real without the screen changing.
 *
 * **The language column is the point of the screen, not decoration.** A subject
 * is written in the *recipient's* language, not the reader's, so an
 * administrator reading this in English sees a French subject line against a
 * colleague at the Sudbury laboratory. That is the bilingual claim made
 * visible: two people, one event, two languages.
 *
 * Three states, as everywhere: a skeleton while the records are being read,
 * the empty state when nothing has been raised yet, and the table.
 */
export function EmailLog() {
  const t = useTranslations("emailLog");
  const format = useFormatter();
  const { ready, entries, nameFor } = useEmailLog();

  if (!ready) return <DataTableSkeleton rows={3} columns={4} />;

  return (
    <section data-slot="email-log" className="grid gap-2">
      <div>
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {entries.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Mail />
            </EmptyMedia>
            <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("emptyBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ScrollableRegion
          label={t("title")}
          className="rounded-md border border-border"
        >
          <table className="w-full min-w-0 text-sm">
            <caption className="sr-only">{t("description")}</caption>
            <thead className="bg-muted/40 text-left text-xs">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("columns.queuedAt")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("columns.to")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("columns.language")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("columns.subject")}
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  data-slot="email-log-row"
                  data-language={entry.language}
                  className="border-t border-border"
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    {format.dateTime(new Date(entry.queuedAt), "dayTime")}
                  </td>
                  <td className="px-3 py-2">
                    <span className="block">{nameFor(entry.toUserId)}</span>
                    <span className="block text-2xs text-muted-foreground">
                      {entry.toEmail}
                    </span>
                  </td>
                  <td className="px-3 py-2 uppercase">{entry.language}</td>
                  {/*
                   * Rendered by the recipient's catalogue rather than the
                   * reader's, which is the one thing this table is for. The
                   * subject is a key and its arguments like every other piece
                   * of text in the application; what changes here is which
                   * catalogue answers it.
                   */}
                  <td className="px-3 py-2">{entry.subject}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableRegion>
      )}
      <p className="text-xs text-muted-foreground">{t("languageNote")}</p>
      <p className="text-xs text-muted-foreground">{t("phaseTwo")}</p>
    </section>
  );
}
