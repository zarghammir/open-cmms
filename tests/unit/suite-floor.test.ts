import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  fileShouldRun,
  floorVerdict,
  gatesOf,
  ticketIn,
  type ParkedNote,
  type TestRecord,
} from "../fixtures/suite-floor";

/**
 * The floor's own logic, tested without a browser.
 *
 * The reporter is a thin shell around `floorVerdict`; everything that can be
 * wrong about the arithmetic is wrong here, where it costs a second to find.
 */

const T = (file: string, title: string, ran: boolean): TestRecord => ({
  file,
  title,
  ran,
});

describe("suite floor", () => {
  const gated = (file: string) =>
    file.includes("screenshots") ? ["WA_SCREENSHOTS"] : [];

  it("passes when everything collected ran", () => {
    const v = floorVerdict(
      [T("a.spec.ts", "one", true), T("a.spec.ts", "two", true)],
      gated,
      {},
    );
    expect(v.ok).toBe(true);
    expect(v.collected).toBe(2);
    expect(v.executed).toBe(2);
    expect(v.line).toContain("collected 2, executed 2");
  });

  it("excuses a skip its file's gate accounts for", () => {
    const v = floorVerdict(
      [
        T("screenshots-x.spec.ts", "a picture", false),
        T("a.spec.ts", "one", true),
      ],
      gated,
      {}, // WA_SCREENSHOTS unset, so the gated file is expected to skip
    );
    expect(v.ok).toBe(true);
    expect(v.gated).toBe(1);
    expect(v.unexplained).toEqual([]);
  });

  it("fails naming a skip that no gate explains — the 89 dropped tests", () => {
    const v = floorVerdict(
      [
        T("a.spec.ts", "one", true),
        T("a.spec.ts", "the one that vanished", false),
      ],
      gated,
      {},
    );
    expect(v.ok).toBe(false);
    expect(v.unexplained).toEqual(["the one that vanished"]);
    expect(v.line).toContain("1 unexplained");
  });

  it("stops excusing a gated file once its gate is satisfied", () => {
    const v = floorVerdict(
      [T("screenshots-x.spec.ts", "a picture", false)],
      gated,
      { WA_SCREENSHOTS: "1" },
    );
    expect(v.ok).toBe(false);
    expect(v.unexplained).toEqual(["a picture"]);
  });

  it("does not excuse a spec gated on a name nobody knows", () => {
    // The permissive direction: any unset variable would otherwise buy a
    // permanent exemption from the suite.
    const known = (file: string) =>
      file.includes("screenshots") ? ["WA_SCREENSHOTS"] : [];
    const v = floorVerdict(
      [T("sneaky.spec.ts", "gated on WA_NOBODY_SETS_THIS", false)],
      known,
      {},
    );
    expect(v.ok).toBe(false);
    expect(v.unexplained).toEqual(["gated on WA_NOBODY_SETS_THIS"]);
  });

  it("refuses a run that collected nothing", () => {
    const v = floorVerdict([], gated, {});
    expect(v.ok).toBe(false);
    expect(v.line).toContain("matched nothing");
  });

  it("reads a spec's gate from its source rather than a list", () => {
    const read = (() =>
      'test.skip(!process.env.WA_SCREENSHOTS, "set it");') as unknown as typeof readFileSync;
    expect(gatesOf("any.spec.ts", read)).toEqual(["WA_SCREENSHOTS"]);
    expect(fileShouldRun(["WA_SCREENSHOTS"], {})).toBe(false);
    expect(fileShouldRun(["WA_SCREENSHOTS"], { WA_SCREENSHOTS: "1" })).toBe(
      true,
    );
  });

  /**
   * The floor under the floor. If the gate pattern stopped matching, every
   * screenshot spec would read as ungated, the suite would fail on every
   * ordinary run, and somebody would "fix" it by widening the excuse. Assert
   * the pattern still finds the gates that are really there.
   */
  it("finds the gates that exist in this repository", () => {
    const dir = "tests/e2e";
    const gatedFiles = readdirSync(dir)
      .filter((f) => f.endsWith(".spec.ts"))
      .map((f) => join(dir, f))
      .filter((f) => gatesOf(f).length > 0);

    expect(
      gatedFiles.length,
      "no spec in tests/e2e declares an environment gate; the pattern has stopped matching",
    ).toBeGreaterThanOrEqual(25);

    // Which gates exist is derived, not named. An earlier draft of this test
    // asserted every gated file gates on WA_SCREENSHOTS and went red on the
    // write-instrument specs, which gate on WA_WRITE_INSTRUMENTS — a typed
    // expectation in a test written to stop typed expectations.
    for (const f of gatedFiles) {
      expect(gatesOf(f), f).not.toEqual([]);
    }
    /*
     * The set of gates is a policy, so it is named here and a new one fails.
     *
     * This is the one place a name is written down on purpose, and it is the
     * direction the floor can fail in: without it, anybody could excuse a spec
     * from the suite forever by gating it on an environment variable nobody
     * sets, and the run would still be green with the test silently absent.
     * A gate is a decision somebody makes, so adding one updates this line and
     * gets read in review.
     */
    const names = [...new Set(gatedFiles.flatMap((f) => gatesOf(f)))].sort();
    expect(
      names,
      "a spec gates on a name this list does not know; add it deliberately or remove the gate",
    ).toEqual(["WA_SCREENSHOTS", "WA_WRITE_INSTRUMENTS"]);
  });

  /**
   * The ceiling on amber.
   *
   * `test.fixme()` is reported rather than failed, because a red one gets the
   * reporter switched off by whoever wants their green back. Reporting it with
   * nothing else attached makes it the cheapest possible way to stop a test
   * failing, and this reporter would be what makes that legitimate. Every park
   * names a ticket or it is unexplained.
   */
  describe("a parked test", () => {
    const note = (at: string, description?: string): ParkedNote => ({
      at,
      description,
    });

    it("stays amber, and keeps the run green, when it names its ticket", () => {
      // The other half of a control. Reddening bad input says nothing about
      // what a guard does to input that is already correct, and two guards on
      // this project have reddened the material they were written to protect.
      const v = floorVerdict(
        [T("a.spec.ts", "one", true), T("r.spec.ts", "the trail line", false)],
        gated,
        {},
        new Map([
          [
            "the trail line",
            note("e2e/r.spec.ts:168", "WA-92: the store refuses it"),
          ],
        ]),
      );
      expect(v.ok).toBe(true);
      expect(v.unexplained).toEqual([]);
      expect(v.parked).toEqual([
        { title: "the trail line", at: "e2e/r.spec.ts:168", ticket: "WA-92" },
      ]);
      expect(v.line).toContain("1 parked, 0 unexplained");
    });

    it("fails the run when it names no ticket", () => {
      const v = floorVerdict(
        [T("r.spec.ts", "parked by somebody in a hurry", false)],
        gated,
        {},
        new Map([["parked by somebody in a hurry", note("e2e/r.spec.ts:20")]]),
      );
      expect(v.ok).toBe(false);
      expect(v.parked).toEqual([]);
      expect(v.unexplained).toHaveLength(1);
      expect(v.unexplained[0]).toContain("names no ticket");
      expect(v.unexplained[0]).toContain("e2e/r.spec.ts:20");
    });

    it("fails the run when its description names something that is not a ticket", () => {
      const v = floorVerdict(
        [T("r.spec.ts", "broken since the encoding change", false)],
        gated,
        {},
        new Map([
          [
            "broken since the encoding change",
            note("e2e/r.spec.ts:20", "the UTF-8 path is wrong, see ISO-8601"),
          ],
        ]),
      );
      expect(v.ok).toBe(false);
      expect(v.unexplained[0]).toContain("names no ticket");
    });

    it("reads the ticket out of a description and refuses look-alikes", () => {
      expect(ticketIn("WA-92: the store refuses it")).toBe("WA-92");
      expect(ticketIn("blocked on WA-114 and WA-92")).toBe("WA-114");
      expect(ticketIn(undefined)).toBeNull();
      expect(ticketIn("")).toBeNull();
      expect(ticketIn("a UTF-8 problem")).toBeNull();
      expect(ticketIn("ISO-8601 dates")).toBeNull();
      expect(ticketIn("WA-")).toBeNull();
      expect(ticketIn("SWA-92")).toBeNull();
    });
  });
});
