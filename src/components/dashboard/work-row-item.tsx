import { useFormatter, useLocale, useTranslations } from "next-intl";
import { cn } from "cn";
import {
  WorkOrderPriorityChip,
  WorkOrderStatusChip,
} from "@/components/shared/work-order-chips";
import type { WorkRow } from "@/data/selectors/dashboard";
import { Link } from "@/i18n/navigation";
import { calendarDate } from "@/lib/dates";
import { textFor } from "@/lib/localized-text";

/**
 * One work order, as a line on a home screen.
 *
 * The same row serves the desk exceptions list and the field home; `size` only
 * changes how big it is to hit. A technician holding a phone in a corridor gets
 * a 44px target, which is the reason the field view exists at all.
 *
 * Where it links, and why it is not the work order itself yet: the work-order
 * detail page arrives with WA-11. Linking at this row to a page that does not
 * exist would give a reviewer a dead end, so it carries the order's number into
 * the queue, which WA-11 will read as a filter. The same goes for the site.
 */
export function WorkRowItem({
  row,
  size = "desk",
}: {
  row: WorkRow;
  size?: "desk" | "field";
}) {
  const t = useTranslations("dashboard.work");
  const format = useFormatter();
  const locale = useLocale();
  const field = size === "field";

  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        /*
         * Straight to the order, not to the queue carrying it in a query. The
         * old address said `?order=` and nothing on the queue ever read it, so
         * a row that looked like a link to one order opened a list of forty.
         */
        href={`/work-orders/${row.number}`}
        className={cn(
          "flex flex-col gap-1.5 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          field ? "min-h-11 justify-center px-1 py-3" : "px-1 py-2.5",
        )}
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-2xs tracking-[0.12em] text-muted-foreground uppercase">
            {row.number}
          </span>
          <WorkOrderPriorityChip priority={row.priority} />
          <WorkOrderStatusChip status={row.status} />
        </span>

        <span className={cn("font-medium", field ? "text-base" : "text-sm")}>
          {textFor(row.title, locale)}
        </span>

        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span>
            {row.facilityName
              ? textFor(row.facilityName, locale)
              : t("unknownSite")}
          </span>
          <span aria-hidden="true">{"·"}</span>
          <span className={cn(row.daysLate !== null && "text-status-critical")}>
            {row.daysLate !== null
              ? t("daysLate", { days: row.daysLate })
              : row.dueOn
                ? t("dueOn", {
                    date: format.dateTime(calendarDate(row.dueOn), "day"),
                  })
                : t("noDueDate")}
          </span>
        </span>
      </Link>
    </li>
  );
}
