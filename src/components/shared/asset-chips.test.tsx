// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import {
  ASSET_CRITICALITY_PRESENTATION,
  ASSET_STATUS_PRESENTATION,
} from "@/domain/constants/asset-status";
import { INSPECTION_STATUS_PRESENTATION } from "@/domain/constants/inspection-status";
import { ASSET_CRITICALITIES, ASSET_STATUSES } from "@/domain/types/asset";
import { INSPECTION_STATUSES } from "@/domain/types/inspection";
import { InspectionStatusChip } from "./inspection-chip";
import { AssetCriticalityChip, AssetStatusChip } from "./asset-chips";

function withMessages(ui: ReactNode) {
  return render(
    <NextIntlClientProvider
      locale="en-CA"
      messages={en}
      timeZone="America/Toronto"
    >
      {ui}
    </NextIntlClientProvider>,
  );
}

function hasIcon(label: string): boolean {
  return (
    screen
      .getByText(label)
      .closest("[data-slot='status-chip']")
      ?.querySelector("svg") !== null
  );
}

describe("asset and inspection chips", () => {
  it("draws every asset status with a label and an icon", () => {
    for (const status of ASSET_STATUSES) {
      withMessages(<AssetStatusChip status={status} />);
      expect(hasIcon(en.assetStatus[status])).toBe(true);
    }
  });

  it("draws every criticality with a label and an icon", () => {
    for (const criticality of ASSET_CRITICALITIES) {
      withMessages(<AssetCriticalityChip criticality={criticality} />);
      expect(hasIcon(en.criticality[criticality])).toBe(true);
    }
  });

  it("draws every inspection result with a label and an icon", () => {
    // The one where colour alone would matter most: passed and failed.
    for (const status of INSPECTION_STATUSES) {
      withMessages(<InspectionStatusChip status={status} />);
      expect(hasIcon(en.inspectionStatus[status])).toBe(true);
    }
  });

  it("keeps each presentation map and the namespace its chip reads in step", () => {
    // The chips look a label up in a namespace; the maps name the same key in
    // full. Nothing makes them agree at run time, so it is asserted here —
    // repointing one without the other is how a status quietly starts reading
    // as the wrong word.
    for (const status of ASSET_STATUSES) {
      expect(ASSET_STATUS_PRESENTATION[status].labelKey).toBe(
        `assetStatus.${status}`,
      );
    }
    for (const criticality of ASSET_CRITICALITIES) {
      expect(ASSET_CRITICALITY_PRESENTATION[criticality].labelKey).toBe(
        `criticality.${criticality}`,
      );
    }
    for (const status of INSPECTION_STATUSES) {
      expect(INSPECTION_STATUS_PRESENTATION[status].labelKey).toBe(
        `inspectionStatus.${status}`,
      );
    }
  });

  it("is checking real sets", () => {
    // Without this the loops above would pass while iterating nothing.
    expect(ASSET_STATUSES.length).toBe(3);
    expect(ASSET_CRITICALITIES.length).toBe(4);
    expect(INSPECTION_STATUSES.length).toBe(4);
  });
});
