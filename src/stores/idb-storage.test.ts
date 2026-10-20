import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The two properties WA-67 turned on, tested against a database this test can
 * hold open on purpose.
 *
 * A real IndexedDB commits when it likes, which is exactly what made this
 * defect a one-in-fifteen in a browser and nothing at all in a unit test. The
 * fake below is small and does one thing the real one will not: it lets the
 * test decide *when* a transaction commits, and whether it commits at all. That
 * turns "resolve on the commit, not on the request" and "one write at a time"
 * from timing into assertions.
 *
 * `vi.resetModules()` before each case because the adapter keeps the write
 * chain, the durability flag and the write-hold at module scope — state that
 * survives between tests would make the second case depend on the first.
 */

interface PendingTransaction {
  mode: IDBTransactionMode;
  /** What this transaction would write, held until it commits. */
  staged: Array<{ key: string; value: string | undefined }>;
  commit: () => void;
  abort: (reason?: Error) => void;
}

interface Fake {
  stored: Map<string, string>;
  pending: PendingTransaction[];
  openConnections: () => number;
}

function installFakeIndexedDB(): Fake {
  const stored = new Map<string, string>();
  const pending: PendingTransaction[] = [];
  let open = 0;

  const request = <T>(): {
    onsuccess: (() => void) | null;
    onerror: (() => void) | null;
    result: T | undefined;
    error: Error | null;
  } => ({ onsuccess: null, onerror: null, result: undefined, error: null });

  const database = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => undefined,
    close: () => {
      open -= 1;
    },
    transaction: (_name: string, mode: IDBTransactionMode) => {
      const staged: PendingTransaction["staged"] = [];
      const transaction: Record<string, unknown> = {
        oncomplete: null,
        onabort: null,
        onerror: null,
        error: null,
      };

      const fire = (key: string) => {
        const handler = transaction[key] as (() => void) | null;
        if (handler) handler();
      };

      pending.push({
        mode,
        staged,
        commit: () => {
          for (const { key, value } of staged) {
            if (value === undefined) stored.delete(key);
            else stored.set(key, value);
          }
          fire("oncomplete");
        },
        abort: (reason) => {
          // Nothing staged is applied. That is the whole point of a
          // transaction, and the whole point of this test.
          transaction.error = reason ?? new Error("aborted");
          fire("onabort");
        },
      });

      transaction.objectStore = () => ({
        put: (value: string, key: string) => {
          const r = request<undefined>();
          staged.push({ key, value });
          queueMicrotask(() => r.onsuccess?.());
          return r;
        },
        delete: (key: string) => {
          const r = request<undefined>();
          staged.push({ key, value: undefined });
          queueMicrotask(() => r.onsuccess?.());
          return r;
        },
        get: (key: string) => {
          const r = request<string>();
          r.result = stored.get(key);
          queueMicrotask(() => r.onsuccess?.());
          return r;
        },
      });

      return transaction;
    },
  };

  const fakeIndexedDB = {
    open: () => {
      const r = request<typeof database>();
      r.result = database;
      open += 1;
      queueMicrotask(() => r.onsuccess?.());
      return r;
    },
    databases: async () => [{ name: "workaxis", version: 1 }],
  };

  vi.stubGlobal("indexedDB", fakeIndexedDB);

  return { stored, pending, openConnections: () => open };
}

/** Lets queued microtasks and awaited promises run. */
async function settle() {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

let fake: Fake;

beforeEach(() => {
  vi.resetModules();
  fake = installFakeIndexedDB();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a write is finished when the transaction commits", () => {
  it("does not report success while the transaction is still open", async () => {
    const { indexedDbStorage, whenFlushed } = await import("./idb-storage");

    let settled = false;
    // `StateStorage.setItem` is typed as returning `unknown`, so the promise is
    // adopted rather than assumed.
    void Promise.resolve(
      indexedDbStorage.setItem("workaxis-demo", "first"),
    ).then(() => {
      settled = true;
    });
    await settle();

    // The put request has already succeeded here — the value is staged and the
    // database has accepted it. That is the moment the old code called the
    // write done, and it is the moment a page teardown destroys it.
    expect(fake.pending).toHaveLength(1);
    expect(fake.pending[0]!.staged).toEqual([
      { key: "workaxis-demo", value: "first" },
    ]);
    expect(
      settled,
      "the write reported itself finished before the transaction committed",
    ).toBe(false);

    fake.pending[0]!.commit();
    await settle();

    expect(settled).toBe(true);
    expect(await whenFlushed()).toBe(true);
    expect(fake.stored.get("workaxis-demo")).toBe("first");
  });

  it("reports a write that was abandoned rather than swallowing it", async () => {
    const { indexedDbStorage, whenFlushed, isDurable, lastWriteFailure } =
      await import("./idb-storage");

    void indexedDbStorage.setItem("workaxis-demo", "doomed");
    await settle();
    fake.pending[0]!.abort(new Error("the page went away"));
    await settle();

    // The old code caught this, set `durable = false`, and said nothing to
    // anybody — which is why five continuous-integration failures across four
    // tests never produced a single error message.
    expect(await whenFlushed()).toBe(false);
    expect(lastWriteFailure()?.message).toBe("the page went away");
    expect(isDurable()).toBe(false);
    expect(fake.stored.has("workaxis-demo")).toBe(false);
  });

  it("closes the connection whether the transaction commits or is abandoned", async () => {
    const { indexedDbStorage } = await import("./idb-storage");

    void indexedDbStorage.setItem("workaxis-demo", "one");
    await settle();
    fake.pending[0]!.commit();
    await settle();

    void indexedDbStorage.setItem("workaxis-demo", "two");
    await settle();
    fake.pending[1]!.abort();
    await settle();

    // A connection left open on every failed operation is a leak that lasts as
    // long as the tab. It used to close only on completion.
    expect(fake.openConnections()).toBe(0);
  });
});

describe("writes happen one at a time", () => {
  it("does not start the second write until the first has committed", async () => {
    const { indexedDbStorage } = await import("./idb-storage");

    void indexedDbStorage.setItem("workaxis-demo", "older");
    void indexedDbStorage.setItem("workaxis-demo", "newer");
    await settle();

    // Both were asked for. Only one is in flight — which is the property.
    // Without it both open their own connection and either may commit last.
    expect(
      fake.pending,
      "both writes went out at once: an older one can then commit after a newer one and undo it",
    ).toHaveLength(1);
    expect(fake.pending[0]!.staged[0]!.value).toBe("older");

    fake.pending[0]!.commit();
    await settle();

    expect(fake.pending).toHaveLength(2);
    expect(fake.pending[1]!.staged[0]!.value).toBe("newer");

    fake.pending[1]!.commit();
    await settle();

    expect(fake.stored.get("workaxis-demo")).toBe("newer");
  });

  it("the older write cannot land last, even when it is slow", async () => {
    const { indexedDbStorage, whenFlushed } = await import("./idb-storage");

    // Persist writes the whole state on every change, so this is exactly the
    // shape of two quick changes in a row: the second value must win, and it
    // must win because of the order they were asked in, not because of which
    // transaction the database happened to finish first.
    const first = Promise.resolve(
      indexedDbStorage.setItem("workaxis-demo", "older"),
    );
    const second = Promise.resolve(
      indexedDbStorage.setItem("workaxis-demo", "newer"),
    );
    await settle();

    // Hold the first open for a long while before letting it go. There is no
    // second transaction to race it with, because there cannot be.
    await settle();
    await settle();
    expect(fake.pending).toHaveLength(1);

    fake.pending[0]!.commit();
    await settle();
    fake.pending[1]!.commit();
    await settle();
    await Promise.all([first, second]);

    expect(await whenFlushed()).toBe(true);
    expect(
      fake.stored.get("workaxis-demo"),
      "the older write landed last and undid the newer one",
    ).toBe("newer");
  });

  it("a failed write does not stop the next one from being attempted", async () => {
    const { indexedDbStorage, whenFlushed } = await import("./idb-storage");

    void indexedDbStorage.setItem("workaxis-demo", "doomed");
    void indexedDbStorage.setItem("workaxis-demo", "wanted");
    await settle();

    fake.pending[0]!.abort();
    await settle();

    // A rejection must not poison the chain: the device may recover, and a
    // queue that stopped at the first failure would lose everything after it
    // without ever saying so.
    expect(fake.pending).toHaveLength(2);
    fake.pending[1]!.commit();
    await settle();

    expect(await whenFlushed()).toBe(true);
    expect(fake.stored.get("workaxis-demo")).toBe("wanted");
  });
});

describe("a write that could not be attempted did not happen", () => {
  /*
   * The three paths that used to leave before reaching the write chain. The
   * chain is the only place `lastFailure` is set, so each of them made
   * `whenFlushed()` answer **yes** having stored nothing — and `useSaving`
   * reads that as "saved" and fires the success message. On a browser with
   * site data blocked a person would see "this device is not saving changes"
   * and "WO-1042 cancelled" at the same moment.
   *
   * Found by the reviewer on #59 with a temporary unit test; these are the
   * permanent ones the branches never had. The expected values are the
   * reviewer's: `whenFlushed` false, `isDurable` false.
   */

  it("says so when the browser has no IndexedDB at all", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("indexedDB", undefined);
    const { indexedDbStorage, whenFlushed, isDurable } =
      await import("./idb-storage");

    await indexedDbStorage.setItem("workaxis-demo", "nowhere to put this");

    expect(await whenFlushed()).toBe(false);
    expect(isDurable()).toBe(false);
  });

  it("says so for a delete with no IndexedDB either", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("indexedDB", undefined);
    const { indexedDbStorage, whenFlushed, isDurable } =
      await import("./idb-storage");

    await indexedDbStorage.removeItem("workaxis-demo");

    expect(await whenFlushed()).toBe(false);
    expect(isDurable()).toBe(false);
  });

  it("says so while writes are held after a failed read", async () => {
    const { indexedDbStorage, whenFlushed, isDurable, holdWrites } =
      await import("./idb-storage");

    // Seeded first, and that is the whole point of the line.
    //
    // This assertion was vacuous when it was written: it checked that the key
    // was absent from a store nothing had ever put it in, so it was false
    // whether the delete had been refused or executed. Measured by the review,
    // not by me — and it is the shape I have a memory of writing down: a check
    // whose subject can be empty needs a floor.
    fake.stored.set("workaxis-demo", "the records this hold protects");

    holdWrites();
    await indexedDbStorage.setItem("workaxis-demo", "held back");

    expect(await whenFlushed()).toBe(false);
    expect(isDurable()).toBe(false);

    // And the records are not deleted either — the delete path had no
    // `writesHeld` guard at all, so it would have removed the very blob the
    // hold exists to protect. This line goes red if that guard is taken out.
    await indexedDbStorage.removeItem("workaxis-demo");
    expect(await whenFlushed()).toBe(false);
    expect(fake.stored.get("workaxis-demo")).toBe(
      "the records this hold protects",
    );
  });
});
