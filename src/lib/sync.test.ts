import { describe, expect, it } from "vitest";
import {
  PLANTED_CONFLICT,
  replayOutcome,
  shouldPlantConflict,
  versionOf,
} from "./sync";

/** The moment the queue is replayed, which is when a conflict is discovered. */
const NOW = "2026-09-13T18:32:00.000Z";

describe("what the server does with a queued change", () => {
  it("accepts a change written against the version it holds", () => {
    const outcome = replayOutcome(
      "workOrders:wko-1",
      2,
      { "workOrders:wko-1": 2 },
      null,
      NOW,
    );

    expect(outcome.kind).toBe("applied");
    expect(outcome.kind === "applied" && outcome.version).toBe(3);
  });

  it("treats a record it has never seen as version zero, not as a conflict", () => {
    // Unknown and mismatched are different answers. A record nobody has
    // synchronised yet is not a record in conflict.
    expect(versionOf("workOrders:new", {})).toBe(0);
    expect(replayOutcome("workOrders:new", 0, {}, null, NOW).kind).toBe(
      "applied",
    );
  });

  it("refuses a change written against a version it has moved past", () => {
    const outcome = replayOutcome(
      "workOrders:wko-1",
      1,
      { "workOrders:wko-1": 4 },
      null,
      NOW,
    );
    expect(outcome.kind).toBe("conflict");

    // The refusal carries the moment it was discovered, not a placeholder.
    // This branch used to stamp the epoch, which formats as 1 Jan 1970 on a
    // screen and reads as a real answer.
    expect(outcome.kind === "conflict" && outcome.server.at).toBe(NOW);
  });

  it("refuses when a change is planted, whatever the versions say", () => {
    const outcome = replayOutcome(
      "workOrders:wko-1",
      0,
      { "workOrders:wko-1": 0 },
      { ...PLANTED_CONFLICT, at: NOW },
      NOW,
    );

    expect(outcome.kind).toBe("conflict");
    expect(outcome.kind === "conflict" && outcome.server.field).toBe("status");
    expect(outcome.kind === "conflict" && outcome.server.value).toBe(
      "waitingForParts",
    );
  });

  it("can tell the two apart", () => {
    // The deletion control: a function that always conflicted, or never did,
    // would pass some of the above and fail here.
    const versions = { "workOrders:wko-1": 2 };
    expect(replayOutcome("workOrders:wko-1", 2, versions, null, NOW).kind).toBe(
      "applied",
    );
    expect(replayOutcome("workOrders:wko-1", 1, versions, null, NOW).kind).toBe(
      "conflict",
    );
  });
});

describe("when the planted conflict fires", () => {
  it("fires on the first work-order change queued while offline", () => {
    expect(shouldPlantConflict("workOrders", false, true)).toBe(true);
  });

  it("fires once", () => {
    expect(shouldPlantConflict("workOrders", true, true)).toBe(false);
  });

  it("does not fire on a change made online", () => {
    // The reason this argument exists. Keyed on the first work-order change
    // alone it would be spent on an ordinary online edit, before the
    // demonstration ever switched the network off.
    expect(shouldPlantConflict("workOrders", false, false)).toBe(false);
  });

  it("does not fire on anything but a work order", () => {
    // The recording opens a work order. Planting on parts or assets would put
    // the conflict screen somewhere the script does not go.
    expect(shouldPlantConflict("parts", false, true)).toBe(false);
    expect(shouldPlantConflict("assets", false, true)).toBe(false);
  });
});
