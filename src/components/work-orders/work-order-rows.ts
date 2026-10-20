import type {
  Id,
  IsoDate,
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderType,
} from "@/domain/types";

/**
 * One row of the work-order queue.
 *
 * A type alias rather than an interface, for the reason `asset-rows.ts` gives:
 * TanStack's `RowData` constraint is `Record<string, any>` and an interface has
 * no implicit index signature.
 *
 * Flat and already in the reader's language, so sorting orders by the words a
 * person can see — which in French is a different order from English, and
 * should be.
 */
export type WorkOrderRow = {
  id: Id;
  number: string;
  title: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  type: WorkOrderType;
  assetId: Id;
  assetTag: string;
  facilityId: Id;
  facilityName: string;
  /**
   * The city, for the column that has to fit.
   *
   * Beside the full name rather than instead of it: the name is what the card
   * at 390 shows and what the desktop column carries as its accessible name,
   * while the column itself renders this. Four of the five sites are
   * "Laboratoire régional de …", so the name's first twenty-three characters
   * distinguish nothing and the city is the whole of what a reader is looking
   * for.
   */
  facilityCity: string;
  dueOn: IsoDate | null;
  /** Whole days past the due date, at least 1. Null when the work is not late. */
  daysLate: number | null;
  requestedAt: string;
  /**
   * Who is doing it, as three answers rather than two.
   *
   * A person's name when the order is assigned to someone; the crew code when
   * a legacy import named a crew this organisation cannot resolve to a person;
   * null when nobody has picked it up. A screen that folded the middle case
   * into "unassigned" would be telling a coordinator that work nobody is
   * tracking is work nobody has.
   */
  assigneeUserId: Id | null;
  assigneeName: string | null;
  crewCode: string | null;
};

/**
 * Whether a row matches what someone typed.
 *
 * The number, the title and the asset tag. Not the description: a search that
 * matches body text turns a queue into a document search, and a result list
 * nobody can predict is worse than a short one. `asset-rows.ts` draws the same
 * line for the same reason.
 */
export function matchesWorkOrderSearch(
  row: WorkOrderRow,
  query: string,
): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (needle.length === 0) return true;

  return [row.number, row.title, row.assetTag].some((value) =>
    value.toLocaleLowerCase().includes(needle),
  );
}

/** Who a row counts as being assigned to, for the facet. */
export type AssigneeFacet = "anyone" | "unassigned" | "crew" | Id;

export function matchesAssignee(
  row: WorkOrderRow,
  facet: AssigneeFacet,
): boolean {
  switch (facet) {
    case "anyone":
      return true;
    case "unassigned":
      // Nobody, and no crew either. An order carrying a crew code is somebody's
      // problem even when this system cannot say whose.
      return row.assigneeUserId === null && row.crewCode === null;
    case "crew":
      return row.assigneeUserId === null && row.crewCode !== null;
    default:
      return row.assigneeUserId === facet;
  }
}

/** The windows a due date can fall in. `none` is "no due date at all". */
export const DUE_WINDOWS = [
  "any",
  "overdue",
  "today",
  "week",
  "month",
  "none",
] as const;
export type DueWindow = (typeof DUE_WINDOWS)[number];

export function isDueWindow(value: string): value is DueWindow {
  return (DUE_WINDOWS as readonly string[]).includes(value);
}
