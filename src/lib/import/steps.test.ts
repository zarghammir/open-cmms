import { describe, expect, it } from "vitest";
import {
  IMPORT_STEPS,
  canReach,
  furthestReachable,
  nextStep,
  previousStep,
  type StepReadiness,
} from "./steps";

/**
 * Which step can be opened, asked of the state rather than of how far someone
 * has clicked.
 *
 * The distinction matters: going back and changing a mapping makes the report
 * stale, and a wizard that remembered "you reached preview" would happily
 * reopen a preview built from columns that no longer apply.
 */

const NOTHING: StepReadiness = {
  hasSheets: false,
  mappingComplete: false,
  hasRun: false,
  committed: false,
};
const READY: StepReadiness = {
  hasSheets: true,
  mappingComplete: true,
  hasRun: true,
  committed: false,
};

describe("reaching a step", () => {
  it("opens only the first step before a file has been read", () => {
    expect(IMPORT_STEPS.filter((step) => canReach(step, NOTHING))).toEqual([
      "upload",
    ]);
  });

  it("opens matching once sheets are recognised, and no further", () => {
    const state = { ...NOTHING, hasSheets: true };
    expect(IMPORT_STEPS.filter((step) => canReach(step, state))).toEqual([
      "upload",
      "map",
    ]);
  });

  it("will not open the preview until the rows have been read", () => {
    const state = { ...NOTHING, hasSheets: true, mappingComplete: true };
    expect(canReach("report", state)).toBe(true);
    expect(canReach("preview", state)).toBe(false);
  });

  it("closes the commit step once the import has been written", () => {
    expect(canReach("commit", READY)).toBe(true);
    expect(canReach("commit", { ...READY, committed: true })).toBe(false);
  });

  it("shuts the later steps again when a mapping is undone", () => {
    // The point of asking the state. A report built from columns that no
    // longer apply must not stay open behind a back button.
    const stale = { ...READY, mappingComplete: false };
    expect(canReach("report", stale)).toBe(false);
    expect(canReach("preview", stale)).toBe(false);
    expect(furthestReachable(stale)).toBe("map");
  });

  it("would notice if everything were reachable", () => {
    // The control: the assertions above are lists, and a `canReach` that always
    // returned true would fail them — but one that always returned false would
    // pass several. This pins both ends.
    expect(furthestReachable(NOTHING)).toBe("upload");
    expect(furthestReachable(READY)).toBe("commit");
  });

  it("moves forward only when the next step is allowed", () => {
    expect(nextStep("upload", NOTHING)).toBeNull();
    expect(nextStep("upload", READY)).toBe("map");
    expect(nextStep("commit", READY)).toBeNull();
  });

  it("always allows going back, because looking again is not a change", () => {
    expect(previousStep("upload")).toBeNull();
    expect(previousStep("map")).toBe("upload");
    expect(previousStep("commit")).toBe("preview");
  });
});
