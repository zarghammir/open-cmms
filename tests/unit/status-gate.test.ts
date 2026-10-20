import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * No screen and no hook asks which state the store is in by naming one.
 *
 * `DemoStatus` had two members and every consumer that wanted "not ready"
 * wrote `status === "unknown"`. WA-58 added a third, `unreadable`, and every
 * one of those comparisons stayed valid TypeScript while silently changing
 * meaning: the new state fell through, and two screens went on offering a
 * technician a camera over a store whose read had failed — then reported an
 * unmatched code as a part the system does not hold.
 *
 * `hasRecords` is where the question is asked now, and its `never` default
 * means a *fourth* member cannot be added without failing the build. This test
 * answers the other half, which that mechanism cannot: a *new call site*,
 * written next month, comparing the status to a member itself. The compiler
 * will never object to it, so something has to read the source — the same
 * reason `data-boundary.test.ts` reads the source rather than trusting the
 * lint rule beside it.
 *
 * The positive form is deliberately legal. `status === "ready"` excludes every
 * other member, including ones that do not exist yet, so it cannot acquire a
 * fall-through. The defect only ever lived in the negative form, where one
 * member stood in for "not ready".
 *
 * What this cannot see: a `DemoStatus` held in a variable called something
 * else. It reads text, not types. That is a real limit and the reason it is
 * the second mechanism rather than the only one.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");
const SCANNED = "src";

/**
 * The file that defines the members is the one place allowed to name them: it
 * is where `unreadable` is decided, and a store that could not say the word
 * could not set the state.
 */
const ALLOWED = new Set(["src/stores/demo-store.ts"]);

/** The members that mean "not ready". `ready` is not one of them, on purpose. */
const NOT_READY = ["unknown", "unreadable"] as const;

const COMPARISON = new RegExp(
  `(?:\\bstatus\\s*[!=]==\\s*["'](?:${NOT_READY.join("|")})["']` +
    `|["'](?:${NOT_READY.join("|")})["']\\s*[!=]==\\s*\\bstatus\\b)`,
);

/**
 * Comments say the wrong thing on purpose.
 *
 * Three files explain this defect by quoting it, and a detector that could not
 * tell a warning from a breach would fail on its own documentation — so it
 * would be deleted, and then nothing would be watching. Line comments are cut
 * only at a `//` that is not part of `://`, so a breach written after a URL on
 * the same line is still visible.
 */
export function withoutComments(source: string): string {
  return (
    source
      // Blanked rather than removed: a block comment deleted outright takes its
      // newlines with it and every line number after it shifts, so the report
      // would name a line the breach is not on — which is worse than naming no
      // line at all, and was caught by the control below before it was written.
      .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
      .split("\n")
      .map((line) => {
        const at = line.search(/(?<!:)\/\//);
        return at === -1 ? line : line.slice(0, at);
      })
      .join("\n")
  );
}

export function memberComparisons(source: string): number[] {
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

describe("the store's status is never compared to one of its members", () => {
  const files = sourceFilesUnder(path.join(ROOT, SCANNED));

  it("has files to read", () => {
    // The floor, for the same reason as everywhere else: a sweep of nothing
    // agrees with itself.
    expect(files.length).toBeGreaterThan(100);
  });

  it.each(
    files
      .map((file) => path.relative(ROOT, file))
      .filter((file) => !ALLOWED.has(file)),
  )("%s", (file) => {
    const lines = memberComparisons(
      readFileSync(path.join(ROOT, file), "utf8"),
    );

    expect(
      lines,
      `${file} decides what to draw by naming one member of DemoStatus, at line ${lines.join(", ")}. ` +
        "That is the WA-68 defect: the check stays valid when the union grows and the new state falls through. " +
        "Ask hasRecords(status) from @/hooks/use-demo-data instead.",
    ).toEqual([]);
  });
});

/**
 * The detector itself, against text rather than the repository.
 *
 * Without this the suite above goes green when the pattern is broken — which
 * is the failure mode of every sweep that checks for an absence, and the one
 * this project has hit more than once.
 */
describe("the detector", () => {
  it("finds the shape it exists for, in each of its spellings", () => {
    expect(memberComparisons('if (status === "unknown") return null;')).toEqual(
      [1],
    );
    expect(memberComparisons('if (status !== "unknown") draw();')).toEqual([1]);
    expect(memberComparisons('if (status === "unreadable") wait();')).toEqual([
      1,
    ]);
    expect(
      memberComparisons('if (state.status === "unreadable") stop();'),
    ).toEqual([1]);
    expect(memberComparisons('if ("unknown" === status) return null;')).toEqual(
      [1],
    );
  });

  it("leaves alone the forms that are not the defect", () => {
    // The positive form, which excludes members that do not exist yet.
    expect(memberComparisons('const ready = status === "ready";')).toEqual([]);
    expect(
      memberComparisons('if (status !== "ready") return <Loading />;'),
    ).toEqual([]);
    // Other unions that happen to have a member spelled the same way. The scan
    // outcome, the label lookup and the import reading all do.
    expect(
      memberComparisons('if (lookup.state === "unknown") return null;'),
    ).toEqual([]);
    expect(
      memberComparisons('if (result.outcome === "unknown") toast();'),
    ).toEqual([]);
    expect(
      memberComparisons('if (reading.kind === "unreadable") flag();'),
    ).toEqual([]);
  });

  it("names the line the breach is actually on", () => {
    // The reason the stripper blanks block comments instead of deleting them.
    const source = [
      "/**",
      " * a docblock",
      " * three lines long",
      " */",
      'if (status === "unknown") return null;',
    ].join("\n");
    expect(memberComparisons(source)).toEqual([5]);
  });

  it("does not read a comment as a breach, and does not hide behind one", () => {
    expect(memberComparisons('// once this was status === "unknown"')).toEqual(
      [],
    );
    expect(
      memberComparisons('/*\n * status === "unknown" was the defect\n */'),
    ).toEqual([]);
    // A `//` inside a URL is not the start of a comment, so what follows it on
    // the line is still read.
    expect(
      memberComparisons(
        'const u = "https://x"; if (status === "unknown") go();',
      ),
    ).toEqual([1]);
  });
});
