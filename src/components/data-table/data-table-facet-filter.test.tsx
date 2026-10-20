// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import { DataTableFacetFilter } from "./data-table-facet-filter";
import type { DataTableFeatures } from "./table-features";
import { useDataTable } from "./use-data-table";

/**
 * A facet over a column whose values are not strings.
 *
 * The reproduction first, because the defect's whole character is that it is
 * silent: the toolbar button appears, opens, and shows nothing. No error, no
 * empty state, no clue. In a browser test the only symptom is a click on a
 * locator that was never going to match, timing out thirty seconds later and
 * pointing at the assertion rather than at the cause.
 *
 * Built through the real path — a real table from `useDataTable`, the real
 * component, the menu opened the way a person opens it — because a hand-made
 * column stub would be a fake that cannot disagree with the component about
 * what `getFacetedUniqueValues` returns, which is the very thing in question.
 */

/*
 * jsdom has no `matchMedia`, and `useDataTable` reads it through
 * `useBreakpoint` to decide which columns a width can hold.
 *
 * Worth stubbing deliberately rather than reaching for a global setup: without
 * it this test goes red with `window.matchMedia is not a function` from a file
 * it is not testing — a red that looks exactly like the defect being
 * reproduced, in a test written to reproduce a defect. The assertion below has
 * to be the thing that fails, or it is measuring the harness.
 */
beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

interface Visit {
  name: string;
  /** The shape the facet dropped. */
  overdue: boolean;
  /** A number, which it also dropped. */
  floor: number;
  /** A string, which always worked and must keep working. */
  site: string;
  /** Nothing the facet can offer: it has to say so rather than drop it. */
  note: { text: string } | null;
}

const VISITS: Visit[] = [
  { name: "Boiler service", overdue: true, floor: 2, site: "KGN", note: null },
  { name: "Filter change", overdue: false, floor: 1, site: "REG", note: null },
  { name: "Belt inspection", overdue: true, floor: 2, site: "KGN", note: null },
];

const columnHelper = createColumnHelper<DataTableFeatures, Visit>();

function Harness<TValue extends string | number | boolean>({
  columnId,
  optionLabel,
}: {
  columnId: "overdue" | "floor" | "site" | "note";
  optionLabel: (value: TValue) => string;
}) {
  const columns = [
    columnHelper.accessor("name", { id: "name", header: "Name" }),
    columnHelper.accessor("overdue", { id: "overdue", header: "Overdue" }),
    columnHelper.accessor("floor", { id: "floor", header: "Floor" }),
    columnHelper.accessor("site", { id: "site", header: "Site" }),
    columnHelper.accessor("note", { id: "note", header: "Note" }),
  ] as ColumnDef<DataTableFeatures, Visit, unknown>[];

  const { table } = useDataTable({
    data: VISITS,
    columns,
    priorities: [
      { id: "name", priority: 1 },
      { id: "overdue", priority: 1 },
      { id: "floor", priority: 1 },
      { id: "site", priority: 1 },
      { id: "note", priority: 1 },
    ],
  });

  return (
    <DataTableFacetFilter
      column={table.getColumn(columnId)!}
      label={columnId}
      optionLabel={optionLabel}
    />
  );
}

function show<TValue extends string | number | boolean>(
  columnId: "overdue" | "floor" | "site" | "note",
  optionLabel: (value: TValue) => string,
) {
  return render(
    <NextIntlClientProvider
      locale="en-CA"
      messages={en}
      timeZone="America/Toronto"
    >
      <Harness columnId={columnId} optionLabel={optionLabel} />
    </NextIntlClientProvider>,
  );
}

/** Opens the facet the way a person does, and returns its options in order. */
async function openFacet(columnId: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: new RegExp(columnId) }));
  return screen.findAllByRole("menuitemcheckbox");
}

describe("a facet over values that are not strings", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("offers a boolean column's values, labelled the way the screen reads them", async () => {
    show<boolean>("overdue", (value) => (value ? "Overdue" : "On time"));

    const options = await openFacet("overdue");

    // The labels, not "true" and "false": only the screen knows what its own
    // boolean means, which is why the label stayed the caller's job.
    expect(options.map((one) => one.textContent)).toEqual([
      "On time1",
      "Overdue2",
    ]);
  });

  it("offers a numeric column's values", async () => {
    show<number>("floor", (value) => `Floor ${value}`);

    const options = await openFacet("floor");

    expect(options.map((one) => one.textContent)).toEqual([
      "Floor 11",
      "Floor 22",
    ]);
  });

  it("leaves a column of strings exactly as it was", async () => {
    /*
     * The control for the widening itself. Every register on main facets on
     * strings, so a change that fixed booleans and disturbed the common path
     * would be a worse defect than the one being fixed — and the three
     * assertions above would not have noticed.
     */
    show<string>("site", (value) => value);

    const options = await openFacet("site");

    expect(options.map((one) => one.textContent)).toEqual(["KGN2", "REG1"]);
  });

  it("names a shape it cannot offer instead of dropping it in silence", async () => {
    /*
     * `null` is the honest case: a nullable column is ordinary, and until now
     * its values vanished from the menu without a word. The facet cannot guess
     * whether that reads "Unassigned" or "None" — only the column knows — so it
     * says which column and which shape, and the browser suite fails on a
     * console error rather than on a click that times out somewhere else.
     */
    const complaint = vi.spyOn(console, "error").mockImplementation(() => {});

    show<string>("note", (value) => String(value));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /note/ }));

    // Named, not blank. Every value on this column is unusable, so there is
    // nothing to offer — and a menu that opens on nothing is the same silence
    // one layer along. The development complaint is compiled out of
    // production; this line is what a reader sees there.
    expect(
      await screen.findByText(en.dataTable.noFilterValues),
    ).toBeInTheDocument();

    expect(complaint).toHaveBeenCalledTimes(1);
    const said = String(complaint.mock.calls[0]?.[0] ?? "");
    expect(said).toContain('column "note"');
    expect(said).toContain("null");
  });
});
