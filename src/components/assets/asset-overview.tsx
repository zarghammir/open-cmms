import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AssetDetail } from "@/hooks/use-asset";
import { calendarDate } from "@/lib/dates";
import { textFor } from "@/lib/localized-text";

/**
 * What this piece of equipment is and where it stands.
 *
 * A description list rather than a table: these are one record's fields, not
 * rows of comparable things, and a screen reader announces the pairing.
 *
 * Every field that can fail to resolve says so in words. A blank value next to
 * "Type" reads as equipment with no type, which is a different claim from a
 * type this system could not read.
 */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2 last:border-b-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export function AssetOverview({ detail }: { detail: AssetDetail }) {
  const t = useTranslations("assetDetail.overview");
  const tShared = useTranslations("assetDetail");
  const format = useFormatter();
  const locale = useLocale();
  const { asset, type, facility, locationPath } = detail;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t("identity")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <Field label={t("tag")}>
              <span className="font-mono tracking-[0.12em] uppercase">
                {asset.assetTag}
              </span>
            </Field>
            <Field label={t("name")}>{textFor(asset.name, locale)}</Field>
            <Field label={t("type")}>
              {type ? textFor(type.label, locale) : tShared("unreadable")}
            </Field>
            <Field label={t("manufacturer")}>
              {asset.manufacturer || tShared("notRecorded")}
            </Field>
            <Field label={t("model")}>
              {asset.model || tShared("notRecorded")}
            </Field>
            <Field label={t("serialNumber")}>
              <span className="font-mono">
                {asset.serialNumber || tShared("notRecorded")}
              </span>
            </Field>
            <Field label={t("installedOn")}>
              {format.dateTime(calendarDate(asset.installedAt), "dayLong")}
            </Field>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("place")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <Field label={t("facility")}>
              {facility
                ? textFor(facility.name, locale)
                : tShared("unreadable")}
            </Field>
            {locationPath.length > 0 ? (
              locationPath.map((location) => (
                <Field key={location.id} label={t(`kind.${location.kind}`)}>
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span>{textFor(location.name, locale)}</span>
                    <span className="font-mono text-2xs tracking-[0.12em] text-muted-foreground uppercase">
                      {location.code}
                    </span>
                  </span>
                </Field>
              ))
            ) : (
              <Field label={t("kind.room")}>{tShared("unreadable")}</Field>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
