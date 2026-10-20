import type { Id } from "@/domain/types";

/**
 * An id for a record being inserted, guaranteed free in the collection it is
 * going into.
 *
 * **The defect this exists for.** Live records were given ids built from the
 * clock and the record's own name — `inv-live-${at}-${partNumber}`,
 * `lab-live-${at}-${number}` — and `applyMutation` refuses an insert whose id
 * is already present. So two movements of the same part inside one
 * millisecond, or a completion and a logged hour against the same order in one
 * tick, threw `already holds id` and the act failed outright. Six sites had it.
 *
 * **Why not a finer clock.** Millisecond resolution is not the problem;
 * simultaneity is. A microsecond clock makes the window narrower and leaves
 * the same defect, which is the shape of a fix that cannot be tested — you
 * could only ever fail to reproduce it.
 *
 * So the id asks the collection instead. It **cannot be wrong about whether an
 * id is free**, because it is looking at the thing that would reject it rather
 * than at a clock that only correlates with it.
 *
 * The readable base is kept exactly as it was, so a record made on its own —
 * which is nearly all of them — has the id it has always had, and a second one
 * in the same tick becomes `…-2`. Nothing reads meaning out of the suffix, or
 * out of any part of an id: `Id` is opaque by declaration.
 */
export function freeId(
  collection: readonly { id: Id }[],
  base: string,
): string {
  if (!collection.some((record) => record.id === base)) return base;

  /*
   * From two, because the base is conceptually the first. A loop rather than a
   * count of matches: counting would hand out an id that is already taken as
   * soon as one in the middle of a run has been removed, which is the kind of
   * arithmetic that works until the day something is deleted.
   */
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!collection.some((record) => record.id === candidate)) return candidate;
  }
}
