import { expect, test } from "@playwright/test";
import { buildSeed } from "@/data/seed";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import {
  VIEWPORTS,
  hydrated,
  useRole,
  watchConsole,
  withoutServiceWorker,
} from "../fixtures/shell";

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

const seed = buildSeed(new Date());

/** A part the seed has actually moved, so the ledger has something to draw. */
const moved = seed.parts.find((part) =>
  seed.inventoryTransactions.some((one) => one.partId === part.id),
)!;

test.describe("one part", () => {
  test("opens from the register by its stock number", async ({
    context,
    page,
  }) => {
    /*
     * Through the register rather than by typing the address, because the link
     * is half of what is being tested: a detail page nothing reaches is a page
     * nobody opens.
     */
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/en/inventory");
    await hydrated(page);

    const first = page
      .locator('[data-slot="data-table"] tbody tr td:first-child a')
      .first();
    await expect(first).toBeVisible();
    const number = (await first.innerText()).trim();
    expect(number, "the first row carries no stock number").not.toBe("");

    await first.click();

    await expect(
      page.getByRole("heading", { name: number, exact: true }),
    ).toBeVisible();
  });

  test("draws the movements recorded against it", async ({ context, page }) => {
    const watcher = watchConsole(page);
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(`/en/inventory/${moved.partNumber}`);
    await hydrated(page);

    // The seed's own count, computed rather than typed, so the assertion cannot
    // become a claim about a number somebody edited the seed out from under.
    const expected = seed.inventoryTransactions.filter(
      (one) => one.partId === moved.id,
    ).length;
    expect(expected, "this part has no seeded movements").toBeGreaterThan(0);

    const rows = page.locator('[data-slot="part-ledger"] li');
    await expect(rows).toHaveCount(expected);
    expect(watcher.errors).toEqual([]);
  });

  test("a stock number this system does not hold is named back", async ({
    context,
    page,
  }) => {
    // Not the "no matches" panel: somebody is holding a label or has scanned a
    // code, and the first thing they do is check they read it right.
    await useRole(context, "maintenanceCoordinator");
    await page.goto("/en/inventory/FLT-0000-NOPE");
    await hydrated(page);

    /*
     * Scoped, because the number is named back in **two** places and both are
     * right: the page heading, which the server renders from the address, and
     * the panel's own sentence. An unscoped `getByText` matches both and
     * Playwright refuses — a locator matching two controls is a worse
     * instrument than none, and the ambiguity was mine rather than the
     * screen's.
     */
    await expect(
      page.getByRole("heading", { name: "FLT-0000-NOPE", exact: true }),
    ).toBeVisible();
    await expect(page.locator('[data-slot="empty-description"]')).toContainText(
      "FLT-0000-NOPE",
    );
    await expect(
      page.getByRole("link", { name: en.partDetail.backToRegister }),
    ).toBeVisible();
  });

  test("a stock number typed in the wrong case still resolves", async ({
    context,
    page,
  }) => {
    /*
     * The repository folds case, and this is that fix through the real path
     * rather than through the unit test alone. A scanned code arrives as
     * whatever was printed.
     */
    await useRole(context, "maintenanceCoordinator");
    await page.goto(`/en/inventory/${moved.partNumber.toLowerCase()}`);
    await hydrated(page);

    await expect(
      page.getByRole("heading", { name: moved.partNumber, exact: true }),
    ).toBeVisible();
    // And it is the right part, not merely a page that rendered.
    await expect(page.locator('[data-slot="part-ledger"]')).toBeVisible();
  });

  test("reads as French", async ({ context, page }) => {
    const watcher = watchConsole(page);
    await useRole(context, "maintenanceCoordinator");
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(`/fr/inventory/${moved.partNumber}`);
    await hydrated(page);

    await expect(
      page.getByText(fr.partDetail.ledger.title, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(fr.partDetail.detailsTitle, { exact: true }),
    ).toBeVisible();
    expect(watcher.errors).toEqual([]);
  });
});
