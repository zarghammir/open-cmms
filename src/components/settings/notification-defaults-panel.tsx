"use client";

import { useTranslations } from "next-intl";
import { ScrollableRegion } from "@/components/shared/scrollable-region";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { useWorkflowSettings } from "@/hooks/use-workflow-settings";
import type { Role } from "@/domain/constants/roles";
import { NOTIFIABLE_KINDS } from "@/domain/types";

/**
 * What somebody who has never opened their own preferences hears about.
 *
 * **These are defaults, not overrides, and the panel says so.** WA-18 gives
 * every person their own choices and this does not reach into them: a
 * technician who has turned email off keeps it off whatever an administrator
 * sets here. Saying that on the screen matters more than it looks — an
 * administrator who believed this switched everybody's mail off would be
 * making a decision on a false understanding of what the control does.
 *
 * The same kinds as the preferences screen, in the same order, because they
 * are the same list: `NOTIFIABLE_KINDS`, which leaves out the two the
 * demonstration seeds without a rule behind them.
 */
export function NotificationDefaultsPanel({ role }: { role: Role }) {
  const t = useTranslations("notificationDefaults");
  const tKind = useTranslations("notifications.kind");
  const tChannel = useTranslations("myNotifications");
  const { ready, editable, defaults, setNotificationDefault } =
    useWorkflowSettings(role);

  if (!ready) return <DataTableSkeleton rows={3} columns={3} />;

  return (
    <section data-slot="notification-defaults" className="grid gap-2">
      <div>
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {!editable ? (
        <p data-slot="notification-defaults-readonly" className="text-sm">
          {t("readOnly")}
        </p>
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
                {t("columns.kind")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {tChannel("inApp")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {tChannel("email")}
              </th>
            </tr>
          </thead>
          <tbody>
            {NOTIFIABLE_KINDS.map((kind) => {
              const row = defaults.find((one) => one.kind === kind);
              return (
                <tr
                  key={kind}
                  data-slot="notification-default"
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
                        checked={row?.[channel] ?? true}
                        disabled={!editable || !row}
                        data-channel={channel}
                        // Labelled by its row and its column, as on the
                        // preferences screen: twelve unnamed checkboxes in a
                        // grid are announced as "checkbox" and nothing else.
                        aria-label={`${tKind(kind)} — ${tChannel(channel)}`}
                        onChange={(event) =>
                          setNotificationDefault(
                            kind,
                            channel,
                            event.target.checked,
                          )
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
    </section>
  );
}
