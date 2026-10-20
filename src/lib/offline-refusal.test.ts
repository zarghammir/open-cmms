import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { localePrefixes } from "@/i18n/routing";
import {
  offlineRefusalPage,
  offlineRefusalPages,
  refusalKey,
} from "./offline-refusal";

/**
 * The page a person reads when the screen they asked for is not on this device.
 *
 * What is asserted is that it says something, in the language of the address,
 * and that it can say it with nothing else available: no stylesheet, no script,
 * no image. The blank white page this replaces was a document that rendered
 * perfectly and said nothing at all, which is why "it rendered" is not the
 * claim being made here.
 */

describe("the offline refusal page", () => {
  it("speaks the language of the address", () => {
    const english = offlineRefusalPage("en-CA");
    const french = offlineRefusalPage("fr-CA");

    expect(english).toContain(en.offlineRefusal.title);
    expect(english).toContain(en.offlineRefusal.body);
    expect(english).toContain(en.offlineRefusal.stillWorks);
    expect(english).toContain(en.offlineRefusal.back);
    expect(english).toContain('lang="en-CA"');

    expect(french).toContain(fr.offlineRefusal.title);
    expect(french).toContain(fr.offlineRefusal.body);
    expect(french).toContain(fr.offlineRefusal.stillWorks);
    expect(french).toContain(fr.offlineRefusal.back);
    expect(french).toContain('lang="fr-CA"');

    // The two are actually different documents. Without this, a builder that
    // ignored its argument and returned English twice would satisfy every
    // English assertion above and half the French ones.
    expect(french).not.toBe(english);
    expect(french).not.toContain(en.offlineRefusal.title);
  });

  it("carries no request it would have to make to be readable", () => {
    // The document shown when the network is gone cannot depend on the network.
    // Anything fetched — a stylesheet, a font, a script, an image — is one more
    // thing that is not there, and the page would render as far as the missing
    // piece and stop.
    for (const locale of ["en-CA", "fr-CA"] as const) {
      const page = offlineRefusalPage(locale);
      expect(page).not.toMatch(/<link\b/i);
      expect(page).not.toMatch(/<script\b/i);
      expect(page).not.toMatch(/<img\b/i);
      expect(page).not.toMatch(/url\(/i);
      expect(page).not.toMatch(/@import/i);
    }
  });

  it("offers a way back that cannot itself be missing", () => {
    // Not a link: every address it could point at is an address that might not
    // be cached either. The page they came from is the one place that is
    // certainly on the device.
    const page = offlineRefusalPage("en-CA");
    expect(page).toContain("history.back()");
    expect(page).toMatch(/<button\b/);
  });

  it("leaves no key unrendered", () => {
    // A missing catalogue entry would put "offlineRefusal.back" on screen in
    // both languages rather than failing, and it would read as a defect nobody
    // could explain.
    for (const locale of ["en-CA", "fr-CA"] as const) {
      expect(offlineRefusalPage(locale)).not.toContain("offlineRefusal.");
    }
  });

  it("builds one page for every language the URLs can carry", () => {
    const pages = offlineRefusalPages();
    const prefixes = Object.values(localePrefixes);

    // Keyed by prefix, because the prefix is all the worker has: it reads the
    // address and nothing else. A language added to the routing with no page
    // here would be answered in the wrong one.
    expect(Object.keys(pages).sort()).toEqual([...prefixes].sort());
    expect(prefixes.length).toBeGreaterThan(1);
    expect(pages["/fr"]).toContain(fr.offlineRefusal.title);
    expect(pages["/en"]).toContain(en.offlineRefusal.title);
  });

  it("keys a page where nothing else can be served from", () => {
    // Not a route: if this collided with an address the application serves, a
    // real screen would be answered with the refusal page.
    expect(refusalKey("/en")).toBe("/__offline-refusal/en");
    expect(refusalKey("/fr")).toBe("/__offline-refusal/fr");
  });
});
