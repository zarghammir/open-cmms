import { ScanLine } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { FieldHome } from "@/components/dashboard/field-home";
import { ModuleScreen } from "@/components/shared/module-screen";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { moduleMetadata, type LocaleParams } from "@/lib/module-metadata";
import { getDemoRole } from "@/lib/server-session";

export async function generateMetadata({ params }: LocaleParams) {
  return moduleMetadata("myWork", params);
}

/**
 * Home for the field roles: this person's own work, nothing else.
 *
 * The role is read on the server, so the first paint already knows whose work
 * this is rather than deciding after hydration.
 *
 * Scan sits in the header rather than in the navigation. It is something a
 * technician does on the way to a record, not a place in the product, and the
 * navigation is the eleven modules the specification sets plus this home.
 */
export default async function MyWorkPage() {
  const role = await getDemoRole();
  const t = await getTranslations("scan");

  return (
    <ModuleScreen
      moduleKey="myWork"
      showToday
      actions={
        <Button asChild size="sm">
          <Link href="/my-work/scan">
            <ScanLine data-icon="inline-start" />
            {t("title")}
          </Link>
        </Button>
      }
    >
      <FieldHome role={role} />
    </ModuleScreen>
  );
}
