import { expect, type Page } from "@playwright/test";

/**
 * Looking at the database from outside the application.
 *
 * These live in their own file rather than in `shell.ts` on purpose: WA-68 is
 * in flight and appends to `shell.ts`, and two branches appending to one file
 * is a merge conflict arranged in advance for no benefit.
 */

declare global {
  interface Window {
    /** Milliseconds every write is held back by. Zero means not armed. */
    __waDelayWrites?: number;
    /** Holds every write open indefinitely, until it is released. */
    __waHoldWrites?: boolean;
    /**
     * The held writes, which nothing fires.
     *
     * They accumulate and the document is closed on top of them, which is what
     * a picture of a save in flight wants. See `holdWritesOpen`: the release
     * that used to empty this was removed in WA-83.
     */
    __waHeld?: (() => void)[];
    /** How many opens the delay actually fired on. The floor. */
    __waDelayedOpens?: number;
    /** Makes every open fail from this moment, so no write can land. */
    __waFailWrites?: boolean;
    /** How many opens were failed on purpose. The floor for that instrument. */
    __waFailedOpens?: number;
  }
}

/**
 * The stored audit count, read without disturbing anything.
 *
 * Negative answers are named rather than collapsed into null, because "there is
 * no database", "there is no object store" and "there is no record" are three
 * different things and a single null was what made an earlier version of this
 * check a guess.
 *
 * `indexedDB.databases()` first, and never `open` on a database that is not
 * there: `open` *creates* one, at version 1 with no object stores, and the
 * application's own open then sees a database already at that version, never
 * fires `onupgradeneeded`, and never creates the store it needs. That broke the
 * thing it was measuring on a loaded runner three times in WA-46.
 *
 * **When this may be called matters more than what it returns.** A readonly
 * transaction created after an in-flight readwrite on the same object store
 * waits for that readwrite to finish — so calling this between a write and the
 * navigation under test would flush the very write whose absence is being
 * measured. Call it before the write under test, or after the navigation.
 * Never between them.
 */
export async function storedAuditCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const databases = await indexedDB.databases();
    if (!databases.some((one) => one.name === "workaxis")) return -1;
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("workaxis", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!database.objectStoreNames.contains("state")) {
      database.close();
      return -2;
    }
    const raw = await new Promise<string | undefined>((resolve, reject) => {
      const request = database
        .transaction("state", "readonly")
        .objectStore("state")
        .get("workaxis-demo");
      request.onsuccess = () => resolve(request.result as string | undefined);
      request.onerror = () => reject(request.error);
    });
    database.close();
    if (!raw) return -3;
    const blob = JSON.parse(raw) as {
      state: { data: { auditEvents: unknown[] } | null };
    };
    return blob.state.data?.auditEvents.length ?? -4;
  });
}

/**
 * The stored audit count, once the boot has finished putting it there.
 *
 * `storedAuditCount` reads whatever is committed at the instant it is called,
 * and `hydrated` is not a promise that the seed has been written. The boot goes:
 * the read resolves empty, `onRehydrateStorage` sets the status — **and that
 * `setState` is itself a write, of a state whose `data` is still null** — and
 * only then does the effect seed the records and write those. A read landing
 * between those two writes finds the blob with no records in it and gets −4,
 * "there is a record and no records in it".
 *
 * That is not hypothetical and it is not a product defect: it turned
 * `unreadable-refusal.spec.ts` red on a loaded runner at 1.6 s, before any
 * fixture had been armed, while the retry passed at 6.5 s. The window is real
 * and the assertion was right; what was wrong was reading once, inside it.
 *
 * So this waits for the answer the test is about. It is for the **floor** a
 * test takes before it does anything — never for a comparison after a write
 * under test, because polling opens readonly transactions and one of those
 * opened after an in-flight readwrite waits for it, which would flush the very
 * write whose absence is being measured. `storedAuditCount` stays exported for
 * exactly those cases.
 *
 * **The floor lives in the poll's message rather than in an `expect` of its
 * own, and that is deliberate — copy this form.** A separate assertion after
 * the poll would be a second thing to forget, and it would report "expected 0
 * to be greater than 0" fifteen seconds after the useful information was
 * available. The poll *is* the floor: it cannot return a number that fails it,
 * and when it never gets one it fails by name, saying the seed never reached
 * the database rather than leaving a later assertion to fail somewhere else
 * about something unrelated.
 *
 * **`> 0` means the seed has started landing, not that it has finished**, so
 * nothing may build a comparison on the number this returns beyond "there was
 * something there before I did anything". The boot writes the records in one
 * blob, so in practice the first non-zero reading is the whole seed — but that
 * is the store's current behaviour rather than a promise this makes, and a test
 * asserting `after === before + 1` against it would be asserting the boot's
 * write shape without saying so.
 */
export async function settledAuditCount(page: Page): Promise<number> {
  let last = 0;
  await expect
    .poll(
      async () => {
        last = await storedAuditCount(page);
        return last;
      },
      {
        message:
          "the seed never reached the database: the boot wrote no records within the wait",
        timeout: 15_000,
      },
    )
    .toBeGreaterThan(0);
  return last;
}

/**
 * Makes every write take a known length of time, on demand.
 *
 * WA-67 is a write that has not reached IndexedDB when a full-load navigation
 * tears the page down, at about one load in ten to twenty. A test that waited
 * for that rate would be a test that passes for the wrong reason nineteen times
 * out of twenty, so this forces it instead: with the delay armed, the write
 * provably has not landed when the navigation begins.
 *
 * The lever is `indexedDB.open`, because `idb-storage.ts` opens a fresh
 * connection for every operation — so holding the open back holds the whole
 * write back, without reaching into the adapter or changing a line of it.
 *
 * **Disarmed until the test says so**, which is the part that keeps this
 * honest. Armed from the start it would also delay the seed's first write, and
 * a navigation before *that* landed is a different defect entirely — the one
 * WA-58 fixed. Arming immediately before the write under test means the only
 * thing in flight is the one being measured.
 *
 * The boot read is never delayed: it happens before anything is armed, and
 * instrumenting the read is what moved the race in WA-58.
 *
 * Call before the first navigation; arm with `armSlowWrites`.
 */
export async function installSlowWrites(page: Page) {
  await page.addInitScript(() => {
    const real = indexedDB.open.bind(indexedDB);
    window.__waDelayedOpens = 0;

    window.__waFailedOpens = 0;

    indexedDB.open = ((name: string, version?: number) => {
      /*
       * Failing comes first, because it is the only mode that must not touch
       * the real database at all. Opening it and then reporting an error would
       * still create it — at version 1 with no object stores, which is the trap
       * `storedAuditCount` above documents at length.
       */
      if (window.__waFailWrites === true) {
        window.__waFailedOpens = (window.__waFailedOpens ?? 0) + 1;
        const failed: Record<string, unknown> = {
          onupgradeneeded: null,
          onsuccess: null,
          onerror: null,
          onblocked: null,
          result: null,
          error: new DOMException("forced write failure", "UnknownError"),
          readyState: "done",
        };
        setTimeout(() => {
          const handler = failed.onerror as ((e: unknown) => void) | null;
          if (handler) handler({ target: failed });
        }, 0);
        return failed;
      }

      const request = real(name, version);
      const delay = window.__waDelayWrites ?? 0;
      const hold = window.__waHoldWrites === true;
      if (delay <= 0 && !hold) return request;

      window.__waDelayedOpens = (window.__waDelayedOpens ?? 0) + 1;

      // A stand-in the caller sets its handlers on, so the success can be held
      // back. `result` is copied across before each handler runs, because the
      // adapter reads `request.result` off the object it was handed.
      const held: Record<string, unknown> = {
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        onblocked: null,
        result: null,
        error: null,
      };

      // `result` **and** `error`: `openDatabase` rejects with `request.error`,
      // and a stand-in that carried only the result would turn a failed open
      // into a rejection with `undefined` — an error swallowed by the
      // instrument meant to observe one.
      const call = (key: string) => {
        held.result = request.result;
        held.error = request.error;
        const handler = held[key] as ((event: unknown) => void) | null;
        if (handler) handler({ target: held });
      };

      request.onupgradeneeded = () => call("onupgradeneeded");
      request.onsuccess = () => {
        const fire = () => call("onsuccess");
        // Held rather than delayed: a timer is at the mercy of a faked clock,
        // and `page.clock.setFixedTime` is exactly what a screenshot run
        // installs. Holding until released is deterministic under either.
        if (hold) {
          window.__waHeld = [...(window.__waHeld ?? []), fire];
          return;
        }
        setTimeout(fire, delay);
      };
      request.onerror = () => call("onerror");
      request.onblocked = () => call("onblocked");

      return held;
    }) as typeof indexedDB.open;
  });
}

/**
 * Turns the delay on, from this moment.
 *
 * Per document: the init script runs again on the next navigation, so the new
 * document starts disarmed with its own count at zero. That is what is wanted —
 * only the write before the navigation is held back — and it is why the floor
 * must be read before the navigation, not after it.
 */
export async function armSlowWrites(page: Page, milliseconds: number) {
  await page.evaluate((ms) => {
    window.__waDelayWrites = ms;
  }, milliseconds);
}

/**
 * How many opens the delay fired on.
 *
 * The floor. Zero means nothing was held back, so a green run proves nothing
 * about a slow write — the shape of every gated suite that ran nothing and
 * agreed with itself perfectly.
 */
export async function delayedOpenCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__waDelayedOpens ?? 0);
}

/**
 * A browser that stores nothing, from before the first line of the boot.
 *
 * The state a private window is in, or a browser with site data blocked for
 * this site. The application is built to survive it: `available()` is false,
 * every write goes to memory, the records are seeded, and **every screen
 * works**. What is lost is that any of it survives the tab — which is what the
 * standing notice exists to say, and the only state in which that notice can
 * be photographed over a working application.
 *
 * Not the same instrument as a failed read, and not interchangeable with one.
 * `failTheNextRead` breaks the *fetch*: the records cannot be read, the store
 * goes `unreadable`, and WA-66 draws the refusal in place of the page — so the
 * notice, which lives inside the passing branch, is correctly not there. That
 * is what invalidated the first version of this picture.
 *
 * Nor is it a failed **write** after a healthy boot. Measured on this branch:
 * two opens failed, the per-change toast appeared, and the standing notice did
 * **not** — `durable` is copied into the store once, at rehydration, and
 * nothing updates it afterwards. That is a defect in the notice rather than in
 * this fixture, it is recorded on the pull request, and photographing it is
 * impossible until it is fixed.
 *
 * Call it before the first navigation: the boot reads storage immediately, and
 * a global removed afterwards has already missed the only question anybody
 * asked of it.
 */
export async function withoutStorage(page: Page) {
  await page.addInitScript(() => {
    // Removed rather than made to throw: `available()` asks whether the global
    // exists, which is the same question a private window answers with "no".
    // An `open` that throws is a different state — the one a failed read
    // stages — and using it here would photograph the wrong screen.
    // @ts-expect-error removing the global on purpose
    delete window.indexedDB;
  });
}

/**
 * Makes every write from this moment fail, with the records still readable.
 *
 * The distinction is the whole of WA-85. `failTheNextRead` breaks the **boot**:
 * the records cannot be fetched, the store goes `unreadable`, and WA-66 draws
 * the refusal in place of the page. This breaks a **write** on a browser whose
 * records loaded normally — every screen is full, the person is working, and
 * what fails is keeping what they do. That is the case the standing notice was
 * built for and the case it could not report until this ticket.
 *
 * Arm it after the load, never before: it fails every `indexedDB.open`,
 * including the one a test's own `storedAuditCount` makes, so nothing that
 * reads the database may run between arming and `allowWrites`.
 */
export async function failWritesFromNow(page: Page) {
  await page.evaluate(() => {
    window.__waFailWrites = true;
  });
}

/** Lets writes reach the database again, so a change can commit. */
export async function allowWrites(page: Page) {
  await page.evaluate(() => {
    window.__waFailWrites = false;
  });
}

/**
 * How many opens were failed on purpose. The floor.
 *
 * Zero means the write never reached the database layer at all, so a screen
 * that looks unsaved is proving nothing about a failed write — it could be a
 * form that never submitted. A check whose subject can be empty needs one.
 */
export async function failedOpenCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__waFailedOpens ?? 0);
}

/**
 * Holds every write open, for the rest of the document's life.
 *
 * `armSlowWrites` delays with a timer, which is enough for a test that measures
 * elapsed time — and wrong for a screenshot run, because `pinTheDay` installs
 * Playwright's clock and a held timer is then at its mercy. Measured: the same
 * write that takes three seconds in `late-write.spec.ts` completed immediately
 * under a pinned clock, and the "Saving…" state was gone before it could be
 * photographed.
 *
 * Holding has no duration to get wrong. The write stays in flight, so a picture
 * of the state is taken deliberately rather than caught, and the page is closed
 * afterwards with the write still held.
 *
 * **There is no way to let it go again, and that is deliberate as of WA-83.**
 * A `releaseWrites` used to sit here. Nothing called it, and when the reviewer
 * drove it — four attempts, on two heads — the held save never completed. It
 * was removed rather than repaired: the defect can only be reproduced in a
 * browser, the one caller of this fixture holds and never releases by design,
 * and an export that nothing calls and nobody has seen work is not a tool, it
 * is a claim. Whoever next needs a held write to finish writes it then, with
 * the test that proves it and the caller that uses it.
 */
export async function holdWritesOpen(page: Page) {
  await page.evaluate(() => {
    window.__waHoldWrites = true;
  });
}
