import { isStructurallySame, parse } from "@formatjs/icu-messageformat-parser";
import { describe, expect, it } from "vitest";
import {
  compareIcuShapes,
  describeIcuShape,
  formatIcuShapeDifference,
  icuShapesAgree,
} from "./icu-shape";

/**
 * Each case is a pair the catalogue parity test must reject, written the way a
 * translator would actually break it. `branch` is the word the failure has to
 * name, because naming the key alone leaves someone reading three branches to
 * find the one that changed.
 */
const brokenPairs = [
  {
    name: "a nested placeholder dropped from one branch",
    english: "{count, plural, one {# day for {who}} other {# days for {who}}}",
    french: "{count, plural, one {# jour pour {who}} other {# jours}}",
    branch: '"other"',
  },
  {
    name: "a nested placeholder dropped from the singular branch",
    english: "{count, plural, one {# day for {who}} other {# days for {who}}}",
    french: "{count, plural, one {# jour} other {# jours pour {who}}}",
    branch: '"one"',
  },
  {
    name: "# removed from one branch",
    english: "{count, plural, one {# day} other {# days}}",
    french: "{count, plural, one {un jour} other {# jours}}",
    branch: '"one"',
  },
  {
    name: "# moved between branches, keeping the same total",
    english: "{count, plural, one {# day} other {days}}",
    french: "{count, plural, one {jour} other {# jours}}",
    branch: '"one"',
  },
  {
    name: "a whole branch missing",
    english: "{count, plural, =0 {none} one {# day} other {# days}}",
    french: "{count, plural, one {# jour} other {# jours}}",
    branch: '"=0"',
  },
  {
    name: "a select branch renamed",
    english:
      "{language, select, en {In English} fr {In French} other {As written}}",
    french:
      "{language, select, en {En anglais} es {En espagnol} other {Tel quel}}",
    branch: '"fr"',
  },
  {
    name: "a nested placeholder swapped for a different name",
    english: "{count, plural, one {# day for {who}} other {# days for {who}}}",
    french:
      "{count, plural, one {# jour pour {qui}} other {# jours pour {who}}}",
    branch: '"one"',
  },
  {
    name: "a top-level argument dropped",
    english: "{date} — in {days, plural, one {# day} other {# days}}",
    french: "dans {days, plural, one {# jour} other {# jours}}",
    branch: "{date}",
  },
] as const;

/**
 * Pairs that differ in every way a translation is *supposed* to differ. If the
 * comparison rejected one of these it would be unusable: a French translation
 * that reads naturally would have to be reverted to pass.
 */
const goodPairs = [
  {
    name: "different words, same structure",
    english: "{count, plural, one {# day late} other {# days late}}",
    french: "{count, plural, one {# jour de retard} other {# jours de retard}}",
  },
  {
    name: "branches that legitimately do not all carry #",
    english:
      "{count, plural, one {One visit could not be read.} other {# visits could not be read.}}",
    french:
      "{count, plural, one {Une visite n’a pas pu être lue.} other {# visites n’ont pas pu être lues.}}",
  },
  {
    name: "a placeholder moved to the other end of the sentence",
    english: "Due in {days} at {site}",
    french: "À {site}, dû dans {days}",
  },
  {
    name: "a nested placeholder kept in both branches",
    english: "{count, plural, one {# day for {who}} other {# days for {who}}}",
    french:
      "{count, plural, one {# jour pour {who}} other {# jours pour {who}}}",
  },
] as const;

describe("ICU shape", () => {
  it("accepts a translation that changes every word and no structure", () => {
    for (const pair of goodPairs) {
      const difference = compareIcuShapes(pair.english, pair.french);
      expect(
        icuShapesAgree(difference),
        `${pair.name}: ${JSON.stringify(difference)}`,
      ).toBe(true);
    }
  });

  it("rejects every way a plural or select can lose part of itself", () => {
    for (const pair of brokenPairs) {
      const difference = compareIcuShapes(pair.english, pair.french);
      expect(icuShapesAgree(difference), pair.name).toBe(false);
    }
  });

  it("names the branch that changed, not only the key", () => {
    for (const pair of brokenPairs) {
      const difference = compareIcuShapes(pair.english, pair.french);
      const report = formatIcuShapeDifference("someKey", difference);

      expect(report, pair.name).toContain("someKey");
      expect(report, `${pair.name} should name ${pair.branch}`).toContain(
        pair.branch,
      );
    }
  });

  it("treats a message ICU cannot parse as unknown rather than empty", () => {
    // Two unparseable messages must not compare equal to each other. Returning
    // an empty set of facts would make them do exactly that.
    expect(() => describeIcuShape("{count, plural, one {# day}")).toThrow();
  });

  it("distinguishes a cardinal plural from an ordinal one", () => {
    const difference = compareIcuShapes(
      "{n, plural, one {#st} other {#th}}",
      "{n, selectordinal, one {#er} other {#e}}",
    );

    expect(icuShapesAgree(difference)).toBe(false);
  });

  /**
   * The measurement behind the comment in `icu-shape.ts`. `isStructurallySame`
   * ships in the same package and is the obvious thing to reach for; it returns
   * success for every pair above. If a future version of the package closes the
   * gap, this test fails and the comment stops being true — which is the point
   * of measuring it rather than asserting it in prose.
   */
  it("measures what the library's own isStructurallySame misses", () => {
    const passedByTheLibrary = brokenPairs.filter(
      (pair) =>
        isStructurallySame(parse(pair.english), parse(pair.french)).success,
    );

    expect(passedByTheLibrary.map((pair) => pair.name)).toEqual([
      "a nested placeholder dropped from one branch",
      "a nested placeholder dropped from the singular branch",
      "# removed from one branch",
      "# moved between branches, keeping the same total",
      "a whole branch missing",
      "a select branch renamed",
    ]);

    // The two it does catch are the two where the *set of names* changed, which
    // is the only thing it looks at: a name swapped for another name, and an
    // argument dropped from the message altogether.
    expect(
      brokenPairs
        .filter((pair) => !passedByTheLibrary.includes(pair))
        .map((pair) => pair.name),
    ).toEqual([
      "a nested placeholder swapped for a different name",
      "a top-level argument dropped",
    ]);

    // And every one of those is caught here.
    for (const pair of passedByTheLibrary) {
      expect(
        icuShapesAgree(compareIcuShapes(pair.english, pair.french)),
        pair.name,
      ).toBe(false);
    }
  });
});
