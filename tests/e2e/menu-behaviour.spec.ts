import { expect, test } from "@playwright/test";
import en from "../../messages/en.json";
import { hydrated, useRole, withoutServiceWorker } from "../fixtures/shell";

/**
 * The behaviours a menu owes, checked on a destructive row-action menu.
 *
 * WA-49 made the vendored menu non-modal, which gives up focus trapping, scroll
 * locking and outside-pointer blocking. None of those is what a menu owes —
 * these are. They were asked for as a hand check; they are scripted instead,
 * because the trade is permanent and so should its guard be: a hand check is
 * true of the afternoon somebody did it, and this is true of every build.
 */

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

/**
 * The register, with its rows drawn — not merely with its store ready.
 *
 * `hydrated` says the records are there; it does not say the table has rendered
 * them, and the row-action triggers do not exist until it has. Taking `.last()`
 * before that picks the toolbar's column menu, and then the rows arrive and
 * replace what was picked. `click()` hides this by re-resolving and waiting for
 * stability; `focus()` does not, which is why the keyboard case was the one
 * that failed, and only under the contention of the full suite.
 */
async function assetsWithRows(page: import("@playwright/test").Page) {
  await page.goto("/en/assets");
  await hydrated(page);
  await expect(
    page.locator(
      '[data-slot="data-table"] [data-slot="dropdown-menu-trigger"]',
    ),
    "the register drew no rows, so there is no row-action menu to check",
  ).not.toHaveCount(0);
  return page
    .locator('[data-slot="data-table"] [data-slot="dropdown-menu-trigger"]')
    .first();
}

async function openRowActions(page: import("@playwright/test").Page) {
  const trigger = await assetsWithRows(page);
  await trigger.click();
  await expect(page.locator('[role="menu"]')).toHaveCount(1);
  return trigger;
}

/*
 * Opened by POINTER, focus lands on the menu, not on an item — and my first
 * draft asserted the opposite and failed. The control settled it: with `modal`
 * put back to Radix's default the same two cases failed identically, so this is
 * how the menu has always behaved on a click and not something the fix changed.
 * It is also correct: the WAI-ARIA menu button pattern focuses the first item
 * when the menu is opened from the KEYBOARD, and a pointer user has a pointer.
 *
 * Both openings are checked rather than one, because "the first item is focused
 * on open" is true of only one of them, and a test that asserted it of both
 * would have been reporting a defect that does not exist.
 */
test("opened by pointer, focus is in the menu and the arrows walk it", async ({
  context,
  page,
}) => {
  await useRole(context, "maintenanceCoordinator");
  await openRowActions(page);

  await expect(page.locator('[role="menu"]')).toBeFocused();

  const items = page.locator('[role="menuitem"]');
  const count = await items.count();
  expect(count, "the menu has too few items to move between").toBeGreaterThan(
    1,
  );

  await page.keyboard.press("ArrowDown");
  await expect(items.first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(items.nth(1)).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(items.first()).toBeFocused();
});

test("opened from the keyboard, the first item takes focus", async ({
  context,
  page,
}) => {
  await useRole(context, "maintenanceCoordinator");
  const trigger = await assetsWithRows(page);
  await trigger.focus();
  await page.keyboard.press("Enter");

  await expect(page.locator('[role="menu"]')).toHaveCount(1);
  await expect(page.locator('[role="menuitem"]').first()).toBeFocused();
});

test("Escape closes the menu and gives focus back to the trigger", async ({
  context,
  page,
}) => {
  await useRole(context, "maintenanceCoordinator");
  const trigger = await openRowActions(page);

  await page.keyboard.press("Escape");
  await expect(page.locator('[role="menu"]')).toHaveCount(0);
  // The half a non-modal menu could plausibly lose: focus must come back to
  // where the person left it, not to the top of the document.
  await expect(trigger).toBeFocused();
});

test("a click outside closes the menu", async ({ context, page }) => {
  await useRole(context, "maintenanceCoordinator");
  await openRowActions(page);

  await page.getByRole("heading").first().click();
  await expect(page.locator('[role="menu"]')).toHaveCount(0);
});
