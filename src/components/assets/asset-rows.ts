import type { AssetCriticality, AssetStatus, Id } from "@/domain/types";

/**
 * One row of the assets table.
 *
 * A type alias rather than an interface on purpose: TanStack's `RowData`
 * constraint is `Record<string, any>`, and an interface has no implicit index
 * signature, so an interface row type does not satisfy it.
 *
 * Flat, and already in the reader's language. Sorting and filtering work on
 * the value a person can see rather than on a nested record, so "sort by site"
 * orders by the site's name as printed — which in French is a different order
 * from English, and should be.
 */
export type AssetRow = {
  id: Id;
  assetTag: string;
  name: string;
  typeId: Id;
  typeLabel: string;
  facilityId: Id;
  facilityName: string;
  /**
   * The city, for the column that has to fit.
   *
   * Beside the full name, not instead of it: the card at 390 shows the name,
   * and the desktop cell carries it as its accessible name. Four of the five
   * sites are "Laboratoire régional de …", so the name's first twenty-three
   * characters distinguish nothing and the city is the whole of what a reader
   * is looking for.
   */
  facilityCity: string;
  locationCode: string;
  status: AssetStatus;
  criticality: AssetCriticality;
  installedOn: string;
  manufacturer: string;
  model: string;
};

/**
 * Whether a row matches what someone typed.
 *
 * Tag, name and location only. Searching every field sounds generous and is
 * not: a query that matches a manufacturer nobody was looking for makes the
 * search feel broken.
 */
export function matchesSearch(row: AssetRow, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (needle.length === 0) return true;

  return [row.assetTag, row.name, row.locationCode].some((value) =>
    value.toLocaleLowerCase().includes(needle),
  );
}
