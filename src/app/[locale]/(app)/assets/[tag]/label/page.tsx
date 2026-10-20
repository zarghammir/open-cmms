import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LabelScreen } from "@/components/shared/label-screen";
import { ModuleScreen } from "@/components/shared/module-screen";
import { resolveLocale } from "@/i18n/routing";

/**
 * The label for one asset.
 *
 * A route of its own rather than a tab, because the asset page does not exist
 * yet: WA-10 mounts `LabelScreen` as its Label tab and this route stays as the
 * address a scan resolves to. Addressed by asset tag, never by `Id` — a
 * printed label has to outlive a demonstration reset. The segment is named
 * `[tag]` rather than `[id]` for the same reason: a folder called `[id]` that
 * carries a tag invites the next caller to pass `asset.id`, and Next allows
 * only one slug name at a given path position — so whatever this merges as is
 * what the asset detail page (WA-10) inherits.
 */
interface Params {
  params: Promise<{ locale: string; tag: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, tag } = await params;
  const t = await getTranslations({
    locale: resolveLocale(locale),
    namespace: "label",
  });
  return { title: t("metaTitle", { identifier: tag.toUpperCase() }) };
}

export default async function AssetLabelPage({ params }: Params) {
  const { tag } = await params;
  const t = await getTranslations("label");

  return (
    <ModuleScreen
      moduleKey="assets"
      title={t("title")}
      description={t("description")}
    >
      <LabelScreen kind="asset" identifier={tag.trim().toUpperCase()} />
    </ModuleScreen>
  );
}
