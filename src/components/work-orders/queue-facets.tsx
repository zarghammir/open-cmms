"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "cn";

/**
 * The queue's facets.
 *
 * Not `DataTableFacetFilter`, and the difference is the point rather than an
 * oversight. That one binds to a column, holds its own state and filters by the
 * values present in that column — exactly right for the assets table. These
 * live in the address, because a filtered queue has to be linkable, and two of
 * them are not column values at all: the due window is derived from a date
 * against today, and "assigned to" has three answers where the record has two
 * fields. A column-bound control cannot express either.
 *
 * Every option a facet offers is always offered, whether or not any row
 * currently has it. A facet that hides its empty options tells a coordinator
 * that a status does not exist when what is true is that nothing is in it.
 */

export function MultiFacet<T extends string>({
  label,
  options,
  selected,
  optionLabel,
  onChange,
}: {
  label: string;
  options: readonly T[];
  selected: readonly T[];
  optionLabel: (value: T) => string;
  onChange: (next: T[]) => void;
}) {
  const t = useTranslations("workOrderQueue.facets");

  function toggle(value: T) {
    onChange(
      selected.includes(value)
        ? selected.filter((candidate) => candidate !== value)
        : [...selected, value],
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          /*
           * The accessible name says what the control does, not just what it is
           * about. The table's own column header is also called "Status", and
           * two buttons with one name is a screen reader reading the same words
           * for a sort and a filter.
           */
          aria-label={t("filterBy", { facet: label })}
        >
          {label}
          {selected.length > 0 ? (
            <span className="ml-1 rounded-sm bg-secondary px-1 text-2xs tabular-nums">
              {selected.length}
            </span>
          ) : null}
          <ChevronDown data-icon="inline-end" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option}
            checked={selected.includes(option)}
            onCheckedChange={() => toggle(option)}
          >
            {optionLabel(option)}
          </DropdownMenuCheckboxItem>
        ))}
        {selected.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <button
              type="button"
              onClick={() => onChange([])}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <X aria-hidden="true" className="size-3.5" />
              {t("clearOne", { facet: label })}
            </button>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SingleFacet<T extends string>({
  label,
  options,
  value,
  optionLabel,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  optionLabel: (value: T) => string;
  onChange: (next: T) => void;
}) {
  const t = useTranslations("workOrderQueue.facets");
  const chosen = options.find((option) => option === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={t("filterBy", { facet: label })}
        >
          <span
            className={cn(chosen === options[0] && "text-muted-foreground")}
          >
            {optionLabel(value)}
          </span>
          <ChevronDown data-icon="inline-end" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(next as T)}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {optionLabel(option)}
              {option === value ? (
                <Check aria-hidden="true" className="ml-auto size-3.5" />
              ) : null}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
