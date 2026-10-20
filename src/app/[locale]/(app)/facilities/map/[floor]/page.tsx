import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { FloorMapScreen } from "@/components/facilities/floor-map-screen";
import { ModuleScreen } from "@/components/shared/module-screen";
import { LoadingState } from "@/components/shared/state-panels";
import { resolveLocale } from "@/i18n/routing";
import { getDemoRole } from "@/lib/server-session";

/**
 * One floor, drawn.
 *
 * **`/facilities/map/[floor]`, not `/facilities/[floor]`.** Next allows one
 * slug name at a given path position, so the first route merged directly under
 * `/facilities` would fix that name for every route added beside it later — and
 * a floor is not the only thing anyone will want to address there. The literal
 * `map` keeps the position free, and `[floor]` says what the segment holds: a
 * floor code such as `MCT-B01-F1`, the identifier written on the plan, never an
 * `Id`.
 *
 * The screen is a client component because every record on it is counted from a
 * store the browser holds. The boundary here is what lets the shell, the
 * heading and the page title be prerendered anyway.
 */
interface Params {
  params: Promise<{ locale: string; floor: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, floor } = await params;
  const t = await getTranslations({
    locale: resolveLocale(locale),
    namespace: "floorMap",
  });
  return { title: t("metaTitle", { floor: floor.toUpperCase() }) };
}

export default async function FloorMapPage({ params }: Params) {
  const { floor } = await params;
  const t = await getTranslations("floorMap");
  const code = floor.trim().toUpperCase();
  // Read on the server so the first paint already knows whether this role may
  // raise work, rather than deciding after hydration.
  const role = await getDemoRole();

  return (
    <ModuleScreen
      moduleKey="facilities"
      title={code}
      description={t("pageDescription")}
    >
      <Suspense fallback={<LoadingState rows={6} />}>
        <FloorMapScreen floorCode={code} role={role} />
      </Suspense>
    </ModuleScreen>
  );
}
