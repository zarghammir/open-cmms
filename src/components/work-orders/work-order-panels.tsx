"use client";

import { Check, Minus } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  PartUsed,
  WorkOrderDetail,
} from "@/data/selectors/work-order-detail";
import { contentLanguageFor, textFor } from "@/lib/localized-text";
import { can, type Role } from "@/domain/constants/roles";
import { useActor, useRepositories } from "@/hooks/use-demo-data";
import { useSaving } from "@/hooks/use-saving";
import type { WorkOrderTask } from "@/domain/types";

/**
 * The four panels that hang off a work order: what was to be done, what it
 * consumed, how it moved, and what people wrote on it.
 *
 * All read-only. WA-39 adds the writing; nothing here is a control dressed as
 * text or text dressed as a control.
 */

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    // `break-inside-avoid` so a panel is never split down the middle by the
    // column it sits in; the margin is the column-flow equivalent of the gap.
    <Card className="lg:mb-4 lg:break-inside-avoid">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Nothing({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/**
 * The tasks, as a checklist.
 *
 * WA-38 shipped this as text that could not be ticked, and said the panel would
 * be replaced rather than enabled in place. This is that replacement: a role
 * that may finish work gets real checkboxes, and a role that may not gets the
 * text — not disabled checkboxes, which read to a screen reader as controls
 * that are unavailable *to you* and invite the wrong conclusion about why.
 *
 * Each row still says its state in words beside the mark, because the mark is
 * the only other signal and colour is not a signal.
 */
export function WorkOrderTasks({
  tasks,
  role,
}: {
  tasks: WorkOrderTask[];
  role?: Role;
}) {
  const t = useTranslations("workOrderDetail.tasks");

  const done = tasks.filter((task) => task.done).length;

  return (
    <Panel title={t("title")}>
      {tasks.length === 0 ? (
        <Nothing>{t("none")}</Nothing>
      ) : (
        <>
          <p className="pb-2 text-xs text-muted-foreground tabular-nums">
            {t("progress", { done, total: tasks.length })}
          </p>
          <ul className="flex flex-col">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="border-b border-border last:border-b-0"
              >
                <TaskRow task={task} role={role} />
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

/**
 * The stock this order consumed.
 *
 * Quantities are signed in the record: negative took stock out, positive put it
 * back. Printing the sign would make a reader do the arithmetic, so the two
 * cases are two sentences and the magnitude is what is shown.
 */
export function WorkOrderPartsUsed({ parts }: { parts: PartUsed[] }) {
  const t = useTranslations("workOrderDetail.parts");
  const format = useFormatter();
  const locale = useLocale();

  return (
    <Panel title={t("title")}>
      {parts.length === 0 ? (
        <Nothing>{t("none")}</Nothing>
      ) : (
        <ul className="flex flex-col">
          {parts.map(({ transaction, part }) => (
            <li
              key={transaction.id}
              className="flex flex-col gap-0.5 border-b border-border py-2 text-sm last:border-b-0"
            >
              <span className="flex flex-wrap items-baseline gap-x-2">
                {part ? (
                  <>
                    <span className="font-mono text-xs">{part.partNumber}</span>
                    <span>{textFor(part.name, locale)}</span>
                  </>
                ) : (
                  // The part record is gone. Naming the movement without it is
                  // the truthful half; inventing a name for it would not be.
                  <span className="text-muted-foreground italic">
                    {t("partUnreadable")}
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {transaction.quantity < 0
                  ? t("quantity", { quantity: -transaction.quantity })
                  : t("returned", { quantity: transaction.quantity })}
                {" · "}
                {format.dateTime(new Date(transaction.at), "day")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/**
 * How the order moved, oldest first.
 *
 * An ordered list, because the order of these is the information. Each row says
 * who did it; an actor who is no longer in the records says so in words rather
 * than leaving the sentence half-finished.
 */
export function WorkOrderHistory({
  entries,
}: {
  entries: WorkOrderDetail["history"];
}) {
  const t = useTranslations("workOrderDetail.history");
  const tStatus = useTranslations("workOrderStatus");
  const format = useFormatter();

  return (
    <Panel title={t("title")}>
      {entries.length === 0 ? (
        <Nothing>{t("none")}</Nothing>
      ) : (
        <ol className="flex flex-col">
          {entries.map(({ entry, actor }) => (
            <li
              key={entry.id}
              className="flex flex-col gap-0.5 border-b border-border py-2 text-sm last:border-b-0"
            >
              <span>
                {entry.from === null
                  ? t("raised", { to: tStatus(entry.to) })
                  : t("moved", {
                      from: tStatus(entry.from),
                      to: tStatus(entry.to),
                    })}
              </span>
              <span className="text-xs text-muted-foreground">
                {actor
                  ? t("by", { name: `${actor.firstName} ${actor.lastName}` })
                  : t("actorUnknown")}
                {" · "}
                {format.dateTime(new Date(entry.at), "dayTime")}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

/**
 * What people wrote, newest first.
 *
 * A comment is somebody's own words and is never translated. It carries the
 * language it was typed in, and a reader of the other language is told so —
 * the same marker the description uses, for the same reason.
 */
export function WorkOrderComments({
  comments,
}: {
  comments: WorkOrderDetail["comments"];
}) {
  const t = useTranslations("workOrderDetail.comments");
  const tDetail = useTranslations("workOrderDetail");
  const format = useFormatter();
  const locale = useLocale();
  const reading = contentLanguageFor(locale);

  return (
    <Panel title={t("title")}>
      {comments.length === 0 ? (
        <Nothing>{t("none")}</Nothing>
      ) : (
        <ul className="flex flex-col">
          {comments.map(({ comment, author }) => (
            <li
              key={comment.id}
              className="flex flex-col gap-0.5 border-b border-border py-2 text-sm last:border-b-0"
            >
              <span className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
                <span>
                  {author
                    ? `${author.firstName} ${author.lastName}`
                    : t("authorUnknown")}
                </span>
                <span>
                  {format.dateTime(new Date(comment.createdAt), "dayTime")}
                </span>
              </span>
              <p className="whitespace-pre-line">{comment.body}</p>
              {comment.contentLanguage !== reading ? (
                <p className="text-xs text-muted-foreground italic">
                  {tDetail("asEntered", { language: comment.contentLanguage })}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/**
 * One task, ticked or not.
 *
 * A checkbox when the reader may finish work, and a mark plus a word when they
 * may not. The two are different elements on purpose: a disabled checkbox
 * announces itself as a control that is unavailable, which is a claim about the
 * reader; text is a claim about the record, which is the true one.
 *
 * The write is optimistic in neither direction — the store is synchronous, so
 * the row re-renders from the records rather than from a local copy that could
 * disagree with them.
 */
function TaskRow({ task, role }: { task: WorkOrderTask; role?: Role }) {
  const t = useTranslations("workOrderDetail.tasks");
  const locale = useLocale();
  const format = useFormatter();
  const { repositories } = useRepositories();
  const actor = useActor(role ?? "auditor");
  const { saving, save } = useSaving();
  const tSaving = useTranslations("states.saving");

  const state = (
    <span className="text-xs text-muted-foreground">
      {task.done ? t("done") : t("notDone")}
      {task.done && task.completedAt
        ? ` \u00b7 ${format.dateTime(new Date(task.completedAt), "day")}`
        : null}
    </span>
  );
  const description = textFor(task.description, locale);

  if (!role || !can(role, "workOrder.complete") || !repositories) {
    return (
      <span className="flex items-start gap-2 py-2 text-sm">
        <span
          aria-hidden="true"
          className={
            task.done ? "text-status-ok mt-0.5" : "mt-0.5 text-muted-foreground"
          }
        >
          {task.done ? (
            <Check className="size-4" />
          ) : (
            <Minus className="size-4" />
          )}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span>{description}</span>
          {state}
        </span>
      </span>
    );
  }

  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-2 py-2 text-sm">
      <input
        type="checkbox"
        /*
         * The tick is this row's "done" — there is no toast behind it — so it
         * follows the record rather than the click. `checked` stays bound to
         * the stored task: if the change does not reach the device the box
         * goes back to where it was, under the standing message, instead of
         * sitting ticked over a work order that does not say so.
         */
        checked={task.done}
        disabled={saving}
        aria-busy={saving}
        onChange={(event) => {
          const next = event.target.checked;
          void save(() => {
            repositories.workOrders.tickTask(task.id, next, actor);
          });
        }}
        className="mt-0.5 size-4 rounded-sm border-border accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-progress"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span>{description}</span>
        {saving ? (
          <span className="text-xs text-muted-foreground">
            {tSaving("label")}
          </span>
        ) : (
          state
        )}
      </span>
    </label>
  );
}
