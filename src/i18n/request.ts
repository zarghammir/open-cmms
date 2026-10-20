import { hasLocale, type Messages } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import * as rootParams from "next/root-params";
import { formats } from "./formats";
import { defaultLocale, locales, timeZone, type AppLocale } from "./routing";

/**
 * Message catalogues, listed explicitly so a missing or renamed file is a build
 * error rather than a blank screen.
 */
const catalogs: Record<AppLocale, () => Promise<{ default: Messages }>> = {
  "en-CA": () => import("../../messages/en.json"),
  "fr-CA": () => import("../../messages/fr.json"),
};

/**
 * Per-request i18n configuration. The locale comes from the `[locale]` root
 * param, except when a server function is called with an explicit locale.
 */
export default getRequestConfig(async ({ locale }) => {
  let resolved: AppLocale = defaultLocale;

  if (hasLocale(locales, locale)) {
    resolved = locale;
  } else {
    const fromSegment: string | undefined = await rootParams.locale();
    if (hasLocale(locales, fromSegment)) {
      resolved = fromSegment;
    }
  }

  return {
    locale: resolved,
    messages: (await catalogs[resolved]()).default,
    timeZone,
    formats,
  };
});
