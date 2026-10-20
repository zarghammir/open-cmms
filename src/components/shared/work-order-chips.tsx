import { useTranslations } from "next-intl";
import { StatusChip } from "@/components/shared/status-chip";
import {
  WORK_ORDER_PRIORITY_PRESENTATION,
  WORK_ORDER_STATUS_PRESENTATION,
} from "@/domain/constants/work-order-status";
import type { WorkOrderPriority, WorkOrderStatus } from "@/domain/types";

/**
 * A work order's status and priority, drawn the one way.
 *
 * The tone and the icon come from the presentation maps in
 * `domain/constants/work-order-status.ts`, and the label comes from the
 * catalogue namespace those maps point at. Every screen that shows a status
 * uses these, so there is no second way of drawing one — and because
 * `StatusChip` demands a label and an icon, none of them can end up as a
 * colour on its own.
 *
 * `work-order-chips.test.tsx` holds the map's `labelKey` and the namespace used
 * here against each other, so repointing one without the other fails.
 */

export function WorkOrderStatusChip({
  status,
  className,
}: {
  status: WorkOrderStatus;
  className?: string;
}) {
  const t = useTranslations("workOrderStatus");
  const { tone, icon } = WORK_ORDER_STATUS_PRESENTATION[status];

  return (
    <StatusChip
      tone={tone}
      icon={icon}
      label={t(status)}
      className={className}
    />
  );
}

export function WorkOrderPriorityChip({
  priority,
  className,
}: {
  priority: WorkOrderPriority;
  className?: string;
}) {
  const t = useTranslations("priority");
  const { tone, icon } = WORK_ORDER_PRIORITY_PRESENTATION[priority];

  return (
    <StatusChip
      tone={tone}
      icon={icon}
      label={t(priority)}
      className={className}
    />
  );
}
