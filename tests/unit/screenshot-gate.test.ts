import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every screenshot spec is gated, and none of them writes tracked pictures on
 * an ordinary test run.
 *
 * **The defect this exists for.** `screenshots-wa21.spec.ts` shipped without
 * `test.skip(!process.env.WA_SCREENSHOTS, …)`, so a plain `npm run test:e2e`
 * executed its nine tests and wrote into the tracked `docs/screenshots/WA-21/`.
 * The reviewer found it by accident: their run, with no screenshot variable
 * set, came back with two committed pictures modified.
 *
 * The cost is not the dirty tree, though every developer gets one. It is that
 * WA-63's run-to-run instability gains a route into commits on the back of "I
 * just ran the tests" — a picture that differs between runs, modified by a
 * command nobody thought took pictures, staged with everything else. It also
 * defeats the arrangement AGENTS.md describes, where continuous integration
 * points the root at a directory it throws away, and it makes suite counts
 * incomparable between branches: 63 skipped on that branch against 68 on
 * another, for no reason a reader could see.
 *
 * Source-reading rather than behavioural on purpose. The behaviour — "does a
 * plain run write a file" — can only be observed by running the browser suite
 * and looking at the working tree afterwards, which is exactly the thing
 * nobody does on a green build.
 */

const E2E = path.resolve(process.cwd(), "tests/e2e");

/** The line every one of these files must carry, matched loosely on purpose. */
const GATE = /test\.skip\(\s*!process\.env\.WA_SCREENSHOTS/;

function screenshotSpecs(): string[] {
  return readdirSync(E2E)
    .filter(
      (name) => name.startsWith("screenshots") && name.endsWith(".spec.ts"),
    )
    .sort();
}

describe("the screenshot specs", () => {
  const specs = screenshotSpecs();

  it("reads enough files to be checking anything", () => {
    /*
     * The floor, at the count rather than below it.
     *
     * A glob that matched nothing — a renamed folder, a changed suffix, a
     * `process.cwd()` that is not the project root — reports no ungated specs
     * and passes, which is the same green as every spec being correct. That is
     * what any floor catches.
     *
     * At the exact count it catches one more thing: a spec quietly
     * disappearing. Set loosely — 10 against the 16 present — six files could
     * vanish one at a time and this would stay green while covering less each
     * time, which is the slow version of matching nothing.
     *
     * **So deleting a screenshot spec updates this number, deliberately.** The
     * red that follows a deletion is not a broken test; it is this file asking
     * whether the deletion was meant.
     */
    // Seventeen at this commit: sixteen, plus WA-22's. The number moves with
    // the count deliberately — that is what makes a spec disappearing a red
    // rather than a quiet loss of coverage.
    expect(specs.length).toBeGreaterThanOrEqual(17);
  });

  it("gates every one of them behind WA_SCREENSHOTS", () => {
    const ungated = specs.filter(
      (name) => !GATE.test(readFileSync(path.join(E2E, name), "utf8")),
    );

    expect(
      ungated,
      "these write into the tracked docs/screenshots on an ordinary test run",
    ).toEqual([]);
  });

  it("would notice a spec that lost its gate", () => {
    // The control for the matcher itself: the assertion above compares against
    // an empty list, and would pass just as well if `GATE` matched every file
    // it was handed — including one with no gate in it at all.
    expect(GATE.test("test.skip(!process.env.WA_SCREENSHOTS, 'x');")).toBe(
      true,
    );
    expect(GATE.test("test.describe('WA-21 screenshots', () => {")).toBe(false);
  });
});
