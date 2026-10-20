"use client";

import { useLocale, useTranslations } from "next-intl";
import { ScrollableRegion } from "@/components/shared/scrollable-region";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { useDemoData, useRepositories } from "@/hooks/use-demo-data";
import { textFor } from "@/lib/localized-text";

/**
 * Who this demonstration is for, and the five places it runs in.
 *
 * **Read-only, and that is the design rather than a shortfall.** The
 * organisation and its site codes are the first segment of every location and
 * bin code in the MP2 import fixture — change `KGN` here and that import
 * resolves nothing, on a fixture generated against those codes and relied on by
 * three separate tests. An editable field would be a control whose only
 * possible use is to break the demonstration, so there is no field: what an
 * administrator does here is *read* the tenant they are working in, which is
 * what the panel is for.
 *
 * The organisation is fictional. No real one is named anywhere in this project.
 *
 * Three states like every other reader of the store. A profile drawn with no
 * sites before the records have been read back would tell a reviewer this
 * organisation runs nowhere, and "not yet read" is not "none".
 */
export function OrganizationProfile() {
  const { status } = useDemoData();
  const { repositories } = useRepositories();
  const locale = useLocale();
  const t = useTranslations("organizationProfile");

  if (status !== "ready" || !repositories) {
    return <DataTableSkeleton rows={3} columns={3} />;
  }

  const organization = repositories.facilities.organization();
  const sites = repositories.facilities.list();

  return (
    <section data-slot="organization-profile" className="grid gap-2">
      <div>
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <dl className="grid gap-1 rounded-md border border-border p-3 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
        <dt className="text-muted-foreground">{t("name")}</dt>
        <dd className="font-medium">{textFor(organization.name, locale)}</dd>
        <dt className="text-muted-foreground">{t("code")}</dt>
        <dd className="font-mono text-xs">{organization.code}</dd>
        <dt className="text-muted-foreground">{t("siteCount")}</dt>
        <dd className="tabular-nums">{sites.length}</dd>
      </dl>

      <ScrollableRegion
        label={t("title")}
        className="rounded-md border border-border"
      >
        <table className="w-full min-w-0 text-sm">
          <caption className="sr-only">{t("description")}</caption>
          <thead className="bg-muted/40 text-left text-xs">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("columns.code")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("columns.site")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("columns.city")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sites.map((site) => (
              <tr
                key={site.id}
                data-slot="organization-site"
                className="border-t border-border"
              >
                <th
                  scope="row"
                  className="px-3 py-2 text-left font-mono text-xs font-medium"
                >
                  {site.code}
                </th>
                <td className="px-3 py-2">{textFor(site.name, locale)}</td>
                <td className="px-3 py-2">
                  {/*
                   * One argument-bearing key rather than two values with a
                   * comma between them in the markup: a literal between tags
                   * is a hardcoded string wherever it appears, and how a place
                   * and its province are joined is the catalogue's decision,
                   * not this component's.
                   */}
                  {t("cityProvince", {
                    city: textFor(site.city, locale),
                    province: site.province,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollableRegion>
    </section>
  );
}
