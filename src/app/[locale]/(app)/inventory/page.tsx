import { ClipboardCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PartsScreen } from "@/components/inventory/parts-screen";
import { ModuleScreen } from "@/components/shared/module-screen";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { moduleMetadata, type LocaleParams } from "@/lib/module-metadata";

export async function generateMetadata({ params }: LocaleParams) {
  return moduleMetadata("inventory", params);
}

/**
 * The parts register. The page stays a server component and the table is a
 * client one, because the records live in the browser — the same division the
 * assets register uses, so the shell, the heading and the module gate are all
 * server-rendered as before.
 *
 * The shelf-count action stays where it was. It is the one thing this screen
 * could already do, and moving it would make a register that gained a table
 * look like a screen that lost a button.
 */
export default async function InventoryPage() {
  const t = await getTranslations("verify");

  return (
    <ModuleScreen
      moduleKey="inventory"
      actions={
        <Button asChild size="sm" variant="outline">
          <Link href="/inventory/verify">
            <ClipboardCheck data-icon="inline-start" />
            {t("start")}
          </Link>
        </Button>
      }
    >
      <PartsScreen />
    </ModuleScreen>
  );
}
