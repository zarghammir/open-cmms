import { describe, expect, it } from "vitest";
import {
  WORK_ORDER_TRANSITIONS,
  WAITING_FOR_PARTS_EDGES,
  canTransitionUnder,
  transitionAvailability,
  waitingForPartsEnabled,
} from "./work-order-status";
import { WORK_ORDER_STATUSES } from "@/domain/types";

/**
 * The effective rule: the domain's map, narrowed by what an administrator
 * switched off.
 *
 * The map's own test walks all thirty-six ordered pairs against the rule
 * written out in AGENTS.md. This asks the second question — what the rules
 * record does to that map — and the property that matters is **subtraction**:
 * no arrangement of the record can make a move legal that the domain forbids.
 */

const NONE = { disabledTransitions: [] };

describe("the rules narrow the flow and never widen it", () => {
  it("cannot make a forbidden move legal, whatever is in the record", () => {
    /*
     * The whole matrix, against a record that tries to allow everything by
     * disabling nothing. Any pair the domain refuses must still be refused —
     * which is the guarantee that made the shape subtractive in the first
     * place, and it is worth asserting rather than trusting the shape.
     */
    const illegal = WORK_ORDER_STATUSES.flatMap((from) =>
      WORK_ORDER_STATUSES.filter(
        (to) => !WORK_ORDER_TRANSITIONS[from].includes(to),
      ).map((to) => ({ from, to })),
    );

    expect(illegal.length, "pairs the domain forbids").toBeGreaterThan(20);

    for (const pair of illegal) {
      expect(
        transitionAvailability(NONE, pair.from, pair.to),
        `${pair.from} → ${pair.to}`,
      ).toBe("notInFlow");
      expect(canTransitionUnder(NONE, pair.from, pair.to)).toBe(false);
    }
  });

  it("tells a move nobody withheld from one somebody switched off", () => {
    // The distinction the screens depend on. Same answer to "can it happen",
    // two different sentences to a person.
    expect(transitionAvailability(NONE, "completed", "inProgress")).toBe(
      "notInFlow",
    );
    expect(
      transitionAvailability(
        { disabledTransitions: [{ from: "inProgress", to: "completed" }] },
        "inProgress",
        "completed",
      ),
    ).toBe("turnedOff");
    // And the one that is simply allowed, so the three are distinguishable
    // rather than two of them being the same value.
    expect(transitionAvailability(NONE, "inProgress", "completed")).toBe(
      "allowed",
    );
  });

  it("reads no rules as the application's own flow, not as permission", () => {
    /*
     * Null is the boot moment. Answering "allowed" there is the honest
     * default — it is what the application did before any of this existed —
     * and answering "turnedOff" would show every control disabled for a second
     * on every load, which is a screen telling a person something untrue.
     */
    expect(transitionAvailability(null, "inProgress", "completed")).toBe(
      "allowed",
    );
    expect(transitionAvailability(null, "completed", "open")).toBe("notInFlow");
  });

  it("switches only the move it is given", () => {
    const rules = {
      disabledTransitions: [
        { from: "inProgress" as const, to: "completed" as const },
      ],
    };

    expect(canTransitionUnder(rules, "inProgress", "completed")).toBe(false);
    // The neighbours, which a filter on the wrong field would take with it.
    expect(canTransitionUnder(rules, "inProgress", "cancelled")).toBe(true);
    expect(canTransitionUnder(rules, "assigned", "inProgress")).toBe(true);
    expect(canTransitionUnder(rules, "inProgress", "waitingForParts")).toBe(
      true,
    );
  });
});

describe("the Waiting for parts stage", () => {
  it("is on when both its edges are, and off when either is not", () => {
    expect(waitingForPartsEnabled(NONE)).toBe(true);

    /*
     * Either direction alone turns the answer off, and that is deliberate
     * rather than incidental: a stage you can enter and not leave strands an
     * order somewhere nothing can move it from. The switch closes both, and
     * this asserts the reading agrees — one edge disabled is not "half on".
     */
    for (const edge of WAITING_FOR_PARTS_EDGES) {
      expect(
        waitingForPartsEnabled({ disabledTransitions: [edge] }),
        `${edge.from} → ${edge.to} alone`,
      ).toBe(false);
    }
  });

  it("governs exactly two edges, both between in progress and waiting", () => {
    // A floor on the constant itself: a list that had drifted to one edge, or
    // to none, would make the assertions above pass while governing nothing.
    expect(WAITING_FOR_PARTS_EDGES).toHaveLength(2);
    for (const edge of WAITING_FOR_PARTS_EDGES) {
      expect([edge.from, edge.to].sort()).toEqual([
        "inProgress",
        "waitingForParts",
      ]);
    }
  });
});
