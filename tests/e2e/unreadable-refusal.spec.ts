import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import {
  failTheNextRead,
  hydrated,
  useRole,
  withoutServiceWorker,
} from "../fixtures/shell";
import { settledAuditCount, storedAuditCount } from "../fixtures/storage";

/**
 * A screen that cannot show anything says so, and says what to do.
 *
 * WA-58 stopped a failed read being mistaken for an empty browser. What it left
 * was a skeleton with no end — and on the scan screen, worse than that: WA-68
 * took the camera away correctly, but the page heading above it still read
 * "Point the camera at a label, or upload a photo of one", so the screen went
 * on inviting exactly what it was refusing.
 *
 * That is the assertion this spec exists for and the one a banner-above-the-page
 * design would fail: **the invitation is gone**, not merely outvoted by a notice
 * above it. The refusal replaces the page rather than joining it.
 *
 * Both languages, because every word of it is translated and an English-only
 * run would not see a French screen still inviting a scan.
 */

type Prefix = "en" | "fr";

const LOCALES: Prefix[] = ["en", "fr"];

const copy = {
  en: {
    title: en.states.unreadable.title,
    reload: en.states.unreadable.reload,
    invitation: en.scan.description,
    camera: en.scan.startCamera,
    sheet: en.verify.sheetTitle,
  },
  fr: {
    title: fr.states.unreadable.title,
    reload: fr.states.unreadable.reload,
    invitation: fr.scan.description,
    camera: fr.scan.startCamera,
    sheet: fr.verify.sheetTitle,
  },
} as const;

/**
 * Proof the failure reached the application, before anything is said about what
 * is missing. Without it every absence below is satisfied by a page that never
 * loaded — and "no camera" on a blank screen is not a passing test, it is no
 * test.
 */
async function readFailed(page: Page) {
  await expect(
    page.locator('[data-demo-status="unreadable"]'),
    "the forced failure never reached the store: nothing below is being tested",
  ).toBeAttached({ timeout: 15_000 });
}

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

for (const prefix of LOCALES) {
  test(`the scan screen refuses by name rather than inviting a scan (${prefix})`, async ({
    context,
    page,
  }) => {
    const words = copy[prefix];
    await useRole(context, "technician");
    await failTheNextRead(page);
    await page.goto(`/${prefix}/my-work/scan`);

    await readFailed(page);

    // What it says.
    await expect(page.getByText(words.title)).toBeVisible();

    // And what it no longer says. The heading's description is page-level copy
    // outside the panel, so this is the half WA-68 could not reach.
    await expect(
      page.getByText(words.invitation),
      "the screen still invites a scan it cannot perform",
    ).toHaveCount(0);

    await expect(page.getByRole("button", { name: words.camera })).toHaveCount(
      0,
    );
    await expect(page.locator('input[type="file"]')).toHaveCount(0);

    // No skeleton either: a refusal and an endless loading state are different
    // answers, and this state has stopped being the second one.
    expect(await page.locator('[data-slot="skeleton"]').count()).toBe(0);
  });

  test(`the count sheet refuses by name (${prefix})`, async ({
    context,
    page,
  }) => {
    const words = copy[prefix];
    await useRole(context, "technician");
    await failTheNextRead(page);
    await page.goto(`/${prefix}/inventory/verify`);

    await readFailed(page);

    await expect(page.getByText(words.title)).toBeVisible();
    await expect(page.getByRole("heading", { name: words.sheet })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: words.camera })).toHaveCount(
      0,
    );
  });
}

test("the reload control is reachable from the keyboard and brings the records back", async ({
  context,
  page,
}) => {
  await useRole(context, "maintenanceCoordinator");

  // A healthy load first, so there are records to lose — and a count to compare
  // against afterwards. Without this the test would prove only that an empty
  // browser stays empty.
  await page.goto("/en/dashboard");
  await hydrated(page);
  /*
   * Read once the boot has finished writing, not once the screen says ready.
   *
   * `hydrated` waits for the store's status, and the seed's write lands after
   * it: between them the blob on disk is the one `onRehydrateStorage` wrote,
   * whose `data` is null, and a read there answers −4. That is what turned
   * this test red on a loaded runner at 1.6 s — before any fixture was armed —
   * while the retry passed at 6.5 s. The assertion was right and the
   * measurement was taken too early.
   */
  const before = await settledAuditCount(page);

  /*
   * `transient`, and the test is worthless without it.
   *
   * The instrument runs on every document by default, so the reload this test
   * presses would fail its own read too, and again after that: a browser
   * permanently unable to read is one no "Try again" can rescue, and the test
   * timed out waiting for records that could never come back. The default is
   * right for the screens that photograph the state; this case is the one that
   * has to leave it. A real read failure that never clears is what the
   * refusal's last line is for — it points at Settings — and that is a
   * different test from this one.
   */
  await failTheNextRead(page, { transient: true });
  await page.reload();
  await expect(page.locator('[data-demo-status="unreadable"]')).toBeAttached({
    timeout: 15_000,
  });

  const reload = page.locator('[data-slot="records-unreadable-reload"]');
  await expect(reload).toBeVisible();

  // Reached by keyboard, not only by mouse: this is the only way out of the
  // state, and a control a keyboard cannot reach is a dead end for the person
  // most likely to be using one.
  await page.keyboard.press("Tab");
  await expect
    .poll(
      async () => {
        for (let i = 0; i < 20; i += 1) {
          if (
            await reload.evaluate((node) => node === document.activeElement)
          ) {
            return true;
          }
          await page.keyboard.press("Tab");
        }
        return false;
      },
      { timeout: 15_000 },
    )
    .toBe(true);

  await page.keyboard.press("Enter");

  // And out the other side: the records are back, and they are the same records.
  await hydrated(page);
  await expect(page.locator('[data-slot="records-unreadable"]')).toHaveCount(0);
  expect(
    await storedAuditCount(page),
    "the records changed across a failed read and a reload",
  ).toBe(before);
});
