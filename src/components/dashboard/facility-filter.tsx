"use client";

import { BuildingComplex, ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LoadingState } from "@/components/shared/state-panels";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Facility, Id } from "@/domain/types";
import { textFor } from "@/lib/localized-text";

/** The empty string is "every site", which is a choice rather than no choice. */
const ALL_SITES = "";

/**
 * Which site the dashboard is about.
 *
 * One control drives every panel on the screen, because the alternative — a
 * filter per panel — is how a reviewer ends up reading a count for one site
 * beside a list for another and believing both.
 *
 * Three states here too, in two places. The menu lists the sites it knows and
 * says it is still reading when it knows none, rather than showing "All sites"
 * alone and implying that is the whole list. And the trigger only claims "All
 * sites" when that is actually the choice: with a site named in the address
 * whose name has not been read back yet, the honest label is that it is still
 * loading, not the name of a different filter.
 *
 * The trigger is never disabled. It was, and `disabled:opacity-50` put it below
 * AA contrast for as long as the read took — an accessibility scan caught it
 * intermittently, which is exactly how long it was unreadable for.
 */
export function FacilityFilter({
  facilities,
  value,
  onChange,
}: {
  facilities: Facility[] | null;
  value?: Id;
  onChange: (facilityId: Id | undefined) => void;
}) {
  const t = useTranslations("dashboard.filter");
  const tLoading = useTranslations("states.loading");
  const locale = useLocale();

  const selected = facilities?.find((facility) => facility.id === value);
  const label = selected
    ? textFor(selected.name, locale)
    : value && facilities === null
      ? tLoading("label")
      : t("allSites");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label={t("label")}>
          <BuildingComplex data-icon="inline-start" aria-hidden="true" />
          {label}
          <ChevronDown data-icon="inline-end" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={value ?? ALL_SITES}
          onValueChange={(next) =>
            onChange(next === ALL_SITES ? undefined : next)
          }
        >
          <DropdownMenuRadioItem value={ALL_SITES}>
            {t("allSites")}
          </DropdownMenuRadioItem>
          {facilities?.map((facility) => (
            <DropdownMenuRadioItem key={facility.id} value={facility.id}>
              {textFor(facility.name, locale)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {facilities === null ? (
          <div className="p-2">
            <LoadingState rows={2} />
          </div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
