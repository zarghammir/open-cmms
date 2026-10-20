"use client";

import { Check, Minus } from "lucide-react";
import { ScrollableRegion } from "@/components/shared/scrollable-region";
import { useTranslations } from "next-intl";
import { roleMatrix } from "@/domain/constants/role-matrix";
import { ROLES } from "@/domain/constants/roles";

/**
 * What each role may do, read across.
 *
 * Generated from `can(role, capability)` — the same question every gated
 * control in the application asks — so the screen cannot drift from the
 * buttons. See `role-matrix.ts` for why that matters more than it sounds:
 * a table written out by hand would become a *wrong* table the day somebody
 * adds a capability, and a wrong one is worse than none because a person would
 * believe it.
 *
 * **A blank cell is not an answer.** Every cell carries an icon and a word, and
 * the word is only visible to a screen reader — so the grid stays readable at a
 * glance while "may not" is still something that can be heard rather than
 * inferred from an absence. Colour is never the signal: the tick and the dash
 * differ in shape.
 */
export function RoleTable() {
  const t = useTranslations("roleTable");
  const tRoles = useTranslations("roles");
  const rows = roleMatrix();

  return (
    <section className="flex flex-col gap-3" aria-labelledby="role-table-title">
      <div className="flex flex-col gap-1">
        <h2 id="role-table-title" className="text-base font-medium">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {/*
       * Thirteen rows against six columns does not become a phone layout by
       * getting narrower — it becomes unreadable. Below `md` the same data is
       * drawn as one block per role, which is the question a person asks on a
       * phone anyway ("what can a technician do"), rather than the comparison
       * the grid is for.
       */}
      <ScrollableRegion label={t("caption")} className="hidden md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{t("caption")}</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-2 pr-3 text-left font-medium">
                {t("capabilityColumn")}
              </th>
              {ROLES.map((role) => (
                <th
                  key={role}
                  scope="col"
                  className="px-2 py-2 text-left align-bottom font-medium"
                >
                  {tRoles(`${role}.name`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.capability} className="border-b border-border/60">
                <th
                  scope="row"
                  className="py-2 pr-3 text-left font-normal text-muted-foreground"
                >
                  {t(`capability.${row.capability}`)}
                </th>
                {row.allowed.map((allowed, column) => (
                  <td key={ROLES[column]} className="px-2 py-2">
                    {allowed ? (
                      <Check aria-hidden className="size-4 text-foreground" />
                    ) : (
                      <Minus
                        aria-hidden
                        className="size-4 text-muted-foreground"
                      />
                    )}
                    <span className="sr-only">
                      {allowed ? t("may") : t("mayNot")}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollableRegion>

      <ul className="flex flex-col gap-3 md:hidden">
        {ROLES.map((role, column) => {
          const allowed = rows.filter((row) => row.allowed[column]);

          return (
            <li
              key={role}
              className="flex flex-col gap-1 rounded-md border border-border bg-card p-3"
            >
              <p className="font-medium">{tRoles(`${role}.name`)}</p>
              <p className="text-xs text-muted-foreground">
                {tRoles(`${role}.summary`)}
              </p>
              {allowed.length === 0 ? (
                /*
                 * A role that may do nothing is a real answer and gets a
                 * sentence. An empty list here would read as a screen that
                 * failed to load its own rows.
                 */
                <p className="text-sm">{t("readsOnly")}</p>
              ) : (
                <ul className="flex flex-col gap-0.5 text-sm">
                  {allowed.map((row) => (
                    <li key={row.capability} className="flex items-start gap-2">
                      <Check
                        aria-hidden
                        className="mt-0.5 size-4 shrink-0 text-foreground"
                      />
                      {t(`capability.${row.capability}`)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
