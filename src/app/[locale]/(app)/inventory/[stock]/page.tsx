import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PartDetailScreen } from "@/components/inventory/part-detail-screen";
import { ModuleScreen } from "@/components/shared/module-screen";
import { resolveLocale } from "@/i18n/routing";

/**
 * One part, addressed by stock number.
 *
 * `[stock]` was named by the label route that already sits under it, and Next
 * allows one slug name per path position — so this page inherits it, which is
 * the outcome that naming wanted. Never by `Id`: `buildSeed` rebuilds every
 * record when the demonstration is reset, and a label printed on Tuesday has to
 * still open its part on Thursday.
 */
interface Params {
  params: Promise<{ locale: string; stock: string }>;
}

function readNumber(raw: string): string {
  // The same normalising the repository does, so the heading and the lookup
  // cannot disagree about which part this is.
  return decodeURIComponent(raw).trim().toUpperCase();
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, stock } = await params;
  const t = await getTranslations({
    locale: resolveLocale(locale),
    namespace: "partDetail",
  });
  return { title: t("metaTitle", { number: readNumber(stock) }) };
}

export default async function PartDetailPage({ params }: Params) {
  const { stock } = await params;
  const t = await getTranslations("partDetail");
  const wanted = readNumber(stock);

  return (
    <ModuleScreen
      moduleKey="inventory"
      title={wanted}
      description={t("pageDescription")}
    >
      <PartDetailScreen partNumber={wanted} />
    </ModuleScreen>
  );
}
