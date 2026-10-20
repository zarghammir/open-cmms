import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed, SEED_VERSION } from "@/data/seed";
import { toIsoDate } from "@/data/seed/dates";
import { useDemoStore } from "./demo-store";
import { indexedDbStorage } from "./idb-storage";

/**
 * A blob written before this branch still reads.
 *
 * The offline queue added fields beside `data` rather than inside it, so
 * #27's DEMO_DATA_KEYS guard does not watch them — it looks at the keys of
 * `DemoData`. What governs them is the persist `version`, which in this store
 * is the same number as `SEED_VERSION`.
 *
 * Two mechanisms, proven separately because they answer different questions:
 *
 *   shallow merge  — a blob missing the new keys does not throw. Zustand's
 *                    default merge fills them from the store's initial state.
 *   version bump   — a blob from an older version is discarded rather than
 *                    carried, so stale queue state cannot survive a reseed.
 *
 * Nothing here hard-codes a version number. WA-37 takes SEED_VERSION to 3
 * after or before this branch, and a test that expected 2 would fail for a
 * reason that has nothing to do with what it is checking.
 */

const STORAGE_KEY = "workaxis-demo";

/** A blob in the shape this store wrote before the queue existed. */
function oldShape(version: number, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    version,
    state: {
      data: null,
      seededOn: "2026-09-01",
      seedVersion: version,
      auditSequence: 7,
      ...extra,
    },
  });
}

async function rehydrateFrom(blob: string) {
  await indexedDbStorage.setItem(STORAGE_KEY, blob);
  await useDemoStore.persist.rehydrate();
}

describe("reading a blob written before the queue existed", () => {
  beforeEach(() => {
    useDemoStore.setState({
      outbox: [],
      syncLog: [],
      pendingConflict: null,
      conflictPlanted: false,
      serverVersions: {},
    });
  });

  it("does not throw, and the queues read as empty rather than undefined", async () => {
    // The shallow-merge half. The blob has no outbox, no syncLog and no
    // pendingConflict; every screen that reads them must still get a value it
    // can use, not undefined.
    await expect(rehydrateFrom(oldShape(SEED_VERSION))).resolves.not.toThrow();

    const state = useDemoStore.getState();
    expect(Array.isArray(state.outbox)).toBe(true);
    expect(state.outbox).toEqual([]);
    expect(Array.isArray(state.syncLog)).toBe(true);
    expect(state.syncLog).toEqual([]);
    expect(state.pendingConflict).toBeNull();
    expect(state.conflictPlanted).toBe(false);
  });

  it("carries the old fields it does know about", async () => {
    // The control for the assertion above: the merge is doing something. If it
    // were dropping the persisted state wholesale, the queues would also be
    // empty and the test would pass while proving nothing.
    await rehydrateFrom(oldShape(SEED_VERSION));
    expect(useDemoStore.getState().auditSequence).toBe(7);
  });

  it("discards a blob from an older version rather than carrying it", async () => {
    // The version-bump half, and the one that matters when SEED_VERSION moves.
    // The stale blob claims a queue with something in it; none of it survives.
    await rehydrateFrom(
      oldShape(SEED_VERSION - 1, {
        outbox: [{ id: "stale", kind: "one" }],
        syncLog: [{ id: "stale" }],
        conflictPlanted: true,
      }),
    );

    const state = useDemoStore.getState();
    expect(state.outbox).toEqual([]);
    expect(state.syncLog).toEqual([]);
    expect(state.conflictPlanted).toBe(false);
    expect(state.auditSequence).toBe(0);
  });

  it("remembers the version it discarded, long enough to say so", async () => {
    // The gap this closes was measured, not imagined. `ensureSeeded` writes
    // the entry that tells a person why their records are gone, and by the
    // time it runs the discard has already happened: `data` is null and
    // `seedVersion` says the current version, so nothing is left to name.
    //
    // A store-level test that plants an older version with `setState` passes
    // either way, because it never goes through persist. This one does, and
    // it fails without the number carried across.
    await rehydrateFrom(oldShape(SEED_VERSION - 1));
    expect(useDemoStore.getState().rebuiltFrom).toBe(SEED_VERSION - 1);

    useDemoStore.getState().ensureSeeded(new Date("2026-09-12T00:00:00.000Z"));

    const first = useDemoStore.getState().data!.auditEvents[0]!;
    expect(first.summaryKey).toBe("audit.dataRebuilt");
    expect(first.summaryParams).toEqual({
      version: SEED_VERSION,
      previousVersion: SEED_VERSION - 1,
    });
    expect(first.actorKind).toBe("system");

    // And it is spent: a second boot finds nothing left to say.
    expect(useDemoStore.getState().rebuiltFrom).toBeNull();
  });

  it("says nothing about a rebuild when the version did not move", async () => {
    // The control for the test above. A blob at the current version is not
    // discarded, so there is nothing to explain — and an entry here would
    // appear on every ordinary boot.
    await rehydrateFrom(oldShape(SEED_VERSION));
    expect(useDemoStore.getState().rebuiltFrom).toBeNull();

    useDemoStore.getState().ensureSeeded(new Date("2026-09-12T00:00:00.000Z"));

    const events = useDemoStore.getState().data!.auditEvents;
    expect(
      events.some((event) => event.summaryKey === "audit.dataRebuilt"),
    ).toBe(false);
  });

  it("the two mechanisms are genuinely different", async () => {
    // Written as one assertion because it is one claim: at the current version
    // the persisted audit sequence survives, and one version back it does not.
    await rehydrateFrom(oldShape(SEED_VERSION));
    expect(useDemoStore.getState().auditSequence).toBe(7);

    await rehydrateFrom(oldShape(SEED_VERSION - 1));
    expect(useDemoStore.getState().auditSequence).toBe(0);
  });
});

/**
 * A document stored before this branch, read by the code that came after it.
 *
 * WA-21 gives `DocumentRecord` two fields it did not have —
 * `maintenancePlanId` and `previousVersionId` — and those live *inside* `data`,
 * where the shallow merge above cannot reach them. Nothing fills them in. What
 * protects a reader is the version bump discarding the blob entirely, and the
 * only way to know that is to write the old shape and rehydrate: planting it
 * with `setState` never goes through persist and passes either way.
 */
describe("a document written before the version bump", () => {
  /** A blob whose documents are the shape this store wrote at version 6. */
  function blobWithOldDocuments(version: number) {
    const seed = buildSeed(new Date("2026-09-12T00:00:00.000Z"));
    const [first] = seed.documents;
    const old = { ...first } as Record<string, unknown>;
    delete old.maintenancePlanId;
    delete old.previousVersionId;

    return JSON.stringify({
      version,
      state: {
        data: { ...seed, documents: [old] },
        seededOn: "2026-09-12",
        seedVersion: version,
        auditSequence: 3,
      },
    });
  }

  it("is discarded, so no reader is handed a chain it cannot walk", async () => {
    await rehydrateFrom(blobWithOldDocuments(SEED_VERSION - 1));

    const state = useDemoStore.getState();
    expect(state.data).toBeNull();
    expect(state.rebuiltFrom).toBe(SEED_VERSION - 1);
  });

  it("would otherwise have reached the reader with the fields missing", async () => {
    /*
     * The control, and the reason the bump is the fix rather than a formality.
     * The same blob at the current version is carried through untouched: the
     * merge fills keys beside `data`, never fields inside the records. So
     * `versionsOf` would walk `undefined` and a screen would show a document
     * with no history where it has three versions — no crash, a quiet wrong
     * answer. This is the hazard the number prevents.
     */
    await rehydrateFrom(blobWithOldDocuments(SEED_VERSION));

    const stored = useDemoStore.getState().data!.documents[0]!;
    expect(stored.previousVersionId).toBeUndefined();
    expect(stored.maintenancePlanId).toBeUndefined();
  });
});

/**
 * An estate stored before the containment equipment existed.
 *
 * WA-87 changes no field and adds no collection: the age ceiling is a fact
 * about the seed's catalogue, not a column on a record, so nothing a reader
 * touches is missing and nothing throws. That makes this the harder case of
 * the two above, not the easier one — the failure it prevents is silent.
 *
 * A browser that opened the demonstration earlier the same day satisfies
 * `seedVersion === SEED_VERSION && seededOn === day` without a bump, and keeps
 * a Moncton with no differential pressure monitors and assets older than
 * their own equipment would be. The screen answers every question confidently
 * and answers them about data the build no longer makes.
 *
 * Written through persist rather than `setState` for the same reason as above:
 * planting the old records directly never reaches the version check, so the
 * test would pass with the bump reverted.
 */
describe("an estate written before the containment equipment", () => {
  const CONTAINMENT = "atp-roomPressureMonitor";

  /** A blob whose records are the estate this store wrote at version 7. */
  function blobWithOldEstate(version: number) {
    const seed = buildSeed(new Date("2026-09-12T00:00:00.000Z"));
    const pinned = new Set([
      CONTAINMENT,
      "atp-effluentDecontamination",
      "atp-airlockInterlock",
      "atp-backflowPreventer",
      "atp-stomacher",
      "atp-bacteriologicalIncubator",
      "atp-waterBath",
      "atp-analyticalBalance",
    ]);

    // The old estate: none of the new equipment, and one asset installed in
    // 1996 — which the single age range this branch replaces could produce and
    // the per-type ceiling cannot.
    const assets = seed.assets
      .filter((asset) => !pinned.has(asset.assetTypeId))
      .map((asset, index) =>
        index === 0 ? { ...asset, installedAt: "1996-04-02" } : asset,
      );

    return JSON.stringify({
      version,
      state: {
        data: {
          ...seed,
          assetTypes: seed.assetTypes.filter((type) => !pinned.has(type.id)),
          assets,
        },
        seededOn: "2026-09-12",
        seedVersion: version,
        auditSequence: 3,
      },
    });
  }

  it("is discarded, so no reader is handed the estate that was replaced", async () => {
    await rehydrateFrom(blobWithOldEstate(SEED_VERSION - 1));

    const state = useDemoStore.getState();
    expect(state.data).toBeNull();
    expect(state.rebuiltFrom).toBe(SEED_VERSION - 1);
  });

  it("would otherwise have reached the reader intact and wrong", async () => {
    /*
     * The control, and the whole argument for the bump. Nothing here is
     * missing, so the shallow merge has nothing to fill and no screen errors:
     * the reader simply draws a Moncton with no containment equipment and an
     * asset thirty years old, beside a test file asserting neither can happen.
     */
    await rehydrateFrom(blobWithOldEstate(SEED_VERSION));

    const stored = useDemoStore.getState().data!;
    expect(stored.assetTypes.some((type) => type.id === CONTAINMENT)).toBe(
      false,
    );
    expect(
      stored.assets.some((asset) => asset.installedAt === "1996-04-02"),
    ).toBe(true);
  });

  it("the equipment it lacks is equipment this build makes", async () => {
    /*
     * The floor under both. If the containment types had never reached the
     * seed, the first assertion would hold for a reason that has nothing to do
     * with persistence and the control above would be measuring the absence of
     * something absent everywhere.
     */
    const seed = buildSeed(new Date("2026-09-12T00:00:00.000Z"));
    expect(seed.assetTypes.some((type) => type.id === CONTAINMENT)).toBe(true);
    expect(
      seed.assets.filter((asset) => asset.assetTypeId === CONTAINMENT).length,
    ).toBeGreaterThan(0);
  });
});

/**
 * One day, and the day string the store derives from it.
 *
 * Both blocks below turn on `seededOn === toIsoDate(today)`, and the store
 * reads its day in `America/Toronto`. A hand-written string beside a midnight
 * UTC date disagrees with it by one day and the control silently stops being a
 * control, so the day comes from the same function the store uses.
 */
const TODAY = new Date("2026-09-12T12:00:00.000Z");
const DAY = toIsoDate(TODAY);

/**
 * A blob written before the floor map still reads.
 *
 * WA-90 adds two collections to `DemoData`, so a browser that opened the
 * demonstration before it holds a `data` object with neither. Two different
 * things have to hold, and they fail differently:
 *
 *   the version   — `demo-store.ts` discards a store whose version is not this
 *                   one, so a blob at 9 is rebuilt rather than read. That is
 *                   the primary guard and it is why the map cannot meet a
 *                   `data` without placements.
 *   the merge     — if that guard were relaxed, the missing key reads as
 *                   `undefined` rather than throwing, so no screen errors and
 *                   the floor simply draws empty. A quiet wrong answer is the
 *                   hazard the number prevents, which is why the second test
 *                   here is the argument for the bump rather than a formality.
 *
 * **Both halves go through persist, and until WA-114 neither did.** This block
 * asserted that `JSON.parse(oldShape(SEED_VERSION - 1)).state.seedVersion ===
 * SEED_VERSION` is false: arithmetic on a fixture the test had just built,
 * which never touched the store and passed with the discard deleted. The shape
 * to copy is twenty lines above — plant the blob, rehydrate, assert what the
 * reader did with it — and the tautology was copied once before it was caught.
 */
describe("a store written before the floor map", () => {
  beforeEach(() => {
    useDemoStore.setState({ data: null, rebuiltFrom: null, auditSequence: 0 });
  });

  /** A blob whose records predate WA-90: no placements, no plans. */
  function blobWithoutTheFloor(version: number) {
    const data = buildSeed(TODAY) as unknown as Record<string, unknown>;
    delete data.assetPlacements;
    delete data.floorPlans;

    return JSON.stringify({
      version,
      state: { data, seededOn: DAY, seedVersion: version, auditSequence: 3 },
    });
  }

  it("is discarded, and the floor it lacked is there after the rebuild", async () => {
    await expect(rehydrateFrom(blobWithoutTheFloor(9))).resolves.not.toThrow();

    expect(useDemoStore.getState().data).toBeNull();
    expect(useDemoStore.getState().rebuiltFrom).toBe(9);

    useDemoStore.getState().ensureSeeded(TODAY);

    const data = useDemoStore.getState().data!;
    expect(data.assetPlacements.length).toBeGreaterThan(0);
    expect(data.floorPlans.length).toBeGreaterThan(0);
  });

  it("would otherwise have reached the map with no floor at all", async () => {
    /*
     * The control, and the reason the bump is the fix. The same blob at the
     * current version is carried through untouched: the shallow merge fills
     * keys beside `data`, never keys inside it, so the map would ask this
     * object for its placements and be handed `undefined`.
     */
    await rehydrateFrom(blobWithoutTheFloor(SEED_VERSION));

    const stored = useDemoStore.getState().data! as unknown as Record<
      string,
      unknown
    >;
    expect(stored.assetPlacements).toBeUndefined();
    expect(stored.floorPlans).toBeUndefined();
  });
});

/**
 * A floor stored with two markers on it, read by the build that draws eight.
 *
 * **The bump WA-114 nearly did not make, and the check that catches it.**
 * Nothing about the stored shape changes: an old blob parses cleanly under the
 * new reader, which is the question a shape check asks and the reason the first
 * answer here was "no bump". The version's other job is staleness — `usable =
 * seedVersion === SEED_VERSION && seededOn === day` — so without a bump a
 * browser opened earlier the same day keeps a floor with two markers on a build
 * that draws eight. It would heal overnight, on the `seededOn` half, which is
 * no use at all to somebody opening the demonstration the same afternoon.
 *
 * **The versions are written out rather than derived, and rolled by hand when
 * the number moves.** `SEED_VERSION - 1` always checks the adjacent version and
 * never the one that was jumped over, which is why these are literals — but a
 * literal is a fact with a date on it, so WA-121 moved them from 10 and 11 to
 * **11 and 12** rather than leaving them pointing at versions nobody holds any
 * more. 11 is WA-112's; 12 is WA-114's and what `main` carried until this
 * branch. The block twenty lines below still covers 9 and 10, so between them
 * the reader is exercised against every version a person can be holding.
 *
 * The stored records at those versions carry collections and shapes this branch
 * cannot rebuild, and do not need to: the discard is decided on the version,
 * before anything inside `data` is read.
 *
 * **The last test is what makes the first two mean anything.** The same floor
 * at the current version, on the same day, is kept — so the two above are the
 * version doing the work and not a store that rebuilds on principle.
 *
 * **What is stale at 13 is worse than what was stale at 12**, which is why this
 * block keeps earning its place. WA-114's stale store drew two markers where
 * eight belonged: obviously wrong, and the reader knew something was missing.
 * WA-121 re-traces every footprint against a drawing whose walls have moved, so
 * a stale store draws eight shapes, in confident colours, in the wrong rooms on
 * a plan that looks entirely correct. Nothing about it says it is stale.
 */
describe("a store written before every machine was placed", () => {
  beforeEach(() => {
    useDemoStore.setState({ data: null, rebuiltFrom: null, auditSequence: 0 });
  });

  /** The two machines the drawing carried before this branch. */
  const PLACED_BEFORE = ["AHU-MCT-11", "DHU-MCT-11"];

  /** A blob whose floor holds those two and nothing else. */
  function blobWithTwoMarkers(version: number) {
    const seed = buildSeed(TODAY);
    const kept = new Set(
      seed.assets
        .filter((asset) => PLACED_BEFORE.includes(asset.assetTag))
        .map((asset) => asset.id),
    );

    return JSON.stringify({
      version,
      state: {
        data: {
          ...seed,
          assetPlacements: seed.assetPlacements.filter((one) =>
            kept.has(one.assetId),
          ),
        },
        seededOn: DAY,
        seedVersion: version,
        auditSequence: 4,
      },
    });
  }

  it("this build draws a bigger floor than the one stored", () => {
    /*
     * The floor under the two below. They assert that a rebuilt store holds
     * every placement this build makes; if the build still made two, they
     * would pass with the rebuild having changed nothing at all.
     */
    const drawn = buildSeed(TODAY).assetPlacements.length;
    expect(drawn).toBeGreaterThan(PLACED_BEFORE.length);

    const stored = JSON.parse(blobWithTwoMarkers(11)) as {
      state: { data: { assetPlacements: unknown[] } };
    };
    expect(stored.state.data.assetPlacements).toHaveLength(
      PLACED_BEFORE.length,
    );
  });

  for (const stale of [11, 12]) {
    it(`discards a store written at version ${stale} and draws every machine`, async () => {
      await expect(
        rehydrateFrom(blobWithTwoMarkers(stale)),
      ).resolves.not.toThrow();

      // Discarded rather than carried, and the version remembered long enough
      // to be named.
      expect(useDemoStore.getState().data).toBeNull();
      expect(useDemoStore.getState().rebuiltFrom).toBe(stale);

      useDemoStore.getState().ensureSeeded(TODAY);

      const data = useDemoStore.getState().data!;
      expect(data.assetPlacements).toHaveLength(
        buildSeed(TODAY).assetPlacements.length,
      );

      // And the person is told why their records went, naming the version they
      // came from rather than the one before this.
      const first = data.auditEvents[0]!;
      expect(first.summaryKey).toBe("audit.dataRebuilt");
      expect(first.summaryParams).toEqual({
        version: SEED_VERSION,
        previousVersion: stale,
      });
    });
  }

  it("keeps that same floor when the store is already at this version", async () => {
    /*
     * The control, and the half a plant in a browser cannot skip either. Same
     * day, same two markers, only the version differs — and the records are
     * kept. Without this line the two tests above are equally satisfied by a
     * store that throws its records away on every boot, which would make the
     * demonstration unusable and the suite green.
     */
    await rehydrateFrom(blobWithTwoMarkers(SEED_VERSION));
    useDemoStore.getState().ensureSeeded(TODAY);

    const data = useDemoStore.getState().data!;
    expect(data.assetPlacements).toHaveLength(PLACED_BEFORE.length);
    expect(useDemoStore.getState().rebuiltFrom).toBeNull();
  });
});

/**
 * A blob at 9 and a blob at 10, both read by the 11 reader.
 *
 * **The skipped version is the case that matters, and it is the one an
 * arithmetic test misses.** The block above plants `SEED_VERSION - 1`, which
 * is 10 today and was 9 yesterday — so it always checks the adjacent version
 * and never the one that was jumped over. Three bumps landed on 2026-09-17
 * (9 for WA-87, 10 for WA-90, 11 here), and a reviewer with a tab open from
 * before the first of them meets the 11 reader having **never stored a 10**.
 *
 * Both are written out rather than derived, so this test keeps asking the same
 * question after the next bump instead of quietly following it upwards.
 *
 * The rebuild path makes them behave the same — a version that differs at all
 * discards and re-seeds — but "should be the same" is not "is the same", and
 * the whole family of defects this file exists for is a reader meeting a shape
 * nobody tried.
 */
describe("a store written before this version, read by this one", () => {
  beforeEach(() => {
    useDemoStore.setState({ data: null, rebuiltFrom: null, auditSequence: 0 });
  });

  /** A blob whose records predate WA-112: no rules, no defaults. */
  function blobWithoutTheNewCollections(version: number) {
    const data = buildSeed(
      new Date("2026-09-12T00:00:00.000Z"),
    ) as unknown as Record<string, unknown>;
    delete data.workflowRules;
    delete data.notificationDefaults;

    return JSON.stringify({
      version,
      state: {
        data,
        seededOn: "2026-09-12",
        seedVersion: version,
        auditSequence: 4,
      },
    });
  }

  for (const from of [9, 10]) {
    it(`discards a store at ${from} and rebuilds it with the new collections`, async () => {
      await expect(
        rehydrateFrom(blobWithoutTheNewCollections(from)),
      ).resolves.not.toThrow();

      // Discarded rather than carried: the records that had no rules are gone.
      expect(useDemoStore.getState().data).toBeNull();
      expect(useDemoStore.getState().rebuiltFrom).toBe(from);

      useDemoStore
        .getState()
        .ensureSeeded(new Date("2026-09-12T00:00:00.000Z"));
      const data = useDemoStore.getState().data!;

      /*
       * The reader's half. A screen asking for the rules must find them, and
       * `workflowRules[0]` must not be undefined — the work-order repository
       * reads it on every status move, and a store that rebuilt without it
       * would refuse every transition with the wrong reason.
       */
      expect(data.workflowRules).toHaveLength(1);
      expect(data.workflowRules[0]!.requireCompletionNote).toBe(true);
      expect(data.workflowRules[0]!.disabledTransitions).toEqual([]);
      expect(data.notificationDefaults.length).toBeGreaterThan(0);
      expect(
        data.notificationDefaults.every((one) => one.inApp && one.email),
      ).toBe(true);

      // And the person is told why their records went, naming the version
      // they came from rather than the one before this.
      const first = data.auditEvents[0]!;
      expect(first.summaryKey).toBe("audit.dataRebuilt");
      expect(first.summaryParams).toEqual({
        version: SEED_VERSION,
        previousVersion: from,
      });
    });
  }
});
