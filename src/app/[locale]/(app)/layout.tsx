import type { ReactNode } from "react";
import { ConflictDialog } from "@/components/offline/conflict-dialog";
import { NotSavingBanner } from "@/components/offline/not-saving-banner";
import { RecordsGate } from "@/components/offline/records-gate";
import { OfflineBanner } from "@/components/offline/offline-banner";
import { ServiceWorker } from "@/components/offline/service-worker";
import { DemoBoot } from "@/components/shared/demo-boot";
import { NotificationSweep } from "@/components/shared/notification-sweep";
import { DeskShell } from "@/components/layout/desk-shell";
import { FieldShell } from "@/components/layout/field-shell";
import { viewForRole } from "@/domain/constants/roles";
import { getDemoRole, getSidebarDefaultOpen } from "@/lib/server-session";

/**
 * One application, two experiences. The role decides which shell renders, so a
 * technician gets the field view everywhere and a coordinator gets the desk
 * view everywhere.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const role = await getDemoRole();

  if (viewForRole(role) === "field") {
    return (
      <FieldShell role={role}>
        <DemoBoot />
        <NotificationSweep />
        <ServiceWorker />
        <RecordsGate>
          <OfflineBanner />
          <NotSavingBanner />
          <ConflictDialog role={role} />
          {children}
        </RecordsGate>
      </FieldShell>
    );
  }

  const sidebarOpen = await getSidebarDefaultOpen();

  return (
    <DeskShell role={role} sidebarOpen={sidebarOpen}>
      <DemoBoot />
      <NotificationSweep />
      <ServiceWorker />
      <RecordsGate>
        <OfflineBanner />
        <NotSavingBanner />
        <ConflictDialog role={role} />
        {children}
      </RecordsGate>
    </DeskShell>
  );
}
