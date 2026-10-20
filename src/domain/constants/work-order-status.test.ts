import { describe, expect, it } from "vitest";
import {
  WORK_ORDER_STATUSES,
  type WorkOrderStatus,
} from "@/domain/types/work-order";
import {
  canTransition,
  isOpenStatus,
  isTerminal,
  nextStatuses,
  requiresCancellationReason,
} from "./work-order-status";

/**
 * The rule, written out from AGENTS.md rather than read back off the map the
 * code uses. Two independent statements of the same thing: if the map grows an
 * edge, this table does not, and the matrix below goes red.
 */
const ALLOWED: ReadonlySet<string> = new Set([
  "open>assigned",
  "open>cancelled",
  "assigned>inProgress",
  "assigned>cancelled",
  "inProgress>waitingForParts",
  "inProgress>completed",
  "inProgress>cancelled",
  "waitingForParts>inProgress",
  "waitingForParts>cancelled",
]);

describe("work-order transitions", () => {
  it("answers every one of the 36 ordered pairs the way the rule does", () => {
    const wrong: string[] = [];

    for (const from of WORK_ORDER_STATUSES) {
      for (const to of WORK_ORDER_STATUSES) {
        const pair = `${from}>${to}`;
        if (canTransition(from, to) !== ALLOWED.has(pair)) {
          wrong.push(pair);
        }
      }
    }

    expect(wrong).toEqual([]);
    // Guards the loop itself: if the status list ever shrank to nothing, the
    // assertion above would pass while measuring nothing.
    expect(WORK_ORDER_STATUSES.length * WORK_ORDER_STATUSES.length).toBe(36);
  });

  it("refuses the shortcuts people ask for", () => {
    expect(canTransition("open", "completed")).toBe(false);
    expect(canTransition("open", "inProgress")).toBe(false);
    expect(canTransition("assigned", "completed")).toBe(false);
    expect(canTransition("waitingForParts", "completed")).toBe(false);
  });

  it("never leaves a closed order", () => {
    for (const to of WORK_ORDER_STATUSES) {
      expect(canTransition("completed", to)).toBe(false);
      expect(canTransition("cancelled", to)).toBe(false);
    }
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
    expect(isTerminal("open")).toBe(false);
  });

  it("lets an order go back for parts and come out again", () => {
    expect(canTransition("inProgress", "waitingForParts")).toBe(true);
    expect(canTransition("waitingForParts", "inProgress")).toBe(true);
  });

  it("can be cancelled from every state that is still open, and only with a reason", () => {
    const openStatuses: WorkOrderStatus[] = [
      "open",
      "assigned",
      "inProgress",
      "waitingForParts",
    ];

    for (const from of openStatuses) {
      expect(isOpenStatus(from)).toBe(true);
      expect(canTransition(from, "cancelled")).toBe(true);
    }

    expect(requiresCancellationReason("cancelled")).toBe(true);
    for (const to of WORK_ORDER_STATUSES.filter((s) => s !== "cancelled")) {
      expect(requiresCancellationReason(to)).toBe(false);
    }
  });

  it("offers the reachable statuses, in the order a screen shows them", () => {
    expect(nextStatuses("open")).toEqual(["assigned", "cancelled"]);
    expect(nextStatuses("inProgress")).toEqual([
      "waitingForParts",
      "completed",
      "cancelled",
    ]);
    expect(nextStatuses("completed")).toEqual([]);
  });
});
