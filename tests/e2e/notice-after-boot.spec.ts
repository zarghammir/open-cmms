import { expect, test } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import {
  hydrated,
  useRole,
  VIEWPORTS,
  withoutServiceWorker,
} from "../fixtures/shell";
import {
  allowWrites,
  failedOpenCount,
  failWritesFromNow,
  installSlowWrites,
  withoutStorage,
  settledAuditCount,
  storedAuditCount,
} from "../fixtures/storage";

/**
 * The standing notice notices, which it did not until WA-85.
 *
 * It exists because a toast can be missed: a person filling in a count sheet on
 * a device that has quietly stopped keeping anything should be told for as long
 * as that is true, not for four seconds. But `durable` was copied into the
 * store once, at rehydration, and nothing ever asked again — so the notice only
 * appeared when the **boot** already knew, and stayed silent for the whole case
 * it was built for. Measured on WA-66: two opens failed, the toast appeared,
 * the notice did not.
 *
 * Through the real path, in a browser, because that is the only place this
 * defect exists. Every unit harness sets the store's fields directly, so each
 * one can put `durable: false` in and watch the notice draw — and all of them
 * would have stayed green while the application could not reach that state at
 * all.
 */

const LANGUAGES = [
  { prefix: "en", words: en },
  { prefix: "fr", words: fr },
] as const;

const NOTICE = '[data-slot="not-saving-banner"]';

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

for (const { prefix, words } of LANGUAGES) {
  test(`the notice appears when a write fails after the boot, and clears when one lands (${prefix})`, async ({
    context,
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await installSlowWrites(page);
    await useRole(context, "maintenanceCoordinator");
    await page.goto(`/${prefix}/work-orders`);
    await hydrated(page);

    /*
     * Absent first, and this is a floor rather than a formality. Every
     * assertion below is about the notice arriving; if it were already on the
     * screen — from the boot, from a previous test's state — the interesting
     * one would pass without the fix.
     */
    await expect(
      page.locator(NOTICE),
      "the notice is already up before anything failed",
    ).toHaveCount(0);

    /*
     * How many entries are really in the database before anything is broken.
     * Read here and not later: a readonly transaction opened after a write is
     * in flight waits for that write, so asking between the failed write and
     * the successful one would change what is being measured.
     */
    // Settled, for the WA-94 reason: `hydrated` is the store's status and the
    // seed's write lands after it, so a single read here can find the blob
    // that `onRehydrateStorage` wrote, whose `data` is null.
    const before = await settledAuditCount(page);

    await failWritesFromNow(page);
    await raiseOrder(page, prefix, "Belt replacement, first attempt");

    /*
     * The toast still reports the single change. It is the per-change message
     * and it is not what this ticket is about — but a fix that raised the
     * standing notice by swallowing the toast would have traded one silence
     * for another, so it is asserted here rather than assumed.
     */
    await expect(
      page.getByText(words.states.saving.failedTitle),
      "the single change went unreported",
    ).toBeVisible();

    // The ticket, in one line.
    await expect(
      page.locator(NOTICE),
      "the browser stopped keeping changes and the screen never said so",
    ).toBeVisible();
    await expect(page.getByText(words.states.saving.deviceTitle)).toBeVisible();

    /*
     * The floor for the whole test: the write really reached the database
     * layer and really failed there. Without it a form that never submitted —
     * a validation message, a renamed label — produces the same absence of a
     * saved record, and the notice assertion above would be measuring the
     * wrong thing entirely.
     */
    expect(
      await failedOpenCount(page),
      "no write ever reached the database, so nothing above is about a failed write",
    ).toBeGreaterThan(0);

    // And out the other side: a change that commits clears it.
    await allowWrites(page);
    await raiseOrder(page, prefix, "Belt replacement, second attempt");

    /*
     * The commit, read out of the database rather than off the screen.
     *
     * The success toast was the obvious assertion and it is the wrong one
     * twice over: `created` is `"{number} raised"`, so the fixed part of it is
     * empty once the number is stripped — `getByText("")` matches the whole
     * document and would pass against anything at all. And a toast says the
     * application believes the write landed, which is the very thing this
     * ticket is about not taking on trust. The entry count is the browser's
     * own answer.
     */
    await expect
      .poll(() => storedAuditCount(page), {
        message:
          "the second order never committed, so the notice had nothing to clear on",
        timeout: 15_000,
      })
      .toBeGreaterThan(before);

    await expect(
      page.locator(NOTICE),
      "the browser is keeping changes again and the notice is still up",
    ).toHaveCount(0);
  });
}

/**
 * The state the notice already reported, still reported.
 *
 * A private window, or site data blocked for this site: storage is absent from
 * the first line of the boot, every screen works from memory, and none of it
 * survives the tab. This has always worked, and a fix that moved `durable` from
 * a boot reading to a published one could have lost it — the boot's own answer
 * is decided before anything can be listening to it, which is why rehydration
 * still reads it directly.
 */
test("the notice still reports a browser that stores nothing at all", async ({
  context,
  page,
}) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  await withoutStorage(page);
  await useRole(context, "maintenanceCoordinator");
  await page.goto("/en/dashboard");
  await hydrated(page);

  await expect(page.locator(NOTICE)).toBeVisible();
  // The application works underneath it, which is the point of that state and
  // is what separates it from an unreadable read.
  await expect(page.locator('[data-slot="records-unreadable"]')).toHaveCount(0);
});

/** Fills the form the way a person does, and submits it. */
async function raiseOrder(
  page: import("@playwright/test").Page,
  prefix: "en" | "fr",
  title: string,
) {
  const words = prefix === "en" ? en : fr;
  await page
    .getByLabel(words.workOrderForm.fields.asset)
    .selectOption({ index: 1 });
  await page.getByLabel(words.workOrderForm.fields.title).fill(title);
  await page
    .getByLabel(words.workOrderForm.fields.description)
    .fill("Raised by the browser test that proves the notice notices.");
  await page.getByRole("button", { name: words.workOrderForm.submit }).click();
}
