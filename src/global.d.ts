import type { formats } from "@/i18n/formats";
import type { locales } from "@/i18n/routing";
import type messages from "../messages/en.json";

/**
 * Makes message keys and format names type safe: a missing or misspelled key
 * is a compile error, not a runtime fallback string. `messages/en.json` is the
 * source of truth for the shape; `messages/fr.json` is checked against it by a
 * unit test.
 */
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof locales)[number];
    Messages: typeof messages;
    Formats: typeof formats;
  }
}
