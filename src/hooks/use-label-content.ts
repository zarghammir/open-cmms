"use client";

import { useLocale } from "next-intl";
import { useMemo } from "react";
import { localePrefixes, resolveLocale } from "@/i18n/routing";
import type { LabelContent, LabelLookup } from "@/lib/label";
import { textFor } from "@/lib/localized-text";
import { labelUrl, type ScanKind } from "@/lib/scan";
import { hasRecords, useRepositories } from "./use-demo-data";
import { useOrigin } from "./use-origin";

/**
 * Assembles one label from the records.
 *
 * The identifier is the tag or the stock number, not an `Id`: that is what the
 * address carries, and it is what survives a demonstration reset.
 */
export function useLabelContent(
  kind: ScanKind,
  identifier: string,
): LabelLookup {
  const { status, repositories } = useRepositories();
  const origin = useOrigin();
  const locale = resolveLocale(useLocale());

  return useMemo<LabelLookup>(() => {
    if (!hasRecords(status) || !repositories) {
      return { state: "unknown" };
    }

    const prefix = localePrefixes[locale].replace("/", "");
    // The origin is only unknown during server rendering; the label still
    // assembles, and the QR alone waits for it.
    const url = origin ? labelUrl(origin, prefix, kind, identifier) : null;

    if (kind === "asset") {
      const asset = repositories.assets.byTag(identifier);
      if (!asset) {
        return { state: "missing" };
      }
      const room = repositories.assets.locationOf(asset);
      const facility = repositories.facilities.byId(asset.facilityId);
      // The type's label, not the asset's name. The seed builds a name as
      // "<type> <tag>", so a label already showing the tag in large type would
      // print it twice — on a sticker, where the space is worth more than the
      // repetition. The type label is the half that says what the thing is.
      const type = repositories.assets.typeOf(asset);
      const content: LabelContent = {
        kind,
        identifier: asset.assetTag,
        name: type ? textFor(type.label, locale) : textFor(asset.name, locale),
        placeCode: room?.code ?? "",
        placeName: facility ? textFor(facility.name, locale) : "",
        url,
      };
      return { state: "found", content };
    }

    const part = repositories.parts.byNumber(identifier);
    if (!part) {
      return { state: "missing" };
    }
    const bin = repositories.facilities.binById(part.inventoryLocationId);
    const facility = repositories.facilities.byId(part.facilityId);
    const content: LabelContent = {
      kind,
      identifier: part.partNumber,
      name: textFor(part.name, locale),
      placeCode: bin?.code ?? "",
      placeName: facility ? textFor(facility.name, locale) : "",
      url,
    };
    return { state: "found", content };
  }, [status, repositories, origin, locale, kind, identifier]);
}
