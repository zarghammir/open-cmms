/**
 * Which columns survive a narrower screen.
 *
 * Priority is data, not a stack of CSS rules: a column says how important it
 * is, a width says how much room there is, and one function decides. That is
 * what makes it testable, and it is why every table can answer "why is that
 * column missing at 1024" with a number instead of a media query.
 *
 * Priority 1 is the column without which the row means nothing — the tag, the
 * number. It is never dropped. At phone width the table is not a table at all:
 * rows become cards, and this decides what each card leads with.
 */

export const BREAKPOINTS = ["phone", "tablet", "desktop"] as const;
export type Breakpoint = (typeof BREAKPOINTS)[number];

/** The widths the interface is checked at: 390, 1024 and 1440. */
export const TABLET_FROM = 768;
export const DESKTOP_FROM = 1280;

export function breakpointForWidth(width: number): Breakpoint {
  if (width < TABLET_FROM) return "phone";
  if (width < DESKTOP_FROM) return "tablet";
  return "desktop";
}

/** 1 is never dropped, 2 survives a tablet, 3 is desktop only. */
export type Priority = 1 | 2 | 3;

export interface PrioritisedColumn {
  id: string;
  priority: Priority;
}

const HIGHEST_PRIORITY_SHOWN: Record<Breakpoint, Priority> = {
  phone: 1,
  tablet: 2,
  desktop: 3,
};

export function visibleColumnIds(
  columns: readonly PrioritisedColumn[],
  breakpoint: Breakpoint,
): string[] {
  const limit = HIGHEST_PRIORITY_SHOWN[breakpoint];
  return columns
    .filter((column) => column.priority <= limit)
    .map((column) => column.id);
}

/**
 * The shape TanStack Table wants for column visibility: every column named,
 * with true or false.
 *
 * Every column is named on purpose. A map that only listed the visible ones
 * would leave the rest undefined, and undefined is not false — the table would
 * show them.
 */
export function columnVisibilityFor(
  columns: readonly PrioritisedColumn[],
  breakpoint: Breakpoint,
): Record<string, boolean> {
  const visible = new Set(visibleColumnIds(columns, breakpoint));
  return Object.fromEntries(
    columns.map((column) => [column.id, visible.has(column.id)]),
  );
}
