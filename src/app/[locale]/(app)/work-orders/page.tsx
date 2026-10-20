import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { CapabilityAction } from "@/components/shared/capability-action";
import { CreateWorkOrderForm } from "@/components/work-orders/create-work-order-form";
import { WorkOrderQueue } from "@/components/work-orders/work-order-queue";
import { ModuleScreen } from "@/components/shared/module-screen";
import { redirect } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/routing";
import { moduleMetadata, type LocaleParams } from "@/lib/module-metadata";
import { getDemoRole } from "@/lib/server-session";

export async function generateMetadata({ params }: LocaleParams) {
  return moduleMetadata("workOrders", params);
}

/**
 * Raising work, and what has been raised.
 *
 * `?asset=<tag>` preselects the equipment, which is where a row action on the
 * assets table lands. Records are addressed by tag rather than by id, so the
 * address means something to the person reading it.
 *
 * `?order=<number>` is an older address, from before there was an order to open.
 * The three screens that linked that way now point at `/work-orders/<number>`
 * directly, but the address is in pasted messages and screenshots, so it is
 * honoured here by sending the reader where the link always meant to take them.
 * A number this system does not hold still redirects: the detail page names it
 * back, which is the answer, and holding it here would only mean writing the
 * same "no such order" panel twice.
 */
export default async function WorkOrdersPage({
  params,
  searchParams,
}: {
  searchParams: Promise<{ asset?: string; order?: string }>;
  params: Promise<{ locale: string }>;
}) {
  const role = await getDemoRole();
  const { asset, order } = await searchParams;
  const { locale } = await params;

  const wanted = order?.trim().toUpperCase();
  if (wanted) {
    redirect({
      href: `/work-orders/${encodeURIComponent(wanted)}`,
      locale: resolveLocale(locale),
    });
  }

  const t = await getTranslations("actions");

  return (
    <ModuleScreen
      moduleKey="workOrders"
      actions={
        <CapabilityAction
          role={role}
          capability="workOrder.create"
          label={t("newWorkOrder")}
          icon={<Plus data-icon="inline-start" />}
          focusTargetId="wo-asset"
        />
      }
    >
      {/*
        The queue first, the form second.
        
        Until this ticket the page opened on a form, because the only other
        thing on it was a recent-eight list. Now the queue is what the page is
        for — a coordinator arrives to find work, not to raise it — and a form
        occupying the whole first screen pushed every work order below the fold.
        The header's "New work order" action focuses the form, so raising one is
        still one click from the top.
      */}
      <WorkOrderQueue />
      <CreateWorkOrderForm role={role} presetAssetTag={asset} />
    </ModuleScreen>
  );
}
