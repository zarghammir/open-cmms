import { describe, expect, it } from "vitest";
import { buildSeed } from "@/data/seed";
import { isBelowMinimum } from "./part";

const anyPart = () => buildSeed(new Date("2026-09-12T00:00:00.000Z")).parts[0]!;

describe("whether a part is below its minimum", () => {
  it("says no when the count is exactly the minimum", () => {
    /*
     * **The boundary, and the only input that matters.**
     *
     * Every other quantity gives the same answer under `<` and `<=`, so no
     * other input can tell which rule is in force. A part sitting on its
     * minimum is *at* it, not below it — and this is the case the consumers'
     * tests plant, because it is the one that moves when the rule does.
     */
    const part = { ...anyPart(), reorderPoint: 4 };
    expect(isBelowMinimum(part, 4)).toBe(false);
  });

  it("says yes one below and no one above", () => {
    const part = { ...anyPart(), reorderPoint: 4 };
    expect(isBelowMinimum(part, 3)).toBe(true);
    expect(isBelowMinimum(part, 5)).toBe(false);
  });

  it("reads the part's own count when no quantity is given", () => {
    // The shape every consumer but the crossing uses: ask about the part as it
    // stands. The crossing passes a quantity because it asks twice, about
    // before and after.
    const part = { ...anyPart(), reorderPoint: 4, quantityOnHand: 2 };
    expect(isBelowMinimum(part)).toBe(true);
    expect(isBelowMinimum({ ...part, quantityOnHand: 9 })).toBe(false);
  });

  it("zero on hand is below any minimum above zero", () => {
    // Worth pinning: zero is a real count, not a missing one, and a part with
    // none of something is the most below its minimum it can be.
    const part = { ...anyPart(), reorderPoint: 1, quantityOnHand: 0 };
    expect(isBelowMinimum(part)).toBe(true);
    // And a minimum of zero means nothing is ever below it.
    expect(isBelowMinimum({ ...part, reorderPoint: 0 })).toBe(false);
  });
});
