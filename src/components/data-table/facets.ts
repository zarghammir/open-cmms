/**
 * Whether a value is one of the selected ones.
 *
 * No selection means no filter — not a filter that matches nothing. Those are
 * different answers and confusing them empties the table the moment someone
 * opens a filter menu and closes it again.
 *
 * It lives here rather than beside one module's rows because the parts register
 * is the second table to need it, and the repository's own rule is one
 * definition read from both places — the argument `table-fit.ts` and
 * `scripts/e2e-port.mjs` each make in their own header. Two copies of a
 * predicate is two chances for the tables to disagree about what an empty
 * selection means.
 */
/**
 * What a facet can offer to filter on.
 *
 * Strings, numbers and booleans — the shapes a column accessor returns that a
 * person could sensibly pick from a list. Not objects, not dates, not `null`:
 * those need a decision about how they read before they can be offered, and
 * `DataTableFacetFilter` says so out loud in development rather than dropping
 * them.
 */
export type FacetValue = string | number | boolean;

export function isFacetValue(value: unknown): value is FacetValue {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/**
 * Whether a value is one of the selected ones.
 *
 * **Compared as text, on both sides, deliberately.** A column's `filterFn`
 * usually hands this `String(row.getValue(id))` — every register on main does —
 * while the menu stores the raw value it offered, which for a boolean column is
 * `true` rather than `"true"`. Comparing raw would make a boolean facet select
 * nothing, which is the same silent emptiness one layer down from the defect
 * this widening exists to fix. Comparing as text means a register keeps working
 * whether its `filterFn` stringifies or not.
 */
export function matchesFacet(
  value: FacetValue,
  selected: readonly FacetValue[] | undefined,
): boolean {
  if (!selected || selected.length === 0) return true;
  return selected.some((one) => String(one) === String(value));
}
