import { describe, expect, it } from "vitest";
import { buildSeed } from "@/data/seed";
import { britishSpelling, BRITISH_SPELLINGS } from "@/i18n/spelling";

/**
 * The seed's English reads as Canadian English.
 *
 * WA-86 swept the catalogues and stopped there, so the words a reader meets on
 * screen were correct while the records underneath them said `aluminium`,
 * `Deionisation`, `Sanitise` and `sanitisation`. An evaluator does not know
 * which strings came from a catalogue and which from a fixture; they see one
 * product that cannot spell consistently.
 *
 * **French is skipped, not swept.** `aluminium` and `organisation` are correct
 * French, so a sweep that read both halves would demand the French half be
 * wrong. Anything reached through an `fr` key is left alone, which is why this
 * walks the tree rather than searching the files.
 */

const TODAY = new Date("2026-09-12T00:00:00.000Z");

/** Every English string in the records, with the path that reaches it. */
function englishStrings(
  value: unknown,
  path = "",
  into: { path: string; text: string }[] = [],
): { path: string; text: string }[] {
  if (typeof value === "string") {
    into.push({ path, text: value });
    return into;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      englishStrings(item, `${path}[${index}]`, into),
    );
    return into;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      // The one branch not read: French is allowed to be French.
      if (key === "fr") continue;
      englishStrings(child, path ? `${path}.${key}` : key, into);
    }
  }
  return into;
}

describe("the seed's English", () => {
  const strings = englishStrings(buildSeed(TODAY));

  it("reads enough text to be checking anything", () => {
    /*
     * The floor. A walk that returned nothing — a changed shape, a guard that
     * skipped every branch — would report no British spellings and pass, which
     * is the same green as a seed that spells everything correctly.
     */
    expect(strings.length).toBeGreaterThan(2000);
    expect(BRITISH_SPELLINGS.length).toBeGreaterThan(20);
  });

  it("spells every English string the Canadian way", () => {
    const found = strings
      .map(({ path, text }) => ({ path, match: britishSpelling.exec(text) }))
      .filter(({ match }) => match !== null)
      .map(({ path, match }) => `${path}: ${match![0]}`);

    expect(found, "British spelling in the seed").toEqual([]);
  });

  it("would notice one, and does not mistake French for it", () => {
    /*
     * Two controls in one, because the walk has two ways to be wrong. The
     * detector must fire on a British spelling planted in English text — or the
     * assertion above passes on everything — and it must not fire on the French
     * that is correctly there, which is what the `fr` skip is for.
     */
    expect(britishSpelling.test("Washable aluminium mesh prefilter")).toBe(
      true,
    );
    expect(britishSpelling.test("Washable aluminum mesh prefilter")).toBe(
      false,
    );

    const french = englishStrings({
      name: { en: "Aluminum", fr: "Aluminium" },
    });
    expect(french.map((one) => one.text)).toEqual(["Aluminum"]);
  });
});
