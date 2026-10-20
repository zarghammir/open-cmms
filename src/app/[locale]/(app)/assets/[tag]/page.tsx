import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AssetDetailScreen } from "@/components/assets/asset-detail-screen";
import { ModuleScreen } from "@/components/shared/module-screen";
import { LoadingState } from "@/components/shared/state-panels";
import { resolveLocale } from "@/i18n/routing";
import { getDemoRole } from "@/lib/server-session";

/**
 * One asset, and everything that hangs off it.
 *
 * Addressed by tag, never by `Id` — see "Addressing a record in a URL". The
 * segment is `[tag]` because WA-16's label route at `/assets/[tag]/label` sits
 * directly beneath it and Next allows one slug name at a given path position;
 * the two are the same address, read the same way.
 *
 * The screen itself is a client component, because every record on it is
 * counted from a store the browser holds. The boundary here is what lets the
 * header and the page title be prerendered anyway.
 */
interface Params {
  params: Promise<{ locale: string; tag: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, tag } = await params;
  const t = await getTranslations({
    locale: resolveLocale(locale),
    namespace: "assetDetail",
  });
  return { title: t("metaTitle", { tag: tag.toUpperCase() }) };
}

export default async function AssetDetailPage({ params }: Params) {
  const { tag } = await params;
  const t = await getTranslations("assetDetail");
  // Read on the server so the first paint already knows whether this role may
  // change anything, rather than deciding after hydration.
  const role = await getDemoRole();

  return (
    /*
     * Titled with the record rather than with the module. `ModuleScreen` moves
     * the module's own name up into the eyebrow when given a title, so a reader
     * still knows where they are and the page stops carrying two headings. The
     * tag is what a server can know — the asset's name lives in the store the
     * browser holds — and the tag is the identifier people say out loud anyway.
     */
    <ModuleScreen
      moduleKey="assets"
      title={tag.trim().toUpperCase()}
      description={t("pageDescription")}
    >
      <Suspense fallback={<LoadingState rows={6} />}>
        <AssetDetailScreen tag={tag.trim().toUpperCase()} role={role} />
      </Suspense>
    </ModuleScreen>
  );
}
