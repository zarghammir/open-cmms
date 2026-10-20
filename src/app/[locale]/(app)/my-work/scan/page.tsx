import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ModuleScreen } from "@/components/shared/module-screen";
import { ScanPanel } from "@/components/shared/scan-panel";
import { resolveLocale } from "@/i18n/routing";
import type { LocaleParams } from "@/lib/module-metadata";

/**
 * Scanning lives inside the field home rather than becoming a twelfth module:
 * the navigation is the eleven the specification sets, plus the field home,
 * and a scan is something a technician does on the way to a record — not a
 * place in the product.
 *
 * Routing it under `my-work` also means the role check is the field home's
 * own, so `ModuleScreen` stays the single gate.
 */
export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: resolveLocale(locale),
    namespace: "scan",
  });
  return { title: t("title"), description: t("description") };
}

export default async function ScanPage() {
  const t = await getTranslations("scan");

  return (
    <ModuleScreen
      moduleKey="myWork"
      title={t("title")}
      description={t("description")}
    >
      <ScanPanel />
    </ModuleScreen>
  );
}
