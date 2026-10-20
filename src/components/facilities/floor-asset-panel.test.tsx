// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import type { PlacedAsset } from "@/data/selectors/floor-map";
import type { Asset } from "@/domain/types";
import { TooltipProvider } from "@/components/ui/tooltip";
import { formats } from "@/i18n/formats";
import { FloorAssetPanel } from "./floor-asset-panel";

/**
 * A role that may not raise work still sees the control, and is told why.
 *
 * The rule is the repository's: a capability the role does not hold disables a
 * control and explains it, never hides it. On the map that matters more than
 * elsewhere — an auditor is exactly the person who will be shown this screen to
 * demonstrate that the product is role-based, and a screen that silently gets
 * shorter demonstrates nothing at all.
 *
 * Asserted here rather than only in the browser because it is a property of the
 * markup, and because the browser suite cannot run in every window this screen
 * changes in.
 */

// The locale-aware Link reaches next-intl’s navigation, which resolves
// `next/navigation` in a way jsdom cannot; the dashboard panel tests stub it the
// same way. The link is not what this file is about.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...rest }: { children: ReactNode; href: unknown }) => (
    <a {...rest} href="#">
      {children}
    </a>
  ),
}));

vi.mock("@/hooks/use-demo-data", () => ({
  useRepositories: () => ({ status: "ready", repositories: null }),
  useActor: () => ({ userId: "usr-1", role: "maintenanceCoordinator" }),
}));

const asset = {
  id: "ast-1",
  assetTag: "AHU-MCT-11",
  name: { en: "Air handling unit", fr: "Centrale de traitement d’air" },
} as unknown as Asset;

const selected: PlacedAsset = {
  placement: {
    id: "plc-AHU-MCT-11",
    organizationId: "org-1",
    assetId: "ast-1",
    floorId: "loc-MCT-B01-F1",
    x: 0.5,
    y: 0.5,
    width: 0.1,
    height: 0.1,
  },
  asset,
  state: "clear",
  openCount: 0,
  overdueCount: 0,
  lowParts: 0,
  openOrders: [],
};

function mount(role: "maintenanceCoordinator" | "auditor", one = selected) {
  return render(
    <NextIntlClientProvider
      locale="en-CA"
      messages={en}
      timeZone="America/Toronto"
      formats={formats}
    >
      {/* The shell supplies this in the application; the denied branch of
          `CapabilityAction` is a tooltip and Radix refuses one without it. */}
      <TooltipProvider>
        <FloorAssetPanel selected={one} role={role} />
      </TooltipProvider>
    </NextIntlClientProvider>,
  );
}

describe("the panel beside the plan", () => {
  it("offers the raise control to a role that may raise work", () => {
    mount("maintenanceCoordinator");
    const button = screen.getByRole("button", {
      name: en.floorMap.raiseAction,
    });
    expect(button).toBeEnabled();
  });

  it("shows the auditor the same control, disabled", () => {
    /*
     * Both halves, because either alone is the defect: a control that is gone
     * says the feature does not exist, and one that is present and live says
     * the auditor may use it.
     */
    mount("auditor");
    const button = screen.getByRole("button", {
      name: en.floorMap.raiseAction,
    });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
  });

  it("offers nothing to raise against a marker nobody can read", () => {
    // The counts and the machine travel together: no machine, no claim about
    // its work, and nothing to raise an order against.
    mount("maintenanceCoordinator", {
      ...selected,
      asset: null,
      state: "unreadable",
      openCount: null,
      overdueCount: null,
      lowParts: null,
      openOrders: null,
    });
    expect(
      screen.queryByRole("button", { name: en.floorMap.raiseAction }),
    ).toBeNull();
    expect(
      screen.getByText(en.floorMap.unreadableMarkerTitle),
    ).toBeInTheDocument();
  });
});
