import { ModuleScreen } from "@/components/shared/module-screen";
import { MaintenanceScreen } from "@/components/maintenance/maintenance-screen";
import { moduleMetadata, type LocaleParams } from "@/lib/module-metadata";
import { getDemoRole } from "@/lib/server-session";

export async function generateMetadata({ params }: LocaleParams) {
  return moduleMetadata("preventiveMaintenance", params);
}

/**
 * The planned visits. The page stays a server component and the table is a
 * client one, because the records live in the browser — the same division the
 * assets and parts registers use.
 *
 * The role is read on the server so the first paint already knows whether this
 * reader may raise work, rather than deciding after hydration.
 */
export default async function PreventiveMaintenancePage() {
  const role = await getDemoRole();

  return (
    <ModuleScreen moduleKey="preventiveMaintenance">
      <MaintenanceScreen role={role} />
    </ModuleScreen>
  );
}
