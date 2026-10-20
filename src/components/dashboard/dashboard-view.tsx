"use client";

import {
  Boxes,
  ClipboardCheck,
  TriangleAlert,
  Wrench,
  CircleDot,
} from "lucide-react";
import { useTranslations } from "next-intl";
// `useSearchParams` has no locale-aware counterpart in `@/i18n/navigation`: it
// reads the query string, which the locale prefix does not touch. `usePathname`
// and `useRouter` do, and come from there.
import { useSearchParams } from "next/navigation";
import { ActivityPanel } from "@/components/dashboard/activity-panel";
import { ExceptionsPanel } from "@/components/dashboard/exceptions-panel";
import { FacilityFilter } from "@/components/dashboard/facility-filter";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { StatusChart } from "@/components/dashboard/status-chart";
import { UpcomingPanel } from "@/components/dashboard/upcoming-panel";
import type { Id } from "@/domain/types";
import { useDashboard } from "@/hooks/use-dashboard";
import { usePathname, useRouter } from "@/i18n/navigation";

/**
 * The desk home.
 *
 * Everything on it comes from one call, so the cards, the picture and the lists
 * are looking at the same records narrowed the same way. The site being looked
 * at lives in the address rather than in component state: a reviewer can send
 * the link, reload it, or capture it in a screenshot and get the same screen
 * back.
 */
export function DashboardView() {
  const t = useTranslations("dashboard");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const facilityId = searchParams.get("facility") ?? undefined;
  const { kpis, byStatus, exceptions, upcoming, activity, facilities } =
    useDashboard(facilityId);

  function chooseFacility(next: Id | undefined) {
    router.replace(
      { pathname, query: next ? { facility: next } : {} },
      { scroll: false },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <FacilityFilter
          facilities={facilities}
          value={facilityId}
          onChange={chooseFacility}
        />
      </div>

      <div
        data-testid="kpi-row"
        className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
      >
        <KpiCard
          label={t("kpi.openWorkOrders")}
          testId="kpi-open"
          value={kpis?.openWorkOrders ?? null}
          icon={Wrench}
          href="/work-orders"
        />
        <KpiCard
          label={t("kpi.overdue")}
          testId="kpi-overdue"
          value={kpis?.overdue ?? null}
          icon={TriangleAlert}
          href="/work-orders"
          query={{ due: "overdue" }}
          emphasis
        />
        <KpiCard
          label={t("kpi.criticalOpen")}
          testId="kpi-critical"
          value={kpis?.criticalOpen ?? null}
          icon={CircleDot}
          href="/work-orders"
          query={{ priority: "critical" }}
          emphasis
        />
        <KpiCard
          label={t("kpi.partsBelowMinimum")}
          testId="kpi-low-stock"
          value={kpis?.partsBelowMinimum ?? null}
          icon={Boxes}
          href="/inventory"
          query={{ stock: "low" }}
          emphasis
        />
        <KpiCard
          label={t("kpi.inspectionsScheduled")}
          testId="kpi-inspections"
          value={kpis?.inspectionsScheduled ?? null}
          icon={ClipboardCheck}
          href="/inspections"
          query={{ status: "scheduled" }}
        />
      </div>

      <ExceptionsPanel rows={exceptions} />

      {/*
        `items-start` so each card is its own height. Stretched, the chart card
        matched the taller panel beside it and carried a hand-sized blank area
        under six short bars, which reads as a panel that failed to finish
        loading rather than as a panel that has said everything it has to say.
      */}
      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <StatusChart counts={byStatus} />
        <UpcomingPanel rows={upcoming} />
      </div>

      <ActivityPanel rows={activity} />
    </div>
  );
}
