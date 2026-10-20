import { homeHrefForRole } from "@/domain/constants/navigation";
import { redirect } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/routing";
import { getDemoRole } from "@/lib/server-session";

/**
 * The bare locale root sends you to your role's home: the dashboard for desk
 * roles, today's work for field roles. The redirect goes through next-intl so
 * the locale prefix is applied exactly once.
 */
export default async function LocaleIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const role = await getDemoRole();

  redirect({ href: homeHrefForRole(role), locale: resolveLocale(locale) });
}
