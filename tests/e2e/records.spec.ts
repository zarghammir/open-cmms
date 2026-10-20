import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import {
  hydrated,
  watchConsole,
  withoutServiceWorker,
} from "../fixtures/shell";

// WA-15 registers a service worker that caches HTML. Every spec but its
// own asserts against a fresh response, so the worker is removed first:
// a cached page would let a test quietly pass against a build that is no
// longer on disk.
test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

/**
 * The records, in a real browser.
 *
 * WA-26 adds no table of its own — WA-27 does that — so the observable proof
 * that the store works end to end is the notifications count in the header: it
 * is computed from seeded work orders, parts and inspections through the
 * repositories, and it only appears once IndexedDB has been read.
 */

/** The badge is the unread count. It is deliberately not shown at zero. */
async function unreadCount(page: Page) {
  const bell = page.getByRole("button", {
    name: new RegExp(en.shell.notifications.label),
  });
  await expect(bell).toBeVisible();
  const badge = bell.locator("span[aria-hidden='true']");
  await expect(badge).toBeVisible();
  return Number.parseInt((await badge.innerText()).trim(), 10);
}

test.describe("demonstration records", () => {
  test("fill themselves on the first visit and reach the header", async ({
    page,
  }) => {
    const watcher = watchConsole(page);
    await page.goto("/en/dashboard");
    await hydrated(page);

    const count = await unreadCount(page);
    expect(count).toBeGreaterThan(0);

    // The count comes from the records, not from a hardcoded number: the
    // popover says the same thing in words.
    await page
      .getByRole("button", { name: new RegExp(en.shell.notifications.label) })
      .click();
    await expect(page.getByText(`${count} unread`)).toBeVisible();
    expect(watcher.errors).toEqual([]);
  });

  test("survive a reload", async ({ page }) => {
    await page.goto("/en/dashboard");
    const first = await unreadCount(page);

    await page.reload();
    expect(await unreadCount(page)).toBe(first);
  });

  test("come back after the demonstration is reset", async ({ page }) => {
    await page.goto("/en/settings");
    await hydrated(page);
    const before = await unreadCount(page);

    await page.getByRole("button", { name: en.demo.reset }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: en.demo.confirmAction }).click();

    await expect(page).toHaveURL(/\/en\/dashboard$/);
    // Rebuilt for today from the same generator, so the same records return.
    expect(await unreadCount(page)).toBe(before);
  });
});
