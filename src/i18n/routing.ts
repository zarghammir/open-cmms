import { defineRouting } from "next-intl/routing";
import { hasLocale } from "next-intl";

/**
 * The application is bilingual by mandate: English and French, user selectable,
 * on every screen.
 *
 * The locales are the Canadian regional tags, because dates, numbers and
 * currency have to read as en-CA and fr-CA, not as en-US. The URL keeps the
 * short prefix (`/en`, `/fr`) so an address stays readable in a screenshot.
 */
export const locales = ["en-CA", "fr-CA"] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "en-CA";

/** Short prefix shown in the URL for each locale. */
export const localePrefixes: Record<AppLocale, string> = {
  "en-CA": "/en",
  "fr-CA": "/fr",
};

/**
 * All rendering uses one fixed time zone so that a date never differs between
 * the server and the browser, and so demo data reads the same for every
 * reviewer regardless of where they open it.
 */
export const timeZone = "America/Toronto";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: {
    mode: "always",
    prefixes: localePrefixes,
  },
  // The locale cookie is how a chosen language survives a reload and a visit to
  // the bare "/" path.
  localeCookie: {
    maxAge: 60 * 60 * 24 * 365,
  },
});

/** Narrows an untrusted route parameter to a supported locale. */
export function resolveLocale(value: string | undefined): AppLocale {
  return hasLocale(locales, value) ? value : defaultLocale;
}
