import type { LocalizedText } from "@/domain/types";

/**
 * Reading the language half of a record.
 *
 * Interface chrome comes from `messages/{en,fr}.json`. Records cannot: a work
 * order's title belongs to the record. Both languages travel on the record, and
 * this is the one place that decides which of the two a screen shows — so the
 * French demo shows French data rather than English data under French labels.
 *
 * The locale is the full tag (`en-CA`, `fr-CA`), matched on its language
 * subtag so a future `fr-FR` would not silently fall back to English.
 */
export function textFor(value: LocalizedText, locale: string): string {
  return locale.split("-")[0] === "fr" ? value.fr : value.en;
}

/**
 * Which language a person writing on this page is writing in.
 *
 * The same decision as `textFor` makes when reading, kept beside it so the two
 * cannot drift: a form that recorded `contentLanguage` by one rule while the
 * screens read it by another would mislabel its own records.
 */
export function contentLanguageFor(locale: string): keyof LocalizedText {
  return locale.split("-")[0] === "fr" ? "fr" : "en";
}
