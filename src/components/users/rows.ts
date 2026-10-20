import type { Role } from "@/domain/constants/roles";
import type { Id, User } from "@/domain/types";

/**
 * The rows the people register is drawn from.
 *
 * A type alias rather than an interface, for the reason the other registers
 * give: TanStack's `RowData` constraint is `Record<string, any>` and an
 * interface has no implicit index signature.
 *
 * Flat and already in the reader's language, so sorting and filtering work on
 * the value a person can see rather than on a nested record.
 */
export type PeopleTableRow = {
  id: Id;
  employeeNumber: string;
  name: string;
  email: string;
  role: Role;
  roleLabel: string;
  /**
   * The code of the site this person works out of — `KGN`, `MCT`.
   *
   * The code rather than the name, because that is what a record is named by
   * in this application and what people say out loud. The names do not fit a
   * column: "Laboratoire régional de Sudbury" truncates to
   * "Laboratoire régional de S…" on every row, which spends ten characters
   * repeating a prefix and cuts off the one word that tells two sites apart.
   *
   * **Null means the site did not resolve** — a broken reference — and the
   * table says so in words rather than leaving the cell blank. A blank cell
   * reads as "none", and "this person works out of nowhere" is a different
   * claim from "this system cannot tell you where", which is the true one.
   */
  siteLabel: string | null;
  /** The site's full name, for the cell's `title` and for search. */
  siteName: string | null;
  tradeLabels: string[];
  active: boolean;
  /** True when this person's role may change nothing at all. */
  readsOnly: boolean;
  /**
   * The record itself, for the form that edits it.
   *
   * The flat fields above are what the table sorts and filters on, already in
   * the reader's language. The form needs the record rather than the words —
   * a role rendered as "Maintenance coordinator" cannot be written back.
   */
  person: User;
};

/**
 * What the search box matches on.
 *
 * Name, employee number, email and site — the four things somebody looking for
 * a person actually types. Role is deliberately not here: it is a facet, and a
 * search that also matched it would make filtering to "Technician" and typing
 * "technician" give different answers for no reason a reader could see.
 */
export function matchesPersonSearch(
  row: PeopleTableRow,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;

  return [
    row.name,
    row.employeeNumber,
    row.email,
    row.siteLabel ?? "",
    // The name as well as the code: somebody looking for the Moncton people
    // types "Moncton", not "MCT", and the column showing the code is not a
    // reason for the search to stop matching what it used to.
    row.siteName ?? "",
  ].some((value) => value.toLowerCase().includes(needle));
}
