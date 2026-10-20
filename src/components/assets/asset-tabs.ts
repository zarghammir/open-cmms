/**
 * The asset page's sections.
 *
 * They are navigations, not an in-page widget: each one puts itself in the
 * address, so a section survives a reload, can be linked to, and can be
 * photographed. That is also why they are rendered as links with
 * `aria-current` rather than with `role="tab"` — a control that changes the
 * address should not announce itself as a tab, and a screen reader that is
 * told "tab" expects the page not to move.
 *
 * One list, so the navigation, the panel that renders and the keyboard order
 * cannot disagree about what sections exist.
 */
export const ASSET_TABS = [
  "overview",
  "history",
  "workOrders",
  "maintenance",
  "inspections",
  "documents",
  "parts",
  "label",
] as const;

export type AssetTab = (typeof ASSET_TABS)[number];

export const DEFAULT_ASSET_TAB: AssetTab = "overview";

/**
 * An address naming a section this page does not have is a broken link, not an
 * empty page: it falls back to the first section, which is what the navigation
 * will then show as current.
 */
export function resolveAssetTab(value: string | null | undefined): AssetTab {
  return (ASSET_TABS as readonly string[]).includes(value ?? "")
    ? (value as AssetTab)
    : DEFAULT_ASSET_TAB;
}
