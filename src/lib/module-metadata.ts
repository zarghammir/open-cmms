import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import type { ModuleKey } from "@/domain/constants/navigation";
import { resolveLocale } from "@/i18n/routing";

export interface LocaleParams {
  params: Promise<{ locale: string }>;
}

/**
 * Page titles come from the same message keys as the screens, so a tab title
 * can never be in the wrong language or disagree with the heading.
 */
export async function moduleMetadata(
  key: ModuleKey,
  params: LocaleParams["params"],
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: resolveLocale(locale),
    namespace: "modules",
  });

  return {
    title: t(`${key}.title`),
    description: t(`${key}.description`),
  };
}
