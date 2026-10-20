import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { useRole, watchConsole, withoutServiceWorker } from "../fixtures/shell";

/**
 * What a person sees after the stored shape changes under them.
 *
 * The store and the feed are each tested on their own — the store writes an
 * entry, the feed renders it in both languages — and neither says whether they
 * meet. Between them sit IndexedDB, zustand's persist, a migration that
 * discards rather than carries forward, and a rehydration: four places a
 * version can be read, and the entry only exists if the one that notices is
 * still able to say what it noticed.
 *
 * So this plants an older version in the persisted blob the way a deploy does,
 * reloads, and reads the first row of the trail on the screen a person opens.
 */

test.beforeEach(async ({ page }) => {
  await withoutServiceWorker(page);
});

/**
 * Waits until the application has finished writing its own boot to the
 * database, so that what this test writes next is the last word.
 *
 * **This is the whole of WA-110.** The boot persists twice — the rehydrate's
 * `setState` with `data` still null, then the seed — and the second of those
 * can still be in flight when the test plants an older version over it. The
 * application's write then lands last, the reload reads the CURRENT version,
 * `migrate` never runs, `rebuiltFrom` stays null, and the notice is never
 * written at all. Not late: never. The test then waits ten seconds for a
 * sentence that was never going to exist, and blames the trail.
 *
 * Measured, before and after the plant, across six runs: the stored version
 * read back as the current one twice and as the planted one four times, and
 * the notice appeared in exactly the four where the plant had survived. Six
 * for six, no exceptions.
 *
 * A read is normally a participant here — a readonly transaction opened after
 * an in-flight readwrite waits for it, and so flushes it, which is why probes
 * of this defect kept changing it. This read uses that on purpose rather than
 * by accident: it is a synchronisation point, and waiting for the seed to be
 * *there* is the only way to know the writer has stopped.
 */
async function waitForTheBootToFinishWriting(page: Page) {
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("workaxis", 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          const raw = await new Promise<string | undefined>(
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
          if (!raw) return 0;
          const blob = JSON.parse(raw) as {
            state: { data: { auditEvents: unknown[] } | null };
          };
          return blob.state.data?.auditEvents.length ?? 0;
        }),
      {
        message:
          "the boot never wrote its records, so there is no version to plant over",
        timeout: 15_000,
      },
    )
    .toBeGreaterThan(0);
}

/** Rewrites the stored blob's version, the way arriving at a new build does. */
async function leaveStoreAtAnOlderVersion(page: Page) {
  await waitForTheBootToFinishWriting(page);

  const moved = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("workaxis", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const read = await new Promise<string | undefined>((resolve, reject) => {
      const request = database
        .transaction("state", "readonly")
        .objectStore("state")
        .get("workaxis-demo");
      request.onsuccess = () => resolve(request.result as string | undefined);
      request.onerror = () => reject(request.error);
    });

    if (!read) return null;

    const blob = JSON.parse(read) as { version: number };
    const was = blob.version;
    blob.version = was - 1;

    /*
     * `oncomplete` ON THE TRANSACTION, NOT `onsuccess` ON THE REQUEST — and
     * this is WA-110.
     *
     * `request.onsuccess` fires when the put has been accepted. The
     * transaction has not committed yet. The caller reloads the page on the
     * next line, and a reload tears the context down: on a cold run the commit
     * loses that race, the new page reads the version that was there before,
     * nothing rebuilds, and the notice this test waits ten seconds for was
     * never going to be written.
     *
     * That is the repository's own rule about writes and navigations, in the
     * one place it had not been applied — the screen updating is not the write
     * landing, and neither is a request succeeding.
     */
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("state", "readwrite");
      transaction
        .objectStore("state")
        .put(JSON.stringify(blob), "workaxis-demo");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });

    return { was, now: blob.version };
  });

  // The plant either happened or this test is about nothing.
  expect(
    moved,
    "no persisted state to move to an older version",
  ).not.toBeNull();

  /*
   * And it is still there. The caller reloads on the next line, so this is the
   * last moment the value can be checked — and a plant that has already been
   * overwritten is the difference between a test about the trail and ten
   * seconds spent waiting for a sentence nothing will write. Failing here says
   * which of those happened.
   */
  const stillPlanted = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("workaxis", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const raw = await new Promise<string | undefined>((resolve, reject) => {
      const request = database
        .transaction("state", "readonly")
        .objectStore("state")
        .get("workaxis-demo");
      request.onsuccess = () => resolve(request.result as string | undefined);
      request.onerror = () => reject(request.error);
    });
    return raw ? (JSON.parse(raw) as { version: number }).version : null;
  });

  expect(
    stillPlanted,
    "the application wrote over the planted version before the reload, so nothing will rebuild",
  ).toBe(moved!.now);

  return moved!;
}

/** The newest thing the trail says, on the screen a person opens. */
function firstEntry(page: Page) {
  return page.locator('[data-slot="activity-feed"] li').first();
}

/**
 * Waits for the rebuild notice to reach the trail, then hands back its row.
 *
 * **Three questions, asked in the order the screen answers them**, because
 * collapsing them into one assertion on the first row makes every failure say
 * the same wrong thing: that the newest entry is a work order.
 *
 * 1. Did the feed arrive at all? `DemoBoot` sits in the application layout
 *    while the dashboard renders behind a Suspense boundary, so a reload can
 *    resolve hydration while the server's fallback is still on screen. Every
 *    sibling spec that reads this feed waits for exactly this first, and this
 *    one did not — it waited before planting the older version and then read
 *    straight after the reload.
 * 2. Did the notice land? The rebuild is written during the boot that noticed
 *    the version change, and on a cold run that write can be later than the
 *    first paint of the feed.
 * 3. Only then: is it the newest thing there?
 *
 * WA-110 is the three run together. Read as one assertion on the first row,
 * a notice that had not landed yet was indistinguishable from a notice filed
 * in the wrong order, and the ten-second budget was spent re-reading a row
 * that was never going to change.
 */
async function rebuildNotice(page: Page, sentence: string) {
  await expect(
    firstEntry(page),
    "the feed never arrived, so nothing below is about the trail's order",
  ).toBeVisible();

  const notice = page.locator('[data-slot="activity-feed"] li', {
    hasText: sentence,
  });
  await expect(
    notice,
    "the rebuild notice never reached the trail",
  ).toHaveCount(1);

  return notice;
}

test.describe("the trail after the records are rebuilt", () => {
  test("says the data was rebuilt, and names both versions", async ({
    context,
    page,
  }) => {
    const watcher = watchConsole(page);
    await useRole(context, "administrator");

    await page.goto("/en/dashboard");
    await expect(firstEntry(page)).toBeVisible();

    const { was, now } = await leaveStoreAtAnOlderVersion(page);
    await page.reload();

    const rebuilt = en.audit.dataRebuilt
      .replace("{version}", String(was))
      .replace("{previousVersion}", String(now));

    await rebuildNotice(page, rebuilt);

    // And it is the first thing the trail says, which is the claim: a person
    // opening the dashboard is told why everything before it is gone before
    // they are told anything else.
    await expect(
      firstEntry(page),
      "the rebuild notice is in the trail but is not the newest entry",
    ).toContainText(rebuilt);
    await expect(firstEntry(page)).toContainText(
      en.dashboard.activity.systemActor,
    );

    // Once, not once per boot. The entry itself stays — it is a record of
    // something that happened, not a notice — so what must not happen is a
    // second one, and counting is the only way to say that. Asserting it had
    // disappeared would have been asserting the opposite of what a trail is,
    // and the first version of this test did exactly that.
    await page.reload();
    await rebuildNotice(page, rebuilt);
    await expect(firstEntry(page)).toContainText(rebuilt);
    await expect(
      page.locator('[data-slot="activity-feed"] li', { hasText: rebuilt }),
    ).toHaveCount(1);

    expect(watcher.errors).toEqual([]);
  });

  test("says it in French too", async ({ context, page }) => {
    await useRole(context, "administrator");

    await page.goto("/fr/dashboard");
    await expect(firstEntry(page)).toBeVisible();

    const { was, now } = await leaveStoreAtAnOlderVersion(page);
    await page.reload();

    const rebuilt = fr.audit.dataRebuilt
      .replace("{version}", String(was))
      .replace("{previousVersion}", String(now));

    await rebuildNotice(page, rebuilt);
    await expect(
      firstEntry(page),
      "the rebuild notice is in the trail but is not the newest entry",
    ).toContainText(rebuilt);
  });
});
