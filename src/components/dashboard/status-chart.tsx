"use client";

import { ChartColumn } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import type { StatusTone } from "@/components/shared/status-chip";
import { DashboardPanel } from "@/components/dashboard/panel";
import { WORK_ORDER_STATUS_PRESENTATION } from "@/domain/constants/work-order-status";
import { WORK_ORDER_STATUSES } from "@/domain/types/work-order";
import type { WorkOrderStatus } from "@/domain/types";

/**
 * Where the work stands, as a shape.
 *
 * Every status is drawn, including the ones sitting at zero: a status missing
 * from the picture reads as a status the product does not have.
 *
 * The count sits in the axis label rather than at the end of the bar. Recharts
 * draws no rectangle for a value of zero and so draws no label beside one
 * either, which left "In progress — 0" showing as a status with nothing next to
 * it: indistinguishable, to a reader, from a status the screen failed to fill
 * in. In the label it is always there.
 *
 * Colour carries nothing here. Each bar is labelled with its status and its
 * count, in the same tones the chips use, and the picture itself is hidden from
 * assistive technology — the list beside it is the real content, built from the
 * same numbers in the same order, so the two cannot drift apart. That is also
 * why there is no tooltip: a number you can only get by hovering is a number a
 * keyboard cannot reach.
 */

interface StatusBar {
  status: WorkOrderStatus;
  label: string;
  /** The status and its count together, because the count has to survive zero. */
  axisLabel: string;
  count: number;
  color: string;
}

const TONE_COLOR: Record<StatusTone, string> = {
  neutral: "var(--status-neutral)",
  info: "var(--status-info)",
  attention: "var(--status-attention)",
  waiting: "var(--status-waiting)",
  positive: "var(--status-positive)",
  quiet: "var(--status-quiet)",
  critical: "var(--status-critical)",
};

export function StatusChart({
  counts,
}: {
  counts: Record<WorkOrderStatus, number> | null;
}) {
  const t = useTranslations("dashboard.chart");
  const tStatus = useTranslations("workOrderStatus");

  const bars: StatusBar[] | null =
    counts === null
      ? null
      : WORK_ORDER_STATUSES.map((status) => ({
          status,
          label: tStatus(status),
          axisLabel: t("axisEntry", {
            status: tStatus(status),
            count: counts[status],
          }),
          count: counts[status],
          color: TONE_COLOR[WORK_ORDER_STATUS_PRESENTATION[status].tone],
        }));

  // A status sitting at zero is still drawn; every status at zero means there
  // is no work at this site at all, which is the one case the picture has
  // nothing to say about and the empty state does.
  const series: StatusBar[] | null =
    bars === null ? null : bars.some((bar) => bar.count > 0) ? bars : [];

  return (
    <DashboardPanel
      title={t("title")}
      description={t("description")}
      rows={series}
      emptyIcon={ChartColumn}
      emptyTitle={t("emptyTitle")}
      emptyBody={t("emptyBody")}
      skeletonRows={4}
    >
      {(rows) => (
        <div>
          <dl className="sr-only">
            <dt>{t("summaryLabel")}</dt>
            {rows.map((row) => (
              <dd key={row.status}>
                {t("summaryEntry", { status: row.label, count: row.count })}
              </dd>
            ))}
          </dl>

          {/*
            `inert` as well as `aria-hidden`, and they are doing different jobs.
            Hiding a subtree does not stop anything inside it taking focus, and
            a keyboard lands on something a screen reader has been told is not
            there. Recharts is the specific case: its accessibility layer is on
            by default and puts `role="application" tabindex="0"` on the SVG, so
            the picture reintroduced exactly what the wrapper excluded. Turning
            that layer off fixes today's instance; `inert` makes the whole
            subtree unable to hold focus, so the next child cannot bring it
            back.
          */}
          <div inert aria-hidden="true" className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                accessibilityLayer={false}
                layout="vertical"
                data={[...rows]}
                margin={{ top: 4, right: 28, bottom: 4, left: 4 }}
                barCategoryGap={6}
              >
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="axisLabel"
                  width={170}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <Bar dataKey="count" radius={2} isAnimationActive={false}>
                  {rows.map((row) => (
                    <Cell key={row.status} fill={row.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </DashboardPanel>
  );
}
