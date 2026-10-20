import { describe, expect, it } from "vitest";
import { DEMO_STATUSES, type DemoStatus } from "@/stores/demo-store";
import { hasRecords, recordsState } from "./use-demo-data";

/**
 * Every state of the store is accounted for, and only one of them means the
 * records are there.
 *
 * This walks `DEMO_STATUSES` rather than a list written here, so a member added
 * to the union is a member this test has already asked about. The compiler is
 * the first line — `hasRecords` has a `never` default, so a fourth member stops
 * the build — and this is the second, for the case where somebody satisfies the
 * compiler by widening the `false` branch without thinking about what the new
 * state means to a person.
 */

describe("hasRecords", () => {
  it("has something to walk", () => {
    // The floor. Every assertion below is a loop over this list, and a loop
    // over an empty list agrees with itself perfectly.
    expect(DEMO_STATUSES.length).toBeGreaterThanOrEqual(3);
    expect(DEMO_STATUSES).toContain("ready");
  });

  it.each(DEMO_STATUSES)(
    "%s: the records are there only when the read finished and succeeded",
    (status: DemoStatus) => {
      expect(hasRecords(status)).toBe(status === "ready");
    },
  );

  it("does not confuse a read that failed with a read that has not finished", () => {
    // Both answer "no records", and that is correct — but they are different
    // answers to a person, and WA-66 gives the second its own words. This is
    // here so that a change which collapses them has to delete a test rather
    // than quietly widen a branch.
    expect(hasRecords("unknown")).toBe(false);
    expect(hasRecords("unreadable")).toBe(false);
    expect(DEMO_STATUSES).toContain("unreadable");
  });
});

describe("recordsState", () => {
  it("gives every member its own answer", () => {
    // Three states stay three. The whole of WA-66 is that "still reading" and
    // "could not be read" are different things to say to a person, and a
    // mapping that collapsed any two of these would put the skeleton back.
    const answers = DEMO_STATUSES.map((status: DemoStatus) => [
      status,
      recordsState(status),
    ]);

    expect(Object.fromEntries(answers)).toEqual({
      ready: "records",
      unknown: "reading",
      unreadable: "unreadable",
    });
    expect(
      new Set(answers.map(([, state]) => state)).size,
      "two members of DemoStatus share an answer, so a screen cannot tell them apart",
    ).toBe(DEMO_STATUSES.length);
  });

  it("is the one thing `hasRecords` is derived from", () => {
    // Not a restatement: it is what stops the two drifting into two switches
    // over one union, which is the duplication the design exists to remove.
    for (const status of DEMO_STATUSES) {
      expect(hasRecords(status)).toBe(recordsState(status) === "records");
    }
  });
});
