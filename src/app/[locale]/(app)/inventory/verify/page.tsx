import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ModuleScreen } from "@/components/shared/module-screen";
import { VerifyPanel } from "@/components/shared/verify-panel";
import { resolveLocale } from "@/i18n/routing";
import { getDemoRole } from "@/lib/server-session";
import type { LocaleParams } from "@/lib/module-metadata";

/**
 * Inventory verification. Under the inventory module, so the roles that may
 * open inventory may open this, and the capability check inside decides who
 * may actually write a count.
 */
export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: resolveLocale(locale),
    namespace: "verify",
  });
  return { title: t("title"), description: t("description") };
}

export default async function InventoryVerifyPage() {
  const role = await getDemoRole();
  const t = await getTranslations("verify");

  return (
    <ModuleScreen
      moduleKey="inventory"
      title={t("title")}
      description={t("description")}
    >
      <VerifyPanel role={role} />
    </ModuleScreen>
  );
}
