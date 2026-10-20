import type { Id, PartCategory, UnitOfMeasure } from "@/domain/types";

/** Below its minimum, or not. */
export type StockState = "low" | "ok";

/**
 * One row of the parts register.
 *
 * A type alias rather than an interface, for the reason `AssetRow` gives:
 * TanStack's `RowData` constraint is `Record<string, any>` and an interface has
 * no implicit index signature.
 *
 * Flat and already in the reader's language, so sorting and filtering work on
 * the value a person can see. The one field that is not a string is `low`, and
 * it is deliberately **not** recomputed here — see `PartsScreen`.
 */
export type PartRow = {
  id: Id;
  partNumber: string;
  name: string;
  category: PartCategory;
  categoryLabel: string;
  onHand: number;
  /**
   * `Part.reorderPoint`, shown under the heading "Minimum".
   *
   * One number, one column. The ticket asked for a minimum *and* a reorder
   * point; the domain has a single `reorderPoint` and `parts.belowMinimum`
   * compares against it, so two columns would have drawn the same value twice
   * under two headings. "Minimum" is the word the catalogue already uses for
   * it — `assetDetail.parts.stock` reads "{onHand} on hand, minimum {minimum}".
   */
  minimum: number;
  unitOfMeasure: UnitOfMeasure;
  unitLabel: string;
  unitCost: number;
  facilityId: Id;
  /**
   * The bin, `REG-A01-01`.
   *
   * It carries the site as its first segment, which is why this register has no
   * separate site column: the code a storekeeper reads already says where the
   * part is, down to the aisle and shelf.
   */
  binCode: string;
  /**
   * Whether the part is below its minimum, as the repository answers it.
   *
   * A named state rather than a boolean, and not only for readability: the
   * shared facet filter builds its options from the column's faceted values and
   * keeps `typeof value === "string"` ones. A boolean column therefore produces
   * an **empty menu** — no options, no error, nothing to say the filter cannot
   * work. Every other facet in the product filters a string enum, and this one
   * now does too.
   */
  stockState: StockState;
};

/**
 * Whether a row matches what someone typed.
 *
 * Stock number, name and bin only. The same restraint the assets register
 * shows: a query that matches a category nobody was looking for makes the
 * search feel broken, and the category has a facet of its own.
 */
export function matchesSearch(row: PartRow, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (needle.length === 0) return true;

  return [row.partNumber, row.name, row.binCode].some((value) =>
    value.toLocaleLowerCase().includes(needle),
  );
}
