import { Wrench } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { AssetPanel } from "@/components/assets/asset-panel";
import {
  WorkOrderPriorityChip,
  WorkOrderStatusChip,
} from "@/components/shared/work-order-chips";
import { isOpenStatus } from "@/domain/constants/work-order-status";
import type { IsoDate, WorkOrder } from "@/domain/types";
import { Link } from "@/i18n/navigation";
import { calendarDate } from "@/lib/dates";
import { textFor } from "@/lib/localized-text";

/**
 * Work raised against this asset, open before closed.
 *
 * Open first because that is what someone standing at the machine needs; the
 * closed ones are the record of what it has been through and keep their place
 * below. `isOpenStatus` decides which is which, so this list and every count on
 * the dashboard agree about what "open" means.
 *
 * The rows link into the queue with the order's number rather than to a detail
 * page: that page arrives with WA-11, and a link to a page that does not exist
 * is a dead end in a demonstration.
 */
export function AssetWorkOrders({
  orders,
  today,
}: {
  orders: WorkOrder[];
  today: IsoDate;
}) {
  const t = useTranslations("assetDetail.workOrders");
  const format = useFormatter();
  const locale = useLocale();

  const sorted = [...orders].sort((a, b) => {
    const open =
      Number(isOpenStatus(b.status)) - Number(isOpenStatus(a.status));
    if (open !== 0) return open;
    return b.requestedAt.localeCompare(a.requestedAt);
  });

  return (
    <AssetPanel
      title={t("title")}
      description={t("description")}
      rows={sorted}
      emptyIcon={Wrench}
      emptyTitle={t("emptyTitle")}
      emptyBody={t("emptyBody")}
    >
      {(rows) => (
        <ul data-testid="asset-work-orders" className="flex flex-col">
          {rows.map((order) => {
            const late =
              order.dueAt !== null &&
              isOpenStatus(order.status) &&
              order.dueAt < today;

            return (
              <li
                key={order.id}
                className="border-b border-border last:border-b-0"
              >
                <Link
                  href={`/work-orders/${order.number}`}
                  className="flex flex-col gap-1 rounded-sm px-1 py-2.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-2xs tracking-[0.12em] text-muted-foreground uppercase">
                      {order.number}
                    </span>
                    <WorkOrderPriorityChip priority={order.priority} />
                    <WorkOrderStatusChip status={order.status} />
                  </span>
                  <span className="text-sm font-medium">
                    {textFor(order.title, locale)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {order.dueAt
                      ? t(late ? "overdueOn" : "dueOn", {
                          date: format.dateTime(
                            calendarDate(order.dueAt),
                            "day",
                          ),
                        })
                      : t("noDueDate")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AssetPanel>
  );
}
