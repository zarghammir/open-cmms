import { describe, expect, it } from "vitest";
import type { Id } from "@/domain/types";
import { freeId } from "./ids";

/**
 * `freeId` on its own, which is the only way one of its six call sites can be
 * covered at all.
 *
 * Five of the six are reachable through a repository and are tested there,
 * against the records a person would see. `wkc-live-` is not: it is written
 * only by `complete`, and the status machine refuses to complete an order that
 * is already completed, so a second insert for one order in one tick cannot be
 * provoked through the real path. It is fixed by construction rather than
 * demonstrated, and a direct test of the mechanism is what stands behind it.
 *
 * These are about the helper's contract, not about any repository: a collection
 * of bare `{ id }` records, because that is all it asks for.
 */

const records = (...ids: string[]): { id: Id }[] =>
  ids.map((id) => ({ id: id as Id }));

describe("an id that asks the collection", () => {
  it("keeps the readable base when nothing holds it", () => {
    // The ordinary case, which is nearly every record: made on its own, and
    // given exactly the id it would have had before this ticket existed.
    expect(
      freeId(records(), "inv-live-2026-09-12T14:05:00.000Z-FLT-2101"),
    ).toBe("inv-live-2026-09-12T14:05:00.000Z-FLT-2101");
    expect(freeId(records("something-else"), "wkc-live-x")).toBe("wkc-live-x");
  });

  it("suffixes from two when the base is taken", () => {
    // From two because the base is conceptually the first, so a run reads
    // base, -2, -3 rather than starting at a -1 nothing corresponds to.
    expect(freeId(records("lab-live-x"), "lab-live-x")).toBe("lab-live-x-2");
  });

  it("walks past a run that is already there", () => {
    expect(
      freeId(records("ntf-asg-x", "ntf-asg-x-2", "ntf-asg-x-3"), "ntf-asg-x"),
    ).toBe("ntf-asg-x-4");
  });

  it("fills a gap left in the middle of a run, where counting would collide", () => {
    /*
     * The claim the helper's own comment makes, asserted rather than argued.
     *
     * Counting the matches is the obvious implementation and it is wrong the
     * moment anything is removed: with `base` and `base-3` present, a count
     * says two records and hands out `base-3`, which is taken — so the insert
     * `freeId` exists to make safe would be refused by the very guard it is
     * meant to satisfy. The loop asks about each candidate instead, and
     * answers `base-2`, the gap.
     */
    // The run was base, -2, -3; then -2 was removed.
    const afterADeletion = records("inv-count-x", "inv-count-x-3");

    /*
     * What counting would answer, written out rather than described: two
     * records present, so the next index is three. Asserting it is *taken* is
     * what makes this a comparison instead of a claim — without it, the line
     * below would just be the loop agreeing with itself.
     */
    const countingWouldSay = `inv-count-x-${afterADeletion.length + 1}`;
    expect(countingWouldSay).toBe("inv-count-x-3");
    expect(
      afterADeletion.some((record) => record.id === countingWouldSay),
      "the id counting would hand out is already taken",
    ).toBe(true);

    expect(freeId(afterADeletion, "inv-count-x")).toBe("inv-count-x-2");
  });

  it("does not match on a prefix, only on the whole id", () => {
    // `base` and `base-2` are different ids, and a record whose id merely
    // starts with the base does not make the base taken. Otherwise a seeded
    // record could push every live id along by one for no reason.
    expect(freeId(records("wkc-live-x-2", "wkc-live-xy"), "wkc-live-x")).toBe(
      "wkc-live-x",
    );
  });

  it("is not fooled by an id the seed already holds", () => {
    /*
     * The guarantee the no-bump argument rests on. It is not that live
     * prefixes and seeded prefixes happen not to overlap — it is that the
     * collection handed in already contains the seeded records, so a base that
     * did collide with one is simply suffixed.
     */
    expect(freeId(records("seeded-id"), "seeded-id")).toBe("seeded-id-2");
  });
});
