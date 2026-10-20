import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LabelScreen } from "@/components/shared/label-screen";
import { ModuleScreen } from "@/components/shared/module-screen";
import { resolveLocale } from "@/i18n/routing";

/**
 * The label for one part, addressed by stock number.
 *
 * The segment is named `[stock]`, not `[id]`: the folder name is the only hint
 * the next caller gets about what belongs in it, and Next allows one slug name
 * per path position, so this is what the inventory detail page inherits.
 */
interface Params {
  params: Promise<{ locale: string; stock: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, stock } = await params;
  const t = await getTranslations({
    locale: resolveLocale(locale),
    namespace: "label",
  });
  return { title: t("metaTitle", { identifier: stock.toUpperCase() }) };
}

export default async function PartLabelPage({ params }: Params) {
  const { stock } = await params;
  const t = await getTranslations("label");

  return (
    <ModuleScreen
      moduleKey="inventory"
      title={t("title")}
      description={t("description")}
    >
      <LabelScreen kind="part" identifier={stock.trim().toUpperCase()} />
    </ModuleScreen>
  );
}
