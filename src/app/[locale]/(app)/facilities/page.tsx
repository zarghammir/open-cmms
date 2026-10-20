import { FacilitiesScreen } from "@/components/facilities/facilities-screen";
import { ModuleScreen } from "@/components/shared/module-screen";
import { moduleMetadata, type LocaleParams } from "@/lib/module-metadata";
import { getDemoRole } from "@/lib/server-session";

export async function generateMetadata({ params }: LocaleParams) {
  return moduleMetadata("facilities", params);
}

/**
 * The places. A server component around a client tree, the division every
 * other module screen uses: the shell, the heading and the module gate are
 * server-rendered, and the records live in the browser.
 */
export default async function FacilitiesPage() {
  // Read on the server so the first paint already knows whether this role may
  // raise work from a machine on the plan, rather than deciding after
  // hydration. The same division the asset and work-order pages use.
  const role = await getDemoRole();

  return (
    <ModuleScreen moduleKey="facilities">
      <FacilitiesScreen role={role} />
    </ModuleScreen>
  );
}
