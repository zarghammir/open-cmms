import { expect, test } from "@playwright/test";
import { PINNED_DAY, pinTheDay, screenshotDir } from "../fixtures/screenshots";
import { withoutServiceWorker } from "../fixtures/shell";

/**
 * The pinned day reaches the records, not only the clock on the screen.
 *
 * This is the failure the pin could have had and nobody would have noticed: a
 * run where the timestamps a screen formats are fixed while `buildSeed` is
 * still handed the real day, so every due date and every "3 days overdue" keeps
 * moving. The pictures would look pinned in the places a test looks at and
 * carry on drifting in the places a reviewer looks at.
 *
 * So what is asserted is the date the store built its records for — read back
 * out of IndexedDB, where the application wrote it — rather than anything on
 * screen.
 *
 * It runs in the ordinary suite rather than behind WA_SCREENSHOTS, because the
 * claim it defends is what the whole of WA-46 rests on.
 */
test.beforeEach(async ({ page }) => {
  await pinTheDay(page);
  await withoutServiceWorker(page);
});

test.describe("a screenshot run's clock", () => {
  test("is the day the records are built for", async ({ page }) => {
    await page.goto("/en/dashboard");
    await expect(page.getByRole("main")).toBeVisible();

    // Every answer says which of the several "not yet"s it is, because null on
    // a build agent and null on this machine can mean different things and the
    // first version of this could not tell them apart: it reported null and
    // left the reason to guesswork.
    const readSeededOn = () =>
      page.evaluate(async () => {
        if (typeof indexedDB === "undefined") return "no-indexeddb";

        try {
          // Asked about rather than opened. `indexedDB.open` CREATES a database
          // that is not there — at version 1, with no object stores — and the
          // application's own open then sees a database already at version 1,
          // never fires `onupgradeneeded`, and never creates its store. This
          // test would have broken the thing it is measuring, permanently, in
          // any browser where it won the race. It did on CI, twice, and never
          // once here.
          const existing = (await indexedDB.databases?.()) ?? [];
          if (!existing.some((entry) => entry.name === "workaxis")) {
            return "no-database";
          }

          const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("workaxis", 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });

          if (!database.objectStoreNames.contains("state")) return "no-store";

          const read = await new Promise<string | undefined>(
            (resolve, reject) => {
              const request = database
                .transaction("state", "readonly")
                .objectStore("state")
                .get("workaxis-demo");
              request.onsuccess = () =>
                resolve(request.result as string | undefined);
              request.onerror = () => reject(request.error);
            },
          );

          if (!read) return "no-record";
          return (
            (JSON.parse(read) as { state: { seededOn: string | null } }).state
              .seededOn ?? "no-day"
          );
        } catch (error) {
          return `unreadable: ${String(error)}`;
        }
      });

    // Polled rather than read once. The store writes to IndexedDB just after
    // the first paint, so a single read can land before it and answer null —
    // which says nothing about the pin, and the first version of this test
    // failed that way. Waiting distinguishes "not yet written" from "written
    // for the wrong day"; only the second is a defect.
    //
    // The day the pin names, not the day the machine is having.
    await expect
      .poll(readSeededOn, {
        message: "the records were not built for the pinned day",
        timeout: 20_000,
      })
      .toBe(PINNED_DAY.toISOString().slice(0, 10));
  });

  test("does not stop the clock the browser runs on", async ({ page }) => {
    // setFixedTime fixes what Date reports and leaves timers running. If it
    // stopped them, every wait in every screenshot spec would hang, and the
    // first sign would be a suite that timed out rather than a wrong picture.
    await page.goto("/en/dashboard");

    const ticked = await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          setTimeout(() => resolve(true), 50);
        }),
    );
    expect(ticked, "a timer did not fire under the pinned clock").toBe(true);
  });

  test("writes where the run was told to write", () => {
    // Guards the other half of a screenshot run: WA-45 made the root a
    // variable so CI can throw the pictures away, and a spec that ignored it
    // would write into the repository from a build agent.
    expect(screenshotDir("WA-25")).toContain("WA-25");
  });
});
