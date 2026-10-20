import type { StateStorage } from "zustand/middleware";

/**
 * Persistence for the demo records, on IndexedDB.
 *
 * IndexedDB rather than local storage because the same store becomes the
 * offline cache in WA-15: local storage is small, synchronous and string-only,
 * and swapping it later would mean rewriting the store rather than adding to
 * it.
 *
 * Written by hand rather than pulled from a package. The whole contract is
 * three methods, and a dependency added for eighty lines is a dependency to
 * license, audit and explain in a bid.
 */

const DATABASE_NAME = "workaxis";
const STORE_NAME = "state";
const DATABASE_VERSION = 1;

/**
 * When IndexedDB is unavailable — a server render, a private window, a browser
 * with site data blocked — the application still has to run. It falls back to
 * memory, which lasts as long as the tab.
 *
 * Nothing is logged: a console warning on every page load would be
 * indistinguishable from a fault in the suites that assert a clean console.
 * The store exposes `durable` instead, so a screen can say so if it matters.
 */
const memory = new Map<string, string>();

let durable: boolean | null = null;

/**
 * Who wants to know when that answer changes.
 *
 * `isDurable()` has always been right and has always been a **pull**: the
 * store read it once, at rehydration, and nothing asked again. So a browser
 * that stopped keeping changes halfway through an afternoon went on reporting
 * the answer it gave at boot, and the standing notice — the one built because
 * a person can miss a toast — was silent for the whole case it exists for.
 * Measured on WA-66: two writes failed, the toast appeared, the notice did
 * not.
 *
 * A push instead. Every place that learns something about this browser's
 * storage says so once, here, and whoever is listening finds out.
 */
const durableListeners = new Set<(value: boolean | null) => void>();

/**
 * Records what was just learned, and tells anyone listening if it is news.
 *
 * **The equality check is what stops this from looping. Do not remove it as an
 * optimisation.** It looks like one and it is not.
 *
 * The store's listener calls `setState`, and a `setState` on a persisted store
 * is a **write**: zustand's persist calls `setItem`. That write succeeds, the
 * success announces `true`, the listener sets the state again, and that write
 * announces again. Zustand does not diff, so nothing else in the chain ever
 * says "this is the same answer as last time" — this line is the only place
 * the cycle can end.
 *
 * Announcing the transition rather than the answer is also what makes it
 * cheap, since a write commits on nearly every keystroke in a form. That is
 * the lesser reason and an earlier version of this comment gave only that one,
 * which would have read to the next person as a line worth deleting.
 */
function setDurable(next: boolean | null): void {
  if (durable === next) return;
  durable = next;
  for (const listener of durableListeners) listener(next);
}

/**
 * Subscribe to that answer. Returns the way to stop listening.
 *
 * Called once, by the store, so a screen can read `durable` from the store
 * like any other piece of state rather than reaching into this file.
 */
export function onDurableChange(
  listener: (value: boolean | null) => void,
): () => void {
  durableListeners.add(listener);
  return () => {
    durableListeners.delete(listener);
  };
}

/**
 * Set when a read fails, and never unset.
 *
 * After a failed read the store holds no records — not because there are none,
 * but because they could not be fetched — and anything written from that state
 * would be written over the records that are still there. Measured before this
 * existed: the seed stopped being written over them, and the very next
 * `setState` persisted `data: null` in its place, which is the same loss by a
 * quieter route.
 *
 * Writes still reach memory, so the tab keeps working; nothing reaches the
 * database until a reload reads it successfully.
 */
let writesHeld = false;

/** Stops anything being written over records that could not be read. */
export function holdWrites(): void {
  writesHeld = true;
}

/** Whether writes survive a reload. Null until the first read or write. */
export function isDurable(): boolean | null {
  return durable;
}

function available(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB open was blocked"));
  });
}

/**
 * One operation, resolved when it is **durable** rather than when it is
 * accepted.
 *
 * This used to resolve on `request.onsuccess`, and the difference is the whole
 * of WA-67. A put request succeeding means the database has taken the value;
 * the value is only on disk when the *transaction* commits, and between those
 * two moments a document that goes away takes the write with it. Measured: a
 * change made and then left alone landed 40 times in 40, and the same change
 * with the page torn down underneath it was lost 32 times in 40 — in the same
 * run, on the same workers, so it is the teardown and not the machine.
 *
 * So: `oncomplete` resolves, `onabort` and `onerror` reject, and the connection
 * is closed on all three rather than only on success — which also fixes a
 * connection left open for the lifetime of the tab every time an operation
 * failed.
 */
function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const request = work(transaction.objectStore(STORE_NAME));
        let result: T;

        // The result is only available on the request; the *permission* to
        // believe it is only available on the transaction. Hold one until the
        // other arrives.
        request.onsuccess = () => {
          result = request.result;
        };

        const done = (settle: () => void) => () => {
          database.close();
          settle();
        };

        transaction.oncomplete = done(() => resolve(result));
        transaction.onabort = done(() =>
          reject(
            transaction.error ??
              request.error ??
              new Error("The write was abandoned before it was stored"),
          ),
        );
        transaction.onerror = done(() =>
          reject(
            transaction.error ??
              request.error ??
              new Error("The stored records could not be written"),
          ),
        );
      }),
  );
}

/**
 * Writes happen one at a time, in the order they were asked for.
 *
 * Zustand's persist fires a fresh `setItem` on every `setState` without waiting
 * for the last one (`zustand/middleware.js`: `savedSetState(...); return
 * setItem()`), and every write carries the **whole** partialized state. Two of
 * them in flight at once can therefore commit in either order, and an older one
 * landing last would quietly undo the newer change.
 *
 * Found by reading the middleware while diagnosing WA-67, not by watching it
 * happen — so it is fixed and tested here rather than reported as a defect
 * anybody has seen. Serialising also makes "is anything outstanding" a question
 * with an answer, which is what the screens need in order to stop claiming a
 * change is saved before it is.
 */
let writes: Promise<unknown> = Promise.resolve();

/** The outcome of the most recently finished write. Null when it committed. */
let lastFailure: Error | null = null;

function afterPreviousWrites(work: () => Promise<void>): Promise<void> {
  const next = writes.then(work, work).then(
    () => {
      lastFailure = null;
    },
    (error: unknown) => {
      lastFailure =
        error instanceof Error
          ? error
          : new Error("The change could not be stored on this device");
    },
  );
  writes = next;
  return next;
}

/**
 * A write that could not be attempted is still a write that did not happen.
 *
 * Three paths used to leave before reaching the chain — writes held, no
 * IndexedDB in `setItem`, no IndexedDB in `removeItem` — and the chain is the
 * only place `lastFailure` is set. So `whenFlushed()` answered **yes** having
 * stored nothing: on a browser with site data blocked, every screen fired its
 * success message while the standing notice beside it said the device was not
 * saving. The banner was right and the toast read like the answer.
 *
 * That is the same shape this ticket exists to remove, one layer up from where
 * it was found: `getItem` used to return null for a failed read, which is the
 * same answer as "nothing is stored". An absence collapsed into a success.
 *
 * Routing a refusal through the chain rather than returning early keeps
 * `whenFlushed` a single source of truth — there is one place that decides
 * whether the last write worked, and it is reached on every path.
 */
function refuseWrite(reason: string): Promise<void> {
  return afterPreviousWrites(() => {
    throw new Error(reason);
  });
}

/**
 * Resolves when nothing is waiting to be written, and says whether it worked.
 *
 * `true` means every outstanding write committed. `false` means the most recent
 * one did not, and the person has to be told — a change the screen has already
 * drawn is not on this device and will not be there after a reload.
 *
 * It never rejects: a screen asking "is it saved?" should get an answer, not an
 * exception to remember to catch.
 */
export async function whenFlushed(): Promise<boolean> {
  await writes;
  return lastFailure === null;
}

/** Why the last write failed, for the message a person is shown. */
export function lastWriteFailure(): Error | null {
  return lastFailure;
}

export const indexedDbStorage: StateStorage = {
  async getItem(name) {
    if (!available()) {
      setDurable(false);
      return memory.get(name) ?? null;
    }
    try {
      const value = await run<string | undefined>("readonly", (store) =>
        store.get(name),
      );
      setDurable(true);
      return value ?? null;
    } catch (error) {
      // A read that failed is not an empty store, and this is the only place
      // that still knows the difference. It used to return null here, which is
      // the same answer as "nothing has been stored" — so the boot treated a
      // browser that could not be read as a browser with nothing in it, and
      // wrote a fresh seed over everything the person had done. Measured: 119
      // audit events became 118, in silence.
      //
      // Rejecting is what carries the distinction upward: zustand's persist
      // hands the error to `onRehydrateStorage`, which is the argument this
      // store had never been given anything to receive.
      setDurable(false);
      throw error instanceof Error
        ? error
        : new Error("The stored records could not be read");
    }
  },

  async setItem(name, value) {
    memory.set(name, value);
    if (writesHeld) {
      setDurable(false);
      return refuseWrite(
        "The stored records could not be read, so nothing is written over them",
      );
    }
    if (!available()) {
      setDurable(false);
      return refuseWrite("This browser is not storing data for this site");
    }
    await afterPreviousWrites(async () => {
      // Deliberately not caught here. It used to be — `catch { durable = false }`
      // — and that is why this defect surfaced on five continuous-integration
      // heads across four tests without ever producing an error message: a
      // write abandoned when the page went away was caught, discarded, and
      // reported to nobody. The rejection now travels to `whenFlushed`, which
      // is what a screen asks before it tells a person their change is saved.
      try {
        await run("readwrite", (store) => store.put(value, name));
        setDurable(true);
      } catch (error) {
        setDurable(false);
        throw error;
      }
    });
  },

  async removeItem(name) {
    memory.delete(name);
    // The third instance, found by sweeping for the shape rather than for the
    // two the review named. It also had no `writesHeld` guard at all: with the
    // records unreadable and writes held, a delete would have removed the
    // stored blob those held writes exist to protect.
    if (writesHeld) {
      setDurable(false);
      return refuseWrite(
        "The stored records could not be read, so they are not deleted either",
      );
    }
    if (!available()) {
      setDurable(false);
      return refuseWrite("This browser is not storing data for this site");
    }
    await afterPreviousWrites(async () => {
      try {
        await run("readwrite", (store) => store.delete(name));
        setDurable(true);
      } catch (error) {
        setDurable(false);
        throw error;
      }
    });
  },
};
