import type { Part } from "@/domain/types";

/**
 * Whether a quantity leaves a part under its minimum.
 *
 * **One definition, because it was four.** The same comparison was written out
 * in the dashboard KPI, on the asset page's parts panel, in the seed that
 * decides which parts get a low-stock notice, and inside the part repository —
 * and none of them called another. They agreed only because every one of them
 * happened to use a strict `<`.
 *
 * That is a coincidence rather than a design, and the cost of it landing wrong
 * is not a crash. A dashboard counting one part low while the asset page calls
 * the same part in stock is a demonstration where two screens disagree about a
 * record in front of the reader, and nothing fails to make anyone look.
 *
 * `reorderPoint` is the minimum. The comparison is strict: a part sitting on
 * its minimum is **at** it, not below it, and that is the boundary every
 * consumer now shares. It is also the one input where `<` and `<=` differ,
 * which is why the tests plant a part at exactly its minimum — any other
 * quantity would pass under both and prove nothing about which is in force.
 */
export function isBelowMinimum(part: Part, quantity = part.quantityOnHand) {
  return quantity < part.reorderPoint;
}
