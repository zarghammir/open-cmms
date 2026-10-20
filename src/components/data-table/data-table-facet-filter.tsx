"use client";

import { ListFilter } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Column, RowData } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { DataTableFeatures } from "./table-features";
import { createLocaleCompare } from "./locale-sort";
import { isFacetValue, type FacetValue } from "./facets";

/**
 * One facet: the values actually present in the data, with how many rows each
 * accounts for, and a count of what is selected.
 *
 * The options come from the column's faceted values rather than from a
 * hardcoded list, so a filter can never offer a value that matches nothing —
 * and can never omit one that exists.
 */
export function DataTableFacetFilter<
  TData extends RowData,
  TValue extends FacetValue = string,
>({
  column,
  label,
  optionLabel,
}: {
  column: Column<DataTableFeatures, TData, unknown>;
  label: string;
  /**
   * Turns a raw value into its translated name.
   *
   * `TValue` defaults to `string`, so every register that passes
   * `optionLabel={(value) => value}` infers `string` exactly as before and no
   * file outside this folder changed. A column of booleans writes
   * `optionLabel={(value: boolean) => (value ? t("yes") : t("no"))}` and infers
   * `boolean` — which is the point: the label is the screen's business, because
   * only the screen knows that `false` reads "In stock" on one register and
   * "No" on another. Stringifying centrally would have printed "false".
   */
  optionLabel: (value: TValue) => string;
}) {
  // The application's language, not the browser's: `localeCompare` with no
  // locale follows whatever the reader's machine is set to, so a French page on
  // an English machine listed its filter options in English order.
  const locale = useLocale();
  const t = useTranslations("dataTable");
  const compare = createLocaleCompare(locale);
  const selected = new Set((column.getFilterValue() as TValue[]) ?? []);
  const counts = column.getFacetedUniqueValues();
  const keys = [...counts.keys()];

  /*
   * Everything the facet can offer, and a named complaint about anything else.
   *
   * This was `.filter(typeof value === "string")`, so a column of booleans or
   * numbers produced an empty menu with no error at all: the button appeared,
   * opened, and showed nothing. In a browser test the only symptom was a click
   * on a locator that was never going to match, timing out half a minute later
   * and pointing at the assertion rather than at the cause. Absence read as
   * nothing, in shared infrastructure every register uses.
   */
  const options = (keys.filter(isFacetValue) as TValue[]).sort((a, b) =>
    compare(optionLabel(a), optionLabel(b)),
  );

  const unusable = keys.filter((value) => !isFacetValue(value));
  if (unusable.length > 0 && process.env.NODE_ENV !== "production") {
    /*
     * Loud, in development, naming the column and the shapes.
     *
     * A `console.error` rather than a throw: a facet that cannot describe one
     * of its values should not take the screen down for somebody who only
     * wanted to filter. The menu still says "Nothing to filter on" below, so
     * the reader is answered either way; this line is for whoever has to fix
     * the column.
     *
     * **Where it is actually enforced**, since the guard below decides that:
     * `data-table-facet-filter.test.tsx` spies on `console.error` and asserts
     * the column and the shape are named. That is the check that fails if this
     * goes quiet. In a browser it reaches a developer running `next dev`, and
     * nobody else — the browser suite runs `npm run build && npm run start`, a
     * production build, so `NODE_ENV !== "production"` is false there and this
     * whole branch is compiled away.
     *
     * An earlier version of this comment claimed the browser suite watched the
     * console and would fail on it. It cannot: it is the one run this line does
     * not exist in. Recorded rather than quietly replaced, because the sentence
     * read as evidence and was the opposite.
     */
    const shapes = [
      ...new Set(
        unusable.map((value) => (value === null ? "null" : typeof value)),
      ),
    ].join(", ");
    console.error(
      `DataTableFacetFilter: column "${column.id}" has ${unusable.length} value(s) the facet cannot offer (${shapes}). ` +
        `A facet offers strings, numbers and booleans; anything else needs the column to map it to one of those first.`,
    );
  }

  function toggle(value: TValue) {
    const next = new Set(selected);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    // An empty selection is no filter at all, not a filter matching nothing.
    column.setFilterValue(next.size > 0 ? [...next] : undefined);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <ListFilter data-icon="inline-start" />
          {label}
          {selected.size > 0 ? (
            <Badge variant="secondary" className="ml-1">
              {selected.size}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-52">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.length === 0 ? (
          /*
           * Named, never blank.
           *
           * A menu that opens on nothing is the defect this ticket is about,
           * one layer along: the reader is told nothing and cannot tell a
           * column with no values from a control that is broken. The
           * development complaint above is compiled out of production, so
           * without this line the production symptom would be exactly the
           * silence that started all of it.
           */
          <DropdownMenuItem disabled>{t("noFilterValues")}</DropdownMenuItem>
        ) : null}
        {options.map((value) => (
          <DropdownMenuCheckboxItem
            // Stringified for React's key only — `false` is a value the facet
            // offers but not one React accepts as a key. The value itself stays
            // raw everywhere it matters: the label, the selection and the
            // filter all see the boolean.
            key={String(value)}
            checked={selected.has(value)}
            onCheckedChange={() => toggle(value)}
          >
            <span className="flex w-full items-center justify-between gap-3">
              <span>{optionLabel(value)}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {counts.get(value)}
              </span>
            </span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
