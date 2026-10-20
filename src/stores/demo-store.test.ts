import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed, SEED_VERSION } from "@/data/seed";
import type { WorkOrder } from "@/domain/types";
import { useDemoStore } from "./demo-store";
import type { Mutation, MutationAudit } from "./mutations";

/*
 * Two things are tested here and they arrived from different tickets: what a
 * version bump does to records already in a browser (WA-37), and what a refused
 * batch does to the store (WA-35). Both are about the store keeping its word
 * when something goes wrong, so they live together rather than in two files
 * named after their tickets.
 */

/**
 * What a version bump does to records already in a browser.
 *
 * AGENTS.md says a bump **rebuilds rather than migrates**: the stored records
 * are discarded and the seed is generated again. That is the right call for
 * data that is entirely generated, and it is worth a test rather than a
 * sentence, because the failure it prevents is silent — a store carrying
 * collections from an older shape, half-filled, with screens reading fields
 * that are not there.
 *
 * WA-37 is the bump that made this worth writing: it added `labourEntries` and
 * `workOrderComments`, and a store that migrated instead of rebuilding would
 * hand every screen an undefined collection.
 */

const TODAY = new Date("2026-09-12T00:00:00.000Z");

/** A record that could only have come from the stored state, never from the seed. */
const MARKER = "wko-PLANTED-BY-THE-TEST";

function plant(seedVersion: number) {
  const stored = buildSeed(TODAY);
  const marker = {
    ...(stored.workOrders[0] as WorkOrder),
    id: MARKER,
    number: "WO-0000-0000",
  };

  useDemoStore.setState({
    status: "ready",
    data: { ...stored, workOrders: [...stored.workOrders, marker] },
    seededOn: TODAY.toISOString().slice(0, 10),
    seedVersion,
    auditSequence: 0,
    hydrated: true,
  });
}

function plantedRecordSurvives(): boolean {
  return (
    useDemoStore
      .getState()
      .data?.workOrders.some((order) => order.id === MARKER) ?? false
  );
}

describe("a store persisted at an older version", () => {
  beforeEach(() => {
    useDemoStore.setState({
      status: "unknown",
      data: null,
      seededOn: null,
      seedVersion: SEED_VERSION,
      auditSequence: 0,
      hydrated: false,
    });
  });

  it("is rebuilt from the seed, not carried across", () => {
    plant(SEED_VERSION - 1);
    expect(plantedRecordSurvives()).toBe(true);

    useDemoStore.getState().ensureSeeded(TODAY);

    expect(plantedRecordSurvives()).toBe(false);
    expect(useDemoStore.getState().seedVersion).toBe(SEED_VERSION);
    expect(useDemoStore.getState().status).toBe("ready");
    // Rebuilt means exactly the seed, not the old records with the new
    // collections bolted on — with one addition, the entry saying the rebuild
    // happened. That entry is the only thing in the fresh records that did not
    // come from the seed, and taking it off the front is how this says so.
    const data = useDemoStore.getState().data!;
    expect({ ...data, auditEvents: data.auditEvents.slice(1) }).toEqual(
      buildSeed(TODAY),
    );
    expect(data.auditEvents[0]?.summaryKey).toBe("audit.dataRebuilt");
  });

  it("says in the trail that the records were rebuilt, and names both versions", () => {
    // A person who opens the demonstration after a deploy finds their work
    // gone. The newest entry used to be one of the seed's own, so the trail
    // said nothing about why — which is indistinguishable from the records
    // having been lost.
    plant(SEED_VERSION - 1);
    useDemoStore.getState().ensureSeeded(TODAY);

    const first = useDemoStore.getState().data!.auditEvents[0]!;
    expect(first.summaryKey).toBe("audit.dataRebuilt");
    expect(first.summaryParams).toEqual({
      version: SEED_VERSION,
      previousVersion: SEED_VERSION - 1,
    });

    // Nobody did this, and the entry says so rather than naming a person who
    // was not involved.
    expect(first.actorKind).toBe("system");
    expect(first.action).toBe("rebuilt");
  });

  it("says nothing when the records did not have to be rebuilt", () => {
    // The control that stops the entry firing on every boot: an entry that
    // appeared each time the application opened would be noise, and noise in a
    // trail is worse than an empty one.
    plant(SEED_VERSION);
    useDemoStore.getState().ensureSeeded(TODAY);

    const events = useDemoStore.getState().data!.auditEvents;
    expect(events.some((event) => event.actorKind === "system")).toBe(false);
    expect(plantedRecordSurvives()).toBe(true);
  });

  it("says the records were refreshed when only the day moved on", () => {
    // The same silence by a likelier trigger. A multi-day evaluation meets
    // this one rather than a version bump: the demonstration is seeded for a
    // day, and opening it the next day discards everything.
    plant(SEED_VERSION);
    useDemoStore.setState({ seededOn: "2026-09-11" });
    useDemoStore.getState().ensureSeeded(TODAY);

    const first = useDemoStore.getState().data!.auditEvents[0]!;
    expect(first.summaryKey).toBe("audit.dataRefreshed");
    expect(first.summaryParams).toEqual({
      day: "2026-09-12",
      previousDay: "2026-09-11",
    });
    expect(plantedRecordSurvives()).toBe(false);
  });

  it("says nothing on a first visit, because nothing was discarded", () => {
    // There were no records. An entry about records being replaced would be a
    // claim about somebody who has not been here before.
    useDemoStore.setState({ data: null, seededOn: null, status: "unknown" });
    useDemoStore.getState().ensureSeeded(TODAY);

    const events = useDemoStore.getState().data!.auditEvents;
    expect(events.some((event) => event.actorKind === "system")).toBe(false);
    expect(useDemoStore.getState().data).toEqual(buildSeed(TODAY));
  });

  it("arrives with the collections this version added", () => {
    // The failure the bump exists to prevent: a screen reading a collection
    // that an older store never held.
    plant(SEED_VERSION - 1);
    useDemoStore.getState().ensureSeeded(TODAY);

    const data = useDemoStore.getState().data!;
    expect(Array.isArray(data.labourEntries)).toBe(true);
    expect(Array.isArray(data.workOrderComments)).toBe(true);
    expect(data.labourEntries.length).toBeGreaterThan(0);
  });

  it("leaves a store at the current version alone", () => {
    /*
     * The control, and the one that makes the test above mean something. A
     * store that rebuilt on every boot would satisfy "the old records are
     * gone" while quietly throwing away work every time anyone reloaded. This
     * says the version is what decides.
     */
    plant(SEED_VERSION);

    useDemoStore.getState().ensureSeeded(TODAY);

    expect(plantedRecordSurvives()).toBe(true);
  });
});

/**
 * `commitMany` through the store, not through `applyMutations`.
 *
 * The pure function has its own tests and they prove it returns new data
 * without mutating what it was given. That is not the same claim as this one.
 * What a screen depends on is that a refused batch never reaches `set` — that
 * the records a reviewer is looking at do not change, and neither does the
 * counter that names the next audit entry. A function can be pure and a store
 * can still store half of what it produced.
 */

const NOW = new Date("2026-09-13T14:05:00.000Z");
const ACTOR = { userId: "usr-fortin", role: "administrator" } as const;

const IMPORT_AUDIT: MutationAudit = {
  entity: "importBatch",
  action: "imported",
  summaryKey: "audit.importCommitted",
  summaryParams: { fileName: "mp2-export-sample.xlsx", records: 2 },
};

function insertPart(id: string, from: ReturnType<typeof buildSeed>): Mutation {
  const source = from.parts[0]!;
  return {
    operation: "insert",
    collection: "parts",
    id,
    record: { ...source, id, partNumber: `IMP-${id}` },
    actor: { ...ACTOR },
    audit: {
      entity: "part",
      action: "created",
      summaryKey: "audit.partIssued",
      summaryParams: { partNumber: `IMP-${id}`, quantity: 0 },
    },
  };
}

function fill(online = true) {
  const seed = buildSeed(NOW);
  useDemoStore.setState({
    online,
    data: seed,
    status: "ready",
    seededOn: NOW.toISOString().slice(0, 10),
    auditSequence: 0,
    hydrated: true,
  });
  return seed;
}

describe("committing many changes through the store", () => {
  beforeEach(() => {
    useDemoStore.setState({ data: null, status: "unknown", auditSequence: 0 });
  });

  it("leaves the records, the trail and the counter untouched when a change is refused", () => {
    const seed = fill();
    const before = {
      parts: useDemoStore.getState().data!.parts.length,
      audit: useDemoStore.getState().data!.auditEvents.length,
      sequence: useDemoStore.getState().auditSequence,
    };

    // The second insert collides with a record already there. The first would
    // have applied perfectly well on its own — that is the point.
    expect(() =>
      useDemoStore
        .getState()
        .commitMany(
          [insertPart("prt-imp-1", seed), insertPart(seed.parts[0]!.id, seed)],
          IMPORT_AUDIT,
          { ...ACTOR },
          "imp-0001",
          NOW.toISOString(),
        ),
    ).toThrow();

    const after = useDemoStore.getState();
    expect(after.data!.parts).toHaveLength(before.parts);
    expect(after.data!.auditEvents).toHaveLength(before.audit);
    // The counter matters as much as the records: had it moved, the next entry
    // would be numbered as though something had been written.
    expect(after.auditSequence).toBe(before.sequence);
    expect(after.data!.parts.some((part) => part.id === "prt-imp-1")).toBe(
      false,
    );
  });

  it("would notice if nothing had been attempted — a clean batch writes both", () => {
    // The control. "Nothing changed" passes just as happily on a store that
    // cannot write at all, so this is the same call with nothing to refuse.
    const seed = fill();
    const before = {
      parts: useDemoStore.getState().data!.parts.length,
      audit: useDemoStore.getState().data!.auditEvents.length,
    };

    useDemoStore
      .getState()
      .commitMany(
        [insertPart("prt-imp-1", seed), insertPart("prt-imp-2", seed)],
        IMPORT_AUDIT,
        { ...ACTOR },
        "imp-0002",
        NOW.toISOString(),
      );

    const after = useDemoStore.getState();
    expect(after.data!.parts).toHaveLength(before.parts + 2);
    // Two records, one entry: a person performed one act.
    expect(after.data!.auditEvents).toHaveLength(before.audit + 1);
    expect(after.auditSequence).toBe(1);
    expect(after.data!.auditEvents[0]?.entityId).toBe("imp-0002");
  });

  it("refuses to write before the records have been read back", () => {
    // Status `unknown` is not "no records": writing into it would create a
    // store whose contents came from nowhere.
    const seed = buildSeed(NOW);
    expect(() =>
      useDemoStore
        .getState()
        .commitMany(
          [insertPart("prt-imp-1", seed)],
          IMPORT_AUDIT,
          { ...ACTOR },
          "imp-0003",
        ),
    ).toThrow();
  });
});

/**
 * An import is one act, and the trail and the queue both have to agree.
 *
 * `commitImport` writes hundreds of records through `commitMany`, which queues
 * for the offline outbox as well as writing the audit entry. If either half
 * counted per record, a technician who imported a spreadsheet offline would
 * come back online and replay hundreds of separate changes, and the trail would
 * read as hundreds of things somebody did rather than the one thing they did.
 */
describe("an import is one act in the trail and one in the queue", () => {
  /**
   * Offline on purpose. Online, the store queues a change and drains it in the
   * same breath, so the outbox is empty in ordinary use and counting it would
   * measure the sync rather than the queuing. Offline is where the queue is
   * observable, and offline is the case that matters: a technician importing a
   * spreadsheet in a plant room is exactly who must not come back online to
   * hundreds of separate changes.
   */
  beforeEach(() => {
    useDemoStore.setState({
      data: null,
      status: "unknown",
      auditSequence: 0,
      outbox: [],
      online: false,
    });
  });

  it("writes one audit entry and one outbox entry, however many records", () => {
    const seed = fill(false);
    const before = {
      audit: useDemoStore.getState().data!.auditEvents.length,
      outbox: useDemoStore.getState().outbox.length,
    };

    useDemoStore
      .getState()
      .commitMany(
        [
          insertPart("prt-imp-1", seed),
          insertPart("prt-imp-2", seed),
          insertPart("prt-imp-3", seed),
        ],
        IMPORT_AUDIT,
        { ...ACTOR },
        "imp-0100",
        NOW.toISOString(),
      );

    const after = useDemoStore.getState();
    expect(after.data!.parts).toHaveLength(seed.parts.length + 3);
    // Three records; one entry in each place.
    expect(after.data!.auditEvents).toHaveLength(before.audit + 1);
    expect(after.outbox).toHaveLength(before.outbox + 1);
    expect(after.outbox[0]?.kind).toBe("many");
  });

  it("would notice if either half had started counting per record", () => {
    // The control. "One entry" passes just as happily on a store that queued
    // nothing at all, so this proves both halves are actually written and that
    // the one entry covers every record rather than only the first.
    const seed = fill(false);
    useDemoStore
      .getState()
      .commitMany(
        [insertPart("prt-imp-1", seed), insertPart("prt-imp-2", seed)],
        IMPORT_AUDIT,
        { ...ACTOR },
        "imp-0101",
        NOW.toISOString(),
      );

    const after = useDemoStore.getState();
    expect(after.outbox).toHaveLength(1);
    expect(after.outbox[0]?.kind).toBe("many");
    expect(after.data!.auditEvents[0]?.entityId).toBe("imp-0101");
    // Both records are there, so the single entry is not a single record.
    expect(
      after.data!.parts.filter((part) => part.id.startsWith("prt-imp-")),
    ).toHaveLength(2);
  });

  it("refuses as one act too: nothing written, nothing queued", () => {
    const seed = fill(false);
    useDemoStore.setState({ online: false });
    expect(() =>
      useDemoStore
        .getState()
        .commitMany(
          [insertPart("prt-imp-1", seed), insertPart(seed.parts[0]!.id, seed)],
          IMPORT_AUDIT,
          { ...ACTOR },
          "imp-0102",
          NOW.toISOString(),
        ),
    ).toThrow();

    const after = useDemoStore.getState();
    expect(after.outbox).toEqual([]);
    expect(after.data!.parts).toHaveLength(seed.parts.length);
  });
});
