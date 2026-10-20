"use client";

import { CircleCheck, TriangleAlert } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { RecordMissing } from "@/components/shared/record-missing";
import { LoadingState } from "@/components/shared/state-panels";
import { StatusChip } from "@/components/shared/status-chip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LedgerEntry, PartDetail } from "@/data/selectors/part-detail";
import { usePart } from "@/hooks/use-part";
import { Link } from "@/i18n/navigation";
import { textFor } from "@/lib/localized-text";

/**
 * One part, and everything recorded against it.
 *
 * Three answers, the same three the asset and work-order pages give: a skeleton
 * while the browser is still reading the records, `RecordMissing` naming the
 * stock number back when this system does not hold it, the part otherwise. A
 * number that resolves to nothing is somebody following a link or a scan, and
 * drawing a blank part would let a dead code look like an ordinary visit.
 */
export function PartDetailScreen({ partNumber }: { partNumber: string }) {
  const t = useTranslations("partDetail");
  const lookup = usePart(partNumber);

  if (lookup.state === "unknown") {
    return <LoadingState rows={5} />;
  }

  if (lookup.state === "missing") {
    return (
      <RecordMissing
        identifier={partNumber}
        body={t("missingBody", { number: partNumber })}
        action={
          <Link
            href="/inventory"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {t("backToRegister")}
          </Link>
        }
      />
    );
  }

  return <PartDetailBody detail={lookup.detail} low={lookup.low} />;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2 last:border-b-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

/**
 * Where a movement came from, as the three answers the record gives.
 *
 * `none` is the one worth drawing carefully. A shelf count belongs to no job,
 * and saying so plainly is the truth; drawing it the way an unreadable link is
 * drawn would tell a reader a good count was damaged.
 */
function Origin({ origin }: { origin: LedgerEntry["origin"] }) {
  const t = useTranslations("partDetail.ledger");

  if (origin.kind === "none") {
    return <span className="text-muted-foreground">{t("noOrder")}</span>;
  }
  if (origin.kind === "unreadable") {
    return (
      <span className="text-muted-foreground italic">
        {t("orderUnreadable")}
      </span>
    );
  }
  return (
    <Link
      href={`/work-orders/${origin.order.number}`}
      className="font-mono text-xs text-primary underline-offset-4 hover:underline"
    >
      {origin.order.number}
    </Link>
  );
}

function PartDetailBody({ detail, low }: { detail: PartDetail; low: boolean }) {
  const t = useTranslations("partDetail");
  const tCategory = useTranslations("partCategory");
  const tUnit = useTranslations("unitOfMeasure");
  const tKind = useTranslations("inventoryTransactionKind");
  const tTable = useTranslations("partsTable");
  const format = useFormatter();
  const locale = useLocale();
  const { part, facility, bin, ledger } = detail;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        {/* The stock number is the page heading, so it is not repeated here. */}
        <h2 className="text-xl">{textFor(part.name, locale)}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip
            tone={low ? "critical" : "positive"}
            icon={low ? TriangleAlert : CircleCheck}
            label={low ? tTable("low") : tTable("ok")}
          />
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("onHandSummary", {
              onHand: part.quantityOnHand,
              unit: tUnit(part.unitOfMeasure, { count: part.quantityOnHand }),
              minimum: part.reorderPoint,
            })}
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-4 lg:block lg:columns-2 lg:gap-4">
        <Card className="lg:mb-4 lg:break-inside-avoid">
          <CardHeader>
            <CardTitle>{t("detailsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <Field label={t("category")}>{tCategory(part.category)}</Field>
              <Field label={t("site")}>
                {facility ? (
                  textFor(facility.name, locale)
                ) : (
                  <span className="text-muted-foreground">
                    {t("unreadable")}
                  </span>
                )}
              </Field>
              <Field label={t("bin")}>
                {bin ? (
                  <span className="font-mono text-xs">{bin.code}</span>
                ) : (
                  // The record names a bin this system cannot read. Not "no
                  // bin": the part is somewhere, and this is us not knowing.
                  <span className="text-muted-foreground">
                    {t("unreadable")}
                  </span>
                )}
              </Field>
              <Field label={t("onHand")}>
                <span className="tabular-nums">
                  {t("quantityWithUnit", {
                    quantity: part.quantityOnHand,
                    unit: tUnit(part.unitOfMeasure, {
                      count: part.quantityOnHand,
                    }),
                  })}
                </span>
              </Field>
              <Field label={t("minimum")}>
                <span className="tabular-nums">
                  {format.number(part.reorderPoint, "integer")}
                </span>
              </Field>
              <Field label={t("unitCost")}>
                <span className="tabular-nums">
                  {format.number(part.unitCost, "currency")}
                </span>
              </Field>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:mb-4 lg:break-inside-avoid">
          <CardHeader>
            <CardTitle>{t("ledger.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {ledger.length === 0 ? (
              // Nothing has moved. That is a fact about the part, not a screen
              // that failed to load, so it says so in words.
              <p className="text-sm text-muted-foreground">
                {t("ledger.none")}
              </p>
            ) : (
              <ol data-slot="part-ledger" className="flex flex-col">
                {ledger.map(({ transaction, origin, actor }) => (
                  <li
                    key={transaction.id}
                    className="flex flex-col gap-0.5 border-b border-border py-2 text-sm last:border-b-0"
                  >
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span>{tKind(transaction.kind)}</span>
                      {/*
                        Signed in the record: negative took stock out, positive
                        put it back. Printing the sign would make a reader do
                        the arithmetic, so the two cases are two sentences and
                        the magnitude is what is shown.
                      */}
                      <span className="text-xs tabular-nums">
                        {transaction.quantity < 0
                          ? t("ledger.out", {
                              quantity: -transaction.quantity,
                            })
                          : t("ledger.in", { quantity: transaction.quantity })}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
                      <span>
                        {format.dateTime(new Date(transaction.at), "dayTime")}
                      </span>
                      <span>
                        {actor
                          ? t("ledger.by", {
                              name: `${actor.firstName} ${actor.lastName}`,
                            })
                          : t("ledger.actorUnknown")}
                      </span>
                      <Origin origin={origin} />
                    </span>
                    {transaction.note ? (
                      <p className="text-xs whitespace-pre-line">
                        {transaction.note}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
