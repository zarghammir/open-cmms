"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { RecordMissing } from "@/components/shared/record-missing";
import { LoadingState } from "@/components/shared/state-panels";
import {
  WorkOrderPriorityChip,
  WorkOrderStatusChip,
} from "@/components/shared/work-order-chips";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkOrderDocuments } from "@/components/work-orders/work-order-documents";
import {
  WorkOrderComments,
  WorkOrderHistory,
  WorkOrderPartsUsed,
  WorkOrderTasks,
} from "@/components/work-orders/work-order-panels";
import type {
  DueReading,
  WorkOrderAssignee,
  WorkOrderDetail,
} from "@/data/selectors/work-order-detail";
import { WorkOrderActions } from "@/components/work-orders/work-order-actions";
import { viewForRole, type Role } from "@/domain/constants/roles";
import { useWorkOrder } from "@/hooks/use-work-order";
import { Link } from "@/i18n/navigation";
import { calendarDate } from "@/lib/dates";
import { contentLanguageFor, textFor } from "@/lib/localized-text";

/**
 * One work order.
 *
 * Three answers, the same three the asset page gives: a skeleton while the
 * browser is still reading the records, `RecordMissing` naming the number back
 * when this system does not hold it, the order otherwise. A number that
 * resolves to nothing is somebody following a link, and showing them a blank
 * order would let a broken link look like an ordinary visit.
 */
export function WorkOrderDetailScreen({
  number,
  role,
}: {
  number: string;
  role: Role;
}) {
  const t = useTranslations("workOrderDetail");
  const lookup = useWorkOrder(number);

  if (lookup.state === "unknown") {
    return <LoadingState rows={6} />;
  }

  if (lookup.state === "missing") {
    return (
      <RecordMissing
        identifier={number}
        body={t("missingBody", { number })}
        action={
          <Link
            href="/work-orders"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {t("backToQueue")}
          </Link>
        }
      />
    );
  }

  return <WorkOrderDetailBody detail={lookup.detail} role={role} />;
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
 * The due date as a sentence.
 *
 * Five readings, and the two easy to collapse are kept apart: an open order
 * eight days past its date is late, a cancelled one is not — it simply had a
 * date that has gone by. `late` comes from the same rule as the queue's and the
 * dashboard's, so the three screens cannot disagree about the word.
 */
function DueLine({ due }: { due: DueReading }) {
  const t = useTranslations("workOrderDetail.due");
  const format = useFormatter();

  switch (due.kind) {
    case "none":
      return <span className="text-muted-foreground">{t("none")}</span>;
    case "today":
      return <span>{t("today")}</span>;
    case "ahead":
      return (
        <span className="tabular-nums">{t("ahead", { days: due.days })}</span>
      );
    case "late":
      return (
        <span className="text-status-critical tabular-nums">
          {t("late", { days: due.days })}
        </span>
      );
    default:
      return (
        <span className="text-muted-foreground tabular-nums">
          {t("passed", {
            date: format.dateTime(calendarDate(due.date), "day"),
          })}
        </span>
      );
  }
}

/** Who is doing it, drawn as the three answers the record gives. */
function AssigneeLine({ assignee }: { assignee: WorkOrderAssignee }) {
  const t = useTranslations("workOrderDetail.assignee");

  if (assignee.kind === "nobody") {
    return <span className="text-muted-foreground">{t("nobody")}</span>;
  }

  if (assignee.kind === "person") {
    return (
      <span>
        {assignee.user.firstName} {assignee.user.lastName}
      </span>
    );
  }

  /*
   * The code is monospaced; the sentence around it is not.
   *
   * One interpolated string set in mono made "an outside contractor" look like
   * something typed into a terminal. Splitting it into two messages would let a
   * translator lose the word order, so the catalogue tags the code itself and
   * the tag is what carries the type — which is also why the sentence stays one
   * translatable unit.
   */
  const code = assignee.code;
  const mono = (chunks: ReactNode) => (
    <span className="font-mono text-xs">{chunks}</span>
  );

  if (assignee.resolvesTo === null) {
    // A code this organisation does not use. Not "unassigned": the source
    // system recorded something, and this is that something being unreadable.
    return <span>{t.rich("crewUnknown", { code, mono })}</span>;
  }
  if (assignee.resolvesTo === "contractor") {
    return <span>{t.rich("contractor", { code, mono })}</span>;
  }
  return (
    <span>
      {t.rich("crewPerson", {
        code,
        name: `${assignee.resolvesTo.firstName} ${assignee.resolvesTo.lastName}`,
        mono,
      })}
    </span>
  );
}

function WorkOrderDetailBody({
  detail,
  role,
}: {
  detail: WorkOrderDetail;
  role: Role;
}) {
  const t = useTranslations("workOrderDetail");
  const format = useFormatter();
  const locale = useLocale();
  const { order, asset, facility, locationPath } = detail;

  const description = textFor(order.description, locale);
  /*
   * Null is its own answer: a record authored in both languages, as every
   * seeded one is. Only words written in one language and read in the other
   * get the marker — saying "as written in English" over text that was
   * authored bilingually would be false.
   */
  const writtenIn = order.contentLanguage;
  const otherLanguage =
    writtenIn !== null && writtenIn !== contentLanguageFor(locale);

  /*
   * The order the panels come in, decided by the view rather than by the width.
   *
   * A technician opens this screen to *do* the job: the checklist is the work,
   * and on a phone anything below it costs a scroll before the first tap. A
   * coordinator opens the same screen to *read* the record, and for them the
   * description and the details are the point.
   *
   * By view and not by a breakpoint, for two reasons. A CSS `order` would move
   * the panels visually while leaving the DOM — and so the tab order and what a
   * screen reader announces — in the old sequence, which is a worse answer than
   * either order on its own. And the desk layout is untouched by construction,
   * so this cannot quietly rearrange a screen it was not aimed at.
   */
  const reference = (
    <>
      <Card className="lg:mb-4 lg:break-inside-avoid">
        <CardHeader>
          <CardTitle>{t("description.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {description.trim().length > 0 ? (
            <p className="text-sm whitespace-pre-line">{description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("description.none")}
            </p>
          )}
          {otherLanguage && writtenIn ? (
            // Somebody's own words, in the other language. Saying so is the
            // alternative to presenting them as a translation.
            <p className="text-xs text-muted-foreground italic">
              {t("asEntered", { language: writtenIn })}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="lg:mb-4 lg:break-inside-avoid">
        <CardHeader>
          <CardTitle>{t("detailsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <Field label={t("equipment")}>
              {asset ? (
                /*
                 * Cross-linked by tag, never by id: the same address a label,
                 * a scan and a typed search all resolve to.
                 */
                <Link
                  href={`/assets/${asset.assetTag}`}
                  className="font-mono text-xs tracking-[0.12em] text-primary uppercase underline-offset-4 hover:underline"
                >
                  {asset.assetTag}
                </Link>
              ) : (
                <span className="text-muted-foreground">{t("unreadable")}</span>
              )}
              {asset ? (
                <span className="ml-2">{textFor(asset.name, locale)}</span>
              ) : null}
            </Field>
            <Field label={t("site")}>
              {facility ? (
                textFor(facility.name, locale)
              ) : (
                <span className="text-muted-foreground">{t("unreadable")}</span>
              )}
            </Field>
            <Field label={t("place")}>
              {locationPath.length > 0 ? (
                locationPath
                  .map((location) => textFor(location.name, locale))
                  .join(" › ")
              ) : (
                <span className="text-muted-foreground">
                  {t("notRecorded")}
                </span>
              )}
            </Field>
            <Field label={t("due.label")}>
              <DueLine due={detail.due} />
            </Field>
            <Field label={t("assignee.label")}>
              <AssigneeLine assignee={detail.assignee} />
            </Field>
            <Field label={t("labour.title")}>
              {/*
                  Null is not zero. An order nobody has logged time against says
                  so in words; "0 min" would claim somebody worked no time.
                */}
              {detail.loggedMinutes === null ? (
                <span className="text-muted-foreground">
                  {t("labour.none")}
                </span>
              ) : (
                <span className="tabular-nums">
                  {t("labour.total", { minutes: detail.loggedMinutes })}
                </span>
              )}
            </Field>
          </dl>
        </CardContent>
      </Card>
    </>
  );
  const work = (
    <>
      <WorkOrderTasks tasks={detail.tasks} role={role} />
      <WorkOrderPartsUsed parts={detail.partsUsed} />
      <WorkOrderDocuments workOrderId={order.id} role={role} />
    </>
  );
  const trail = (
    <>
      <WorkOrderHistory entries={detail.history} />
      <WorkOrderComments comments={detail.comments} />
    </>
  );
  const rest =
    viewForRole(role ?? "auditor") === "field" ? (
      <>
        {work}
        {reference}
        {trail}
      </>
    ) : (
      <>
        {reference}
        {work}
        {trail}
      </>
    );

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        {/* The number is the page heading, so it is not repeated here. */}
        <h2 className="text-xl">{textFor(order.title, locale)}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <WorkOrderStatusChip status={order.status} />
          <WorkOrderPriorityChip priority={order.priority} />
          <span className="text-xs text-muted-foreground">
            {t("raisedOn", {
              date: format.dateTime(new Date(order.requestedAt), "day"),
            })}
          </span>
        </div>
        {/*
          Under the chips, so what the order *is* is read before what can be
          done to it. A row of buttons above the status would have somebody
          pressing one before they know which order they are looking at.
        */}
        <WorkOrderActions order={order} role={role} />
      </header>

      {/*
        Columns rather than a grid, and the reason is the data.

        A grid puts these six panels in fixed rows, and a row is as tall as its
        tallest card — so a one-sentence description is drawn as a box the
        height of the details list beside it, and an empty box inside a border
        reads as a panel that failed to load. `items-start` fixes the box and
        leaves the hole. What varies here is not the layout but the records: an
        order can have one task or nine, no comments or several, and no
        arrangement of rows is right for all of them.

        Columns let each panel take its own height and the next one follow it.
        Reading order is unchanged — it is DOM order either way, which is what a
        screen reader announces and what the keyboard walks.
      */}
      <div className="flex flex-col gap-4 lg:block lg:columns-2 lg:gap-4">
        {rest}
      </div>
    </div>
  );
}
