import { describe, expect, it } from "vitest";
import {
  breakpointForWidth,
  columnVisibilityFor,
  visibleColumnIds,
  type PrioritisedColumn,
} from "./column-priority";

const COLUMNS: PrioritisedColumn[] = [
  { id: "tag", priority: 1 },
  { id: "name", priority: 1 },
  { id: "facility", priority: 2 },
  { id: "status", priority: 2 },
  { id: "criticality", priority: 3 },
  { id: "installedAt", priority: 3 },
];

describe("which columns a width can hold", () => {
  it("has columns of every priority to choose between", () => {
    // Without this, a list that was all one priority would make every
    // assertion below pass while distinguishing nothing.
    expect(new Set(COLUMNS.map((column) => column.priority)).size).toBe(3);
  });

  it("maps the three widths the interface is checked at", () => {
    expect(breakpointForWidth(390)).toBe("phone");
    expect(breakpointForWidth(1024)).toBe("tablet");
    expect(breakpointForWidth(1440)).toBe("desktop");
  });

  it("drops columns as the screen narrows, and keeps dropping", () => {
    const desktop = visibleColumnIds(COLUMNS, "desktop");
    const tablet = visibleColumnIds(COLUMNS, "tablet");
    const phone = visibleColumnIds(COLUMNS, "phone");

    // Strictly smaller each time, not merely different: a helper that returned
    // a different set of the same size would satisfy a subset check.
    expect(desktop.length).toBeGreaterThan(tablet.length);
    expect(tablet.length).toBeGreaterThan(phone.length);

    expect(tablet.every((id) => desktop.includes(id))).toBe(true);
    expect(phone.every((id) => tablet.includes(id))).toBe(true);
  });

  it("never drops a column the row would be meaningless without", () => {
    const essential = COLUMNS.filter((column) => column.priority === 1).map(
      (column) => column.id,
    );

    for (const breakpoint of ["phone", "tablet", "desktop"] as const) {
      for (const id of essential) {
        expect(
          visibleColumnIds(COLUMNS, breakpoint),
          `${id} disappeared at ${breakpoint}`,
        ).toContain(id);
      }
    }
  });

  it("names every column in the visibility map, hidden ones included", () => {
    const map = columnVisibilityFor(COLUMNS, "phone");

    // A map that only listed the visible columns would leave the rest
    // undefined, and undefined is not false: the table would show them.
    expect(Object.keys(map).sort()).toEqual(COLUMNS.map((c) => c.id).sort());
    expect(map.tag).toBe(true);
    expect(map.criticality).toBe(false);
    expect(Object.values(map).filter(Boolean)).toHaveLength(2);
  });

  it("would notice if the width stopped mattering", () => {
    // The deletion control: give every column the same priority and the three
    // widths can no longer be told apart, which is the failure this exists to
    // catch.
    const flat: PrioritisedColumn[] = COLUMNS.map((column) => ({
      ...column,
      priority: 1,
    }));

    expect(visibleColumnIds(flat, "phone")).toEqual(
      visibleColumnIds(flat, "desktop"),
    );
    expect(visibleColumnIds(COLUMNS, "phone")).not.toEqual(
      visibleColumnIds(COLUMNS, "desktop"),
    );
  });

  it("says nothing about columns it was not given", () => {
    expect(visibleColumnIds([], "desktop")).toEqual([]);
    expect(columnVisibilityFor([], "desktop")).toEqual({});
  });
});
