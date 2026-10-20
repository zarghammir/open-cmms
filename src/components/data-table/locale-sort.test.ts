import { describe, expect, it } from "vitest";
import { createLocaleCompare } from "./locale-sort";

/**
 * "cote", "côte", "coté", "côté" is the textbook pair of orders: French
 * compares accents from the end of the word, English from the front, so the
 * middle two swap. It is the only kind of example that can tell a
 * locale-aware comparator from one that merely handles accents at all.
 */
const ACCENTED = ["coté", "côte"];

function sortedWith(locale: string, words: string[]) {
  return [...words].sort(createLocaleCompare(locale));
}

describe("ordering in the reader's language", () => {
  it("orders the accented pair the way French does", () => {
    expect(sortedWith("fr-CA", ACCENTED)).toEqual(["côte", "coté"]);
  });

  it("orders the same pair the way English does", () => {
    expect(sortedWith("en-CA", ACCENTED)).toEqual(["coté", "côte"]);
  });

  it("the two languages genuinely disagree about this pair", () => {
    // The guard that makes the two assertions above worth making. If Node were
    // built without the collation data, both would fall back to the same order
    // and both would still pass while proving nothing.
    expect(sortedWith("fr-CA", ACCENTED)).not.toEqual(
      sortedWith("en-CA", ACCENTED),
    );
  });

  it("puts an accented word where French puts it, not where code points do", () => {
    // The defect as the review described it: é is U+00E9 and o is U+006F, so a
    // comparator that comes down to `<` puts Réfrigérateur last. French puts
    // it first.
    const pair = ["Refroidisseur centrifuge", "Réfrigérateur de laboratoire"];

    expect(sortedWith("fr-CA", pair)).toEqual([
      "Réfrigérateur de laboratoire",
      "Refroidisseur centrifuge",
    ]);

    // The deletion control: this is what the table did before, and what it
    // would do again if the collator were removed.
    expect([...pair].sort()).toEqual([
      "Refroidisseur centrifuge",
      "Réfrigérateur de laboratoire",
    ]);
    expect(sortedWith("fr-CA", pair)).not.toEqual([...pair].sort());
  });

  it("counts numbers in a tag rather than spelling them", () => {
    expect(sortedWith("en-CA", ["AHU-KGN-11", "AHU-KGN-2"])).toEqual([
      "AHU-KGN-2",
      "AHU-KGN-11",
    ]);
  });

  it("sorts absent values last, not as an empty string", () => {
    const compare = createLocaleCompare("en-CA");

    expect(compare(null, "anything")).toBeGreaterThan(0);
    expect(compare("anything", null)).toBeLessThan(0);
    expect(compare(undefined, "anything")).toBeGreaterThan(0);
    expect(compare(null, null)).toBe(0);
  });

  it("compares numbers as numbers", () => {
    const compare = createLocaleCompare("en-CA");
    expect(compare(2, 11)).toBeLessThan(0);
  });
});
