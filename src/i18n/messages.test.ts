import { describe, expect, it } from "vitest";
import { britishSpelling, BRITISH_SPELLINGS } from "./spelling";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import {
  compareIcuShapes,
  describeIcuShape,
  formatIcuShapeDifference,
  icuShapesAgree,
} from "./icu-shape";

type Catalog = Record<string, unknown>;

function flatten(value: Catalog, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};

  for (const [key, entry] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (entry !== null && typeof entry === "object") {
      Object.assign(out, flatten(entry as Catalog, path));
    } else {
      out[path] = String(entry);
    }
  }

  return out;
}

const english = flatten(en as Catalog);
const french = flatten(fr as Catalog);

describe("message catalogues", () => {
  it("translates every English key into French", () => {
    expect(Object.keys(french).sort()).toEqual(Object.keys(english).sort());
  });

  it("has no empty message in either language", () => {
    for (const [key, value] of Object.entries(english)) {
      expect(value.trim(), `en ${key}`).not.toBe("");
    }
    for (const [key, value] of Object.entries(french)) {
      expect(value.trim(), `fr ${key}`).not.toBe("");
    }
  });

  it("parses every message in both catalogues as ICU", () => {
    const unparseable: string[] = [];

    for (const [key, value] of Object.entries(english)) {
      try {
        describeIcuShape(value);
      } catch (error) {
        unparseable.push(`en ${key}: ${(error as Error).message}`);
      }
    }
    for (const [key, value] of Object.entries(french)) {
      try {
        describeIcuShape(value);
      } catch (error) {
        unparseable.push(`fr ${key}: ${(error as Error).message}`);
      }
    }

    expect(unparseable).toEqual([]);
  });

  it("keeps the same ICU structure in both languages, branch by branch", () => {
    // Compared against the parsed message, not a scan of the text: the defect
    // this exists to catch is a French plural that drops a placeholder from one
    // branch or moves its `#` to another, and both leave the message's
    // top-level arguments untouched. See `icu-shape.ts`.
    const failures: string[] = [];
    let compared = 0;

    for (const [key, value] of Object.entries(english)) {
      const translation = french[key];

      // A missing key is the previous test's failure, not this one's, but it
      // must not quietly reduce what this test measured either.
      if (translation === undefined) continue;

      compared += 1;

      const difference = compareIcuShapes(value, translation);
      if (!icuShapesAgree(difference)) {
        failures.push(formatIcuShapeDifference(key, difference));
      }
    }

    expect(failures.join("\n")).toBe("");

    // The floor. Without it, a `flatten` that returned nothing, a catalogue
    // that failed to import, or a filter that skipped every key would leave
    // this test passing while comparing nothing at all.
    expect(compared, "messages compared").toBe(Object.keys(english).length);
    expect(compared, "messages compared").toBeGreaterThan(500);
  });

  it("actually translates the sentences, not just the headings", () => {
    // Single words legitimately match across languages ("Documents", "Actions"),
    // but a full sentence that is identical means it was never translated.
    const sentenceKeys = Object.keys(english).filter(
      (key) =>
        key.startsWith("modules.") &&
        /\.(emptyBody|point1|point2|point3|description)$/.test(key),
    );

    expect(sentenceKeys.length).toBeGreaterThan(50);

    for (const key of sentenceKeys) {
      expect(french[key], `untranslated: ${key}`).not.toBe(english[key]);
    }
  });

  it("follows Canadian French punctuation spacing", () => {
    // Canadian usage attaches ";", "?" and "!" to the preceding word, unlike
    // French usage, and keeps a non-breaking space before ":" so a line never
    // breaks in front of it.
    for (const [key, value] of Object.entries(french)) {
      expect(value, `space before punctuation in fr ${key}`).not.toMatch(
        /[ \u00a0\u202f][;?!]/,
      );
      expect(value, `breaking space before colon in fr ${key}`).not.toMatch(
        / :/,
      );
    }
  });

  it("uses French typographic apostrophes rather than straight ones", () => {
    for (const [key, value] of Object.entries(french)) {
      expect(value, `straight apostrophe in fr ${key}`).not.toMatch(/\w'\w/);
    }
  });

  /*
   * Canadian English, which is not British English minus the `-ise` endings.
   *
   * The French half of these catalogues has had a punctuation check since it
   * was written and the English half has had nothing, so the English drifted
   * British while the French stayed Canadian: five values said "organisation",
   * "Synchronisation", "recognise" — on an application whose Settings screen is
   * headed *Organization*. The bid is to a Government of Canada department and
   * the whole pitch is that the product is properly bilingual. An evaluator who
   * finds British spelling in the English half has been handed a reason to
   * doubt the French half too.
   *
   * **A list of whole words, not a pattern over word endings, and that is a
   * measurement rather than a preference.** The obvious implementation is
   * `/\B(is|IS)(e|ed|es|ing|ation)\b/`. Run against this catalogue it fires on
   * **24** values, of which **5** are real and **19** are inflections of
   * "raise" — `\B` matches inside a word, so "raised" and "raises" end in
   * something that looks like `-ise`. A check that cries wolf nineteen times
   * out of twenty-four is a check the next person silences.
   *
   * **What is deliberately not on the list.** Canadian English keeps `centre`,
   * `licence`, `defence`, `catalogue`, `dialogue` and the `-our` family:
   * `colour`, `labour`, `behaviour`. Those are correct here. The `-ise` family
   * is the one place Canadian and British usage actually part company, and it
   * is the only thing this looks for. The American forms — center, license,
   * defense, catalog, color — are also left alone: catching those would be a
   * different check, and nothing in either catalogue needs one.
   */
  /*
   * The list and the detector moved to `./spelling` in WA-87, so the seed's
   * English text is swept by the same words rather than by a second copy that
   * would drift. What is checked here has not changed.
   */

  it("spells the English catalogue the Canadian way", () => {
    let scanned = 0;
    const found: string[] = [];

    for (const [key, value] of Object.entries(english)) {
      scanned += 1;
      const match = britishSpelling.exec(value);
      if (match) found.push(`${key}: ${match[0]}`);
    }

    expect(found.join("\n"), "British spelling in the English catalogue").toBe(
      "",
    );

    // The floor. A `flatten` that returned nothing, a catalogue that failed to
    // import, or a filter that skipped every key would leave this passing while
    // reading nothing at all.
    expect(scanned, "values scanned").toBe(Object.keys(english).length);
    expect(scanned, "values scanned").toBeGreaterThan(500);
  });

  it("stays silent on the spellings Canadian English keeps", () => {
    /*
     * The half that matters more than the half above.
     *
     * A spelling check that fires on correct Canadian English is worse than no
     * spelling check, because the next person to meet it silences it rather
     * than reading it. These eight are right, and the eight American forms
     * beside them are not this check's business.
     */
    const canadian = [
      "the centre of the site",
      "a valid licence",
      "defence in depth",
      "the parts catalogue",
      "the colour of the chip",
      "labour hours",
      "raised by Priya",
      "it raises an alarm",
    ];
    const american = [
      "the center of the site",
      "a valid license",
      "defense in depth",
      "the parts catalog",
      "a modal dialog",
      "the color of the chip",
      "labor hours",
      "expected behavior",
    ];

    for (const phrase of [...canadian, ...american]) {
      expect(britishSpelling.test(phrase), `fired on "${phrase}"`).toBe(false);
    }

    // The floor for a test made only of negatives: sixteen phrases were really
    // examined. Without it an empty list would agree with every assertion.
    expect(canadian.length + american.length, "phrases checked").toBe(16);
  });

  it("fires on the British forms it is there to catch", () => {
    // The positive beside the negatives. Without this the test above passes
    // against a detector that matches nothing at all — a regex built from an
    // empty list, a typo in the word boundaries.
    const british = [
      "the organisation",
      "Synchronisation",
      "we recognise",
      "Sanitise the loop",
      "Deionisation cartridge",
      "aluminium mesh",
    ];

    for (const phrase of british) {
      expect(britishSpelling.test(phrase), `missed "${phrase}"`).toBe(true);
    }

    expect(british.length, "phrases checked").toBe(6);
  });
});
