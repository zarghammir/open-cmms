import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { localePrefixes, type AppLocale } from "@/i18n/routing";

/**
 * What a person sees when they ask for a screen this device has never held.
 *
 * The service worker answers a navigation from the cache when the network is
 * gone. For an address nobody has opened here there is nothing to answer with,
 * and what it used to say was a 504 with an empty body — which a browser draws
 * as a blank white page. Measured at 390 in WA-43: a technician taps a link and
 * the screen goes white, with nothing to read and nothing to press. A refusal
 * only the person in the plant room can see is indistinguishable from being
 * ignored.
 *
 * So this builds a page instead. Three properties it has to have, and each one
 * rules something out:
 *
 *   It carries no JavaScript and loads nothing. This is the document shown when
 *   everything else has already failed; a stylesheet or a chunk it had to fetch
 *   would be one more thing that is not there.
 *
 *   Its words come from the catalogues, like every other word in the product. A
 *   service worker cannot import them — it is served as a file rather than
 *   bundled — so the page is built here, where they can be read, and handed to
 *   the worker to keep.
 *
 *   The way back is `history.back()` rather than a link. Every address this page
 *   could link to is an address that might not be cached either; the page they
 *   came from is the one place that is certainly there.
 */

const CATALOGUES: Record<AppLocale, typeof en> = {
  "en-CA": en,
  "fr-CA": fr as typeof en,
};

/** Where the worker keeps each language's page. Not a route: nothing serves it. */
export const REFUSAL_KEY_PREFIX = "/__offline-refusal";

/** What the page sends the worker to hand the pages over. */
export const REFUSAL_MESSAGE = "offline-refusal";

/** The key the worker stores and looks up a page under, per URL prefix. */
export function refusalKey(prefix: string): string {
  return `${REFUSAL_KEY_PREFIX}${prefix}`;
}

function escape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The page itself: one document, no requests, readable at 390.
 *
 * The colours are written out rather than taken from the design tokens for the
 * same reason the page carries no stylesheet — the tokens live in a stylesheet
 * that may not be cached. They are the same values `globals.css` holds.
 */
export function offlineRefusalPage(locale: AppLocale): string {
  const words = CATALOGUES[locale].offlineRefusal;
  const lang = locale;

  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escape(words.title)}</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        background: #f8fafc;
        color: #0f172a;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        line-height: 1.5;
      }
      main {
        max-width: 28rem;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        padding: 1.5rem;
      }
      h1 { margin: 0 0 0.75rem; font-size: 1.25rem; }
      p { margin: 0 0 0.75rem; font-size: 0.9375rem; }
      p:last-of-type { color: #475569; }
      button {
        margin-top: 0.5rem;
        min-height: 44px;
        padding: 0 1rem;
        font: inherit;
        color: #ffffff;
        background: #0f172a;
        border: 0;
        border-radius: 0.5rem;
        cursor: pointer;
      }
      button:focus-visible { outline: 2px solid #0f172a; outline-offset: 2px; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escape(words.title)}</h1>
      <p>${escape(words.body)}</p>
      <p>${escape(words.stillWorks)}</p>
      <button type="button" onclick="history.back()">${escape(words.back)}</button>
    </main>
  </body>
</html>
`;
}

/** Every language's page, keyed by the prefix its addresses carry. */
export function offlineRefusalPages(): Record<string, string> {
  const pages: Record<string, string> = {};

  for (const [locale, prefix] of Object.entries(localePrefixes)) {
    pages[prefix] = offlineRefusalPage(locale as AppLocale);
  }

  return pages;
}
