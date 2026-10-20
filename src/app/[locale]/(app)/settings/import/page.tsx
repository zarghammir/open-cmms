import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ImportWizard } from "@/components/import/import-wizard";
import { ModuleScreen } from "@/components/shared/module-screen";
import { resolveLocale } from "@/i18n/routing";
import { getDemoRole } from "@/lib/server-session";
import type { LocaleParams } from "@/lib/module-metadata";

/**
 * The MP2 import, under Settings.
 *
 * Settings decides who may open it, so the roles that configure the system are
 * the roles that can bring data into it. The capability check inside decides
 * who may actually commit, because opening the wizard to look at what a
 * spreadsheet contains is not the same act as writing it.
 */
export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: resolveLocale(locale),
    namespace: "import",
  });
  return { title: t("title"), description: t("description") };
}

export default async function ImportPage() {
  const role = await getDemoRole();
  const t = await getTranslations("import");

  return (
    <ModuleScreen
      moduleKey="settings"
      title={t("title")}
      description={t("description")}
    >
      <ImportWizard role={role} />
    </ModuleScreen>
  );
}
