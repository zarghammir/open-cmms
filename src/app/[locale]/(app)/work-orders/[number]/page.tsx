import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ModuleScreen } from "@/components/shared/module-screen";
import { LoadingState } from "@/components/shared/state-panels";
import { WorkOrderDetailScreen } from "@/components/work-orders/work-order-detail-screen";
import { resolveLocale } from "@/i18n/routing";
import { getDemoRole } from "@/lib/server-session";

/**
 * One work order, and everything recorded against it.
 *
 * Addressed by number, never by `Id` — see "Addressing a record in a URL". The
 * segment is `[number]` because that is what it holds: `buildSeed(today)`
 * rebuilds every record whenever the demonstration is reset, so an address
 * built on an id stops resolving the moment somebody presses Reset, while
 * `WO-2026-0148` is the thing a coordinator reads out over the phone.
 *
 * Next allows one slug name at a given path position, so this name is the one
 * every later route beside it inherits. `[number]` is the one that will still
 * be true when a status route or a print route lands here.
 *
 * The screen is a client component because every record on it is read from a
 * store the browser holds. The boundary here is what lets the header and the
 * page title be prerendered anyway.
 */
interface Params {
  params: Promise<{ locale: string; number: string }>;
}

function readNumber(raw: string): string {
  // The same normalising the repository does, so the heading and the lookup
  // cannot disagree about which order this is.
  return decodeURIComponent(raw).trim().toUpperCase();
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, number } = await params;
  const t = await getTranslations({
    locale: resolveLocale(locale),
    namespace: "workOrderDetail",
  });
  return { title: t("metaTitle", { number: readNumber(number) }) };
}

export default async function WorkOrderDetailPage({ params }: Params) {
  const { number } = await params;
  const t = await getTranslations("workOrderDetail");
  const wanted = readNumber(number);
  // Read on the server, so the first paint already knows whether this role may
  // change anything rather than deciding after hydration.
  const role = await getDemoRole();

  return (
    /*
     * Titled with the record rather than with the module, the way the asset
     * page is: `ModuleScreen` moves the module's own name into the eyebrow when
     * given a title, so a reader still knows where they are and the page stops
     * carrying two headings. The number is what a server can know — the order's
     * title lives in the store the browser holds.
     */
    <ModuleScreen
      moduleKey="workOrders"
      title={wanted}
      description={t("pageDescription")}
    >
      <Suspense fallback={<LoadingState rows={6} />}>
        <WorkOrderDetailScreen number={wanted} role={role} />
      </Suspense>
    </ModuleScreen>
  );
}
