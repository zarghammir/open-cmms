import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { withoutComments } from "./status-gate.test";

/**
 * "Below its minimum" is compared in exactly one place.
 *
 * WA-69 replaced four private copies of `quantityOnHand < reorderPoint` with
 * one function, `isBelowMinimum` in `src/domain/constants/part.ts`. Its
 * consumer tests plant a part exactly on its minimum and compare each
 * consumer's answer against a stated expectation, so they catch a private copy
 * that **disagrees** with the rule.
 *
 * They cannot catch one that agrees. Revert the seed's call, or add a fifth
 * copy in a screen written next month, and every one of those tests stays
 * green — because the copy gives the same answers. The four copies WA-69
 * removed agreed too; that was the whole problem. They agreed by coincidence,
 * all four having happened to use a strict `<`, and a coincidence is not a
 * design: the first person to decide that a part *on* its minimum counts as
 * low would have changed one of them.
 *
 * So the state WA-69 removed is invisible to behaviour, and something has to
 * read the source instead — the same argument `status-gate.test.ts` makes for
 * a union member, and `data-boundary.test.ts` for an import.
 *
 * What this cannot see: a comparison against a number copied out of a part
 * (`const min = part.reorderPoint` on one line, `qty < min` on the next), or
 * one built through a variable named something else. It reads text, not types.
 * That is a real limit and the reason this is a second mechanism rather than
 * the only one — the consumer tests still catch any copy that disagrees, and
 * between them the gap is a copy that both agrees and hides its operand.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");
const SCANNED = "src";

/**
 * The file that defines the rule is the one place allowed to compare against
 * `reorderPoint`: it is where "below" is decided, and a predicate that could
 * not compare could not answer.
 */
const ALLOWED = new Set(["src/domain/constants/part.ts"]);

/**
 * Tests are instruments, not definitions, and this one is deliberate.
 *
 * The first run of this detector reported `src/data/repositories/part.test.ts`
 * at four lines — and reading them, every one is correct as written. They pick
 * a fixture (`quantityOnHand >= reorderPoint`: a part that is *not* low, so
 * the test can push it under) rather than decide product behaviour.
 *
 * More than that, they **must not** ask `isBelowMinimum`. A test that computes
 * its expectation from the predicate it is testing moves both sides of its own
 * assertion when the predicate changes, and passes whichever rule the code
 * holds — the vacuity WA-69's own consumer tests were built to avoid by
 * planting parts exactly on the minimum and stating the answers. Pointing this
 * detector at a test file would push the suite towards exactly that.
 *
 * So the scan is production code. A private copy hidden in a test cannot make
 * a screen disagree with another screen, which is the whole defect.
 */
const IS_TEST = /\.test\.tsx?$/;

/**
 * A comparison operator immediately beside `reorderPoint`, in either order.
 *
 * Deliberately not "a line that mentions `reorderPoint` and holds a comparison
 * operator". Every screen that *displays* a minimum does both — JSX is full of
 * `<` and `>` — so that rule would fire on `<span>{part.reorderPoint}</span>`
 * and be deleted within a week for crying wolf, which is the failure mode that
 * leaves nothing watching. Requiring the operator to sit against the operand,
 * with nothing but whitespace between, separates the two: a tag's `>` is
 * always followed by `{` or text, never directly by the identifier.
 *
 * Reading a minimum is allowed. Deciding with it is not.
 */
const COMPARISON =
  /(?:[\w.]+\s*(?:<=?|>=?)\s*(?:[\w.]*\.)?reorderPoint\b|\breorderPoint\s*(?:<=?|>=?)\s*[\w.]+)/;

export function minimumComparisons(source: string): number[] {
  return withoutComments(source)
    .split("\n")
    .flatMap((line, index) => (COMPARISON.test(line) ? [index + 1] : []));
}

function sourceFilesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) return sourceFilesUnder(full);
    return /\.tsx?$/.test(full) ? [full] : [];
  });
}

const files = sourceFilesUnder(path.join(ROOT, SCANNED))
  .map((file) => path.relative(ROOT, file))
  .filter((file) => !IS_TEST.test(file));

describe("the minimum is compared in one place", () => {
  it("has files to read", () => {
    // A sweep of nothing agrees with itself perfectly.
    expect(files.length).toBeGreaterThan(100);
  });

  /**
   * The floor that matters, and the one the file-count cannot give.
   *
   * A regular expression that matches nothing would pass every assertion
   * below, for ever, while the rule it guards was copied into a dozen files.
   * So the detector is required to find the definition itself: if this goes
   * red, the pattern has stopped seeing the shape and nothing under it means
   * anything.
   */
  it("finds the one comparison that is allowed to exist", () => {
    const definition = [...ALLOWED][0]!;
    expect(
      minimumComparisons(readFileSync(path.join(ROOT, definition), "utf8")),
      `${definition} no longer contains a comparison this detector can see, ` +
        "so every other assertion in this file is now vacuous.",
    ).not.toEqual([]);
  });

  it.each(files.filter((file) => !ALLOWED.has(file)))("%s", (file) => {
    const lines = minimumComparisons(
      readFileSync(path.join(ROOT, file), "utf8"),
    );

    expect(
      lines,
      `${file} decides whether a part is below its minimum itself, at line ${lines.join(", ")}. ` +
        "That is a second definition of the rule, and WA-69 removed four of them — they agreed only " +
        "because all four happened to use a strict `<`. Ask isBelowMinimum(part) from " +
        "@/domain/constants/part instead, or parts.belowMinimum() if a repository is in reach.",
    ).toEqual([]);
  });
});

/**
 * The detector itself, against text rather than the repository.
 *
 * Without this the suite above goes green when the pattern breaks — the
 * failure mode of every check that asserts an absence.
 */
describe("the detector", () => {
  it("finds the shape it exists for, in each of its spellings", () => {
    expect(
      minimumComparisons(
        "const low = part.quantityOnHand < part.reorderPoint;",
      ),
    ).toEqual([1]);
    expect(minimumComparisons("return quantity < part.reorderPoint;")).toEqual([
      1,
    ]);
    expect(minimumComparisons("if (onHand <= reorderPoint) flag();")).toEqual([
      1,
    ]);
    // The operands the other way round.
    expect(
      minimumComparisons(
        "if (part.reorderPoint > part.quantityOnHand) flag();",
      ),
    ).toEqual([1]);
    // Inside a callback, which is how three of WA-69's four copies were written.
    expect(
      minimumComparisons(
        "parts.filter((p) => p.quantityOnHand < p.reorderPoint);",
      ),
    ).toEqual([1]);
    // No spaces at all.
    expect(
      minimumComparisons("const low=part.quantityOnHand<part.reorderPoint;"),
    ).toEqual([1]);
  });

  it("leaves alone the ways a minimum is legitimately read", () => {
    // Displaying it. This is the false positive that would have got the
    // detector deleted: the JSX around it is full of angle brackets.
    expect(
      minimumComparisons(
        '<span className="tabular-nums">{format.number(part.reorderPoint, "integer")}</span>',
      ),
    ).toEqual([]);
    expect(minimumComparisons("<td>{part.reorderPoint}</td>")).toEqual([]);
    // Passing it as a translation argument, which every low-stock message does.
    expect(minimumComparisons("minimum: part.reorderPoint,")).toEqual([]);
    // Declaring it.
    expect(minimumComparisons("  reorderPoint: number;")).toEqual([]);
    // Asking the predicate, which is the whole point.
    expect(minimumComparisons("const low = isBelowMinimum(part);")).toEqual([]);
  });

  it("names the line the breach is actually on", () => {
    const source = [
      "/**",
      " * a docblock",
      " * three lines long",
      " */",
      "const low = part.quantityOnHand < part.reorderPoint;",
    ].join("\n");
    expect(minimumComparisons(source)).toEqual([5]);
  });

  /**
   * The trap this detector walks into on its first run, if it is careless.
   *
   * Three comments on `main` quote the comparison to explain why the file does
   * not perform it — `parts-screen.tsx`, `use-part.ts` and `part-detail.ts`,
   * all three written by the lanes that deliberately did not add a fifth copy.
   * A detector that read them as breaches would fail on the documentation of
   * its own rule, and would be deleted rather than fixed.
   */
  it("does not read a comment as a breach, and does not hide behind one", () => {
    expect(
      minimumComparisons("// once this was quantityOnHand < reorderPoint"),
    ).toEqual([]);
    expect(
      minimumComparisons(
        "/*\n * `quantityOnHand < reorderPoint` is written out three times\n */",
      ),
    ).toEqual([]);
    expect(
      minimumComparisons(
        'const u = "https://x"; const low = qty < part.reorderPoint;',
      ),
    ).toEqual([1]);
  });
});
