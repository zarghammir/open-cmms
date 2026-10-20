"use client";

import { useTranslations } from "next-intl";
import { ScrollableRegion } from "@/components/shared/scrollable-region";
import type { Role } from "@/domain/constants/roles";
import { NOTIFIABLE_KINDS } from "@/domain/types";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { useNotificationPreferences } from "@/hooks/use-notifications";

/**
 * What each person hears about, and how.
 *
 * Two switches per alert rather than one, because they answer different
 * questions: somebody who reads the bell all day may not want a mail for every
 * short part, and somebody who lives in their inbox may want the opposite. One
 * switch would force them to choose between hearing twice and not hearing.
 *
 * **The auditor sees the switches, disabled, with the reason.** A screen that
 * is simply shorter for one role demonstrates nothing — an evaluator watching
 * somebody switch roles has to be able to see that the product is role-based,
 * and absence communicates nothing. That is settled policy in this project, not
 * a choice made here.
 *
 * Two kinds are missing on purpose. `inspectionFailed` and `maintenanceDue` are
 * seeded and have no rule behind them until WA-20, so a switch for them would
 * govern nothing — a control that lies is worse than a control that is absent.
 */
export function MyNotifications({ role }: { role: Role }) {
  const t = useTranslations("myNotifications");
  const tKind = useTranslations("notifications.kind");
  const { ready, preference, editable, setChannel } =
    useNotificationPreferences(role);

  if (!ready) return <DataTableSkeleton rows={4} columns={3} />;

  return (
    /*
     * No heading of its own, and the picture is why.
     *
     * This was written as a panel among others on the Settings screen, so it
     * carried its own title and sentence. It is a whole screen now, and
     * `ModuleScreen` already prints the module's title and description above
     * it — so the shot showed "My notifications" twice, with two sentences
     * saying the same thing in slightly different words. Every assertion was
     * green; nothing but looking at the picture could have found it.
     */
    <section data-slot="my-notifications" className="grid gap-2">
      {!editable ? (
        <div
          data-slot="notifications-read-only"
          role="note"
          className="rounded-md border border-border bg-muted/40 px-3 py-2"
        >
          <p className="text-sm font-medium">{t("readOnlyTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("readOnlyBody")}</p>
        </div>
      ) : null}

      <ScrollableRegion
        label={t("title")}
        className="rounded-md border border-border"
      >
        <table className="w-full min-w-0 text-sm">
          <caption className="sr-only">{t("description")}</caption>
          <thead className="bg-muted/40 text-left text-xs">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("kindColumn")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("inApp")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("email")}
              </th>
            </tr>
          </thead>
          <tbody>
            {NOTIFIABLE_KINDS.map((kind) => {
              const choice = preference?.kinds[kind] ?? {
                inApp: true,
                email: true,
              };
              return (
                <tr
                  key={kind}
                  data-slot="notification-preference"
                  data-kind={kind}
                  className="border-t border-border"
                >
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    {tKind(kind)}
                  </th>
                  {(["inApp", "email"] as const).map((channel) => (
                    <td key={channel} className="px-3 py-2">
                      <input
                        type="checkbox"
                        className="size-4 rounded-sm border-border accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                        checked={choice[channel]}
                        disabled={!editable}
                        data-channel={channel}
                        /*
                         * Labelled by the row and the column it sits in, which
                         * is what a person reads it as. A checkbox in a grid
                         * with no name of its own is announced as "checkbox"
                         * and nothing else, and there are twelve of them here.
                         */
                        aria-label={`${tKind(kind)} — ${t(channel)}`}
                        onChange={(event) =>
                          setChannel(kind, channel, event.target.checked)
                        }
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollableRegion>

      {preference ? (
        <p className="text-xs text-muted-foreground">
          {t("languageLabel")}{" "}
          <strong>{preference.language.toUpperCase()}</strong>
        </p>
      ) : null}
    </section>
  );
}
