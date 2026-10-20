import type { DemoData } from "@/data/seed";
import type { Id, Part } from "@/domain/types";

/**
 * The stock a walkthrough can push below its minimum, at one site.
 *
 * **One rule, two callers.** The primary-flow fixture uses it to choose the
 * part the story issues; `tests/unit/issuable-site.test.ts` uses it to say in
 * advance whether the story can be walked at all. Written twice they would
 * agree with themselves and with nothing else, and the unit check would go on
 * passing while the browser run threw.
 *
 * The filter is the dialog's, not this file's invention: the issue dialog
 * offers `parts.list(order.facilityId)` with `quantityOnHand > 0`, so a part at
 * another site is not on the list at all. `reorderPoint >= 1` because a minimum
 * of zero cannot be crossed — the gap plus one would be more than there is, and
 * the form would rightly refuse it. Smallest gap first, so the quantity issued
 * is the smallest the seed allows.
 */
export function crossablePartsAt(data: DemoData, facilityId: Id): Part[] {
  return data.parts
    .filter(
      (part) =>
        part.facilityId === facilityId &&
        part.reorderPoint >= 1 &&
        part.quantityOnHand > part.reorderPoint,
    )
    .sort(
      (a, b) =>
        a.quantityOnHand - a.reorderPoint - (b.quantityOnHand - b.reorderPoint),
    );
}

/** What issuing that part takes, to land one below the minimum. */
export function crossingAt(
  data: DemoData,
  facilityId: Id,
): { part: Part; issue: number } | null {
  const part = crossablePartsAt(data, facilityId)[0];
  if (!part) return null;
  return { part, issue: part.quantityOnHand - part.reorderPoint + 1 };
}

/** The site's code, for a message a person can act on. Null if it is gone. */
export function siteCodeOf(data: DemoData, facilityId: Id): string | null {
  return (
    data.facilities.find((facility) => facility.id === facilityId)?.code ?? null
  );
}
