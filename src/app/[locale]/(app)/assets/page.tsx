import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AssetsScreen } from "@/components/assets/assets-screen";
import { CapabilityAction } from "@/components/shared/capability-action";
import { ModuleScreen } from "@/components/shared/module-screen";
import { moduleMetadata, type LocaleParams } from "@/lib/module-metadata";
import { getDemoRole } from "@/lib/server-session";

export async function generateMetadata({ params }: LocaleParams) {
  return moduleMetadata("assets", params);
}

/**
 * The equipment register. The page stays a server component and the table is
 * a client one, because the records live in the browser — so the shell, the
 * heading and the role gate are all server-rendered as before.
 */
export default async function AssetsPage() {
  const role = await getDemoRole();
  const t = await getTranslations("actions");

  return (
    <ModuleScreen
      moduleKey="assets"
      actions={
        <CapabilityAction
          role={role}
          capability="asset.edit"
          label={t("addAsset")}
          icon={<Plus data-icon="inline-start" />}
        />
      }
    >
      <AssetsScreen />
    </ModuleScreen>
  );
}
