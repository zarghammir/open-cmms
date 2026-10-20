import { FileUp } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { NotificationDefaultsPanel } from "@/components/settings/notification-defaults-panel";
import { OrganizationProfile } from "@/components/settings/organization-profile";
import { WorkflowRulesPanel } from "@/components/settings/workflow-rules-panel";
import { SyncLog } from "@/components/offline/sync-log";
import { DemoControls } from "@/components/shared/demo-controls";
import { EmailLog } from "@/components/notifications/email-log";
import { ModulePanel } from "@/components/shared/module-panel";
import { ModuleScreen } from "@/components/shared/module-screen";
import { moduleMetadata, type LocaleParams } from "@/lib/module-metadata";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getDemoRole } from "@/lib/server-session";

export async function generateMetadata({ params }: LocaleParams) {
  return moduleMetadata("settings", params);
}

export default async function SettingsPage() {
  const role = await getDemoRole();
  const t = await getTranslations("import");

  return (
    <ModuleScreen
      moduleKey="settings"
      actions={
        <Button asChild size="sm" variant="outline">
          <Link href="/settings/import">
            <FileUp data-icon="inline-start" />
            {t("open")}
          </Link>
        </Button>
      }
    >
      <OrganizationProfile />
      <WorkflowRulesPanel role={role} />
      <NotificationDefaultsPanel role={role} />
      <DemoControls role={role} />
      <EmailLog />
      <SyncLog />
      <ModulePanel moduleKey="settings" />
    </ModuleScreen>
  );
}
