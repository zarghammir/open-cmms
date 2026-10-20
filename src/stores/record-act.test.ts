import { beforeEach, expect, it } from "vitest";
import { buildSeed, SEED_VERSION } from "@/data/seed";
import { toIsoDate } from "@/data/seed/dates";
import type { MutationAudit } from "./mutations";
import { useDemoStore } from "./demo-store";
import { indexedDbStorage, whenFlushed } from "./idb-storage";

/**
 * An act that changes no record still reaches the trail.
 *
 * `commitMany` returns without writing when it is handed nothing, and that
 * guard stays: an import of zero rows must write zero rows. What it also did
 * was make an act with no changes unrecordable — and exporting is one. Somebody
 * asks the demonstration for a file of its records, which is a real thing done
 * to real data, and the trail said nothing.
 *
 * **Through the real store module, and that is the whole point of this file.**
 * The defect was invisible to the repository tests because their harnesses
 * implement `commitMany` themselves: a harness that writes when it is handed an
 * empty list will happily report that an empty act is recorded, while the store
 * the application actually runs returns early. A test can only see this by
 * importing the store.
 *
 * The same reasoning covers the durability half. Asserting the entry is in
 * `getState()` proves `set` ran; it says nothing about the write reaching
 * storage, and this project has spent a whole ticket on that difference. So the
 * assertion is made against what the **storage adapter holds**, read back
 * through its own `getItem`, after the write chain has settled.
 */

const STORAGE_KEY = "workaxis-demo";
const DAY = new Date("2026-09-15T12:00:00.000Z");

const EXPORT_AUDIT: MutationAudit = {
  entity: "demo",
  action: "updated",
  summaryKey: "audit.dataRefreshed",
  summaryParams: {},
};

const ACTOR = { userId: "usr-test", role: "administrator" as const };

beforeEach(async () => {
  const data = buildSeed(DAY);
  useDemoStore.setState({
    status: "ready",
    data,
    seededOn: toIsoDate(DAY),
    seedVersion: SEED_VERSION,
    hydrated: true,
    auditSequence: 0,
    outbox: [],
  });
  // Let the write that `setState` just started finish, so the reads below are
  // about this test's act and not about its own setup still landing.
  await whenFlushed();
});

/** The audit entries the storage adapter is holding, not the ones in memory. */
async function storedAuditEvents(): Promise<{ summaryKey: string }[]> {
  const raw = await indexedDbStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const blob = JSON.parse(raw) as {
    state: { data: { auditEvents: { summaryKey: string }[] } | null };
  };
  return blob.state.data?.auditEvents ?? [];
}

it("writes a trail entry for an act that changed nothing", async () => {
  const before = useDemoStore.getState().data!.auditEvents.length;
  expect(
    before,
    "the seed wrote no trail, so nothing below is a comparison",
  ).toBeGreaterThan(0);

  useDemoStore.getState().recordAct(EXPORT_AUDIT, ACTOR, "org-1");

  const after = useDemoStore.getState().data!.auditEvents;
  expect(after.length, "the act left no entry in the trail").toBe(before + 1);

  const entry = after.find((one) => one.summaryKey === EXPORT_AUDIT.summaryKey);
  expect(entry, "the entry is not the one this act asked for").toBeDefined();

  /*
   * And it names the person, which is the half a trail is for.
   *
   * `AuditEvent` is a union: a system entry carries no user at all, so this
   * narrows before reading one rather than reaching past the type. An export
   * recorded as something the system did would be a worse entry than none —
   * it is a person asking for a copy of the records.
   */
  expect(entry!.actorKind, "the act was recorded as the system's").toBe(
    "person",
  );
  if (entry!.actorKind !== "person") throw new Error("unreachable");
  expect(entry!.actorUserId).toBe(ACTOR.userId);
});

it("puts that entry through the same write as every other change", async () => {
  useDemoStore.getState().recordAct(EXPORT_AUDIT, ACTOR, "org-1");
  await whenFlushed();

  /*
   * Read out of the storage adapter rather than out of the store.
   *
   * `getState()` proves `set` ran. Persist's write happens after that and can
   * fail on its own — WA-67 is a whole ticket about a screen that said "saved"
   * before the browser had it. This asks the adapter what it is holding.
   *
   * What it proves and what it does not: the entry reached storage through the
   * ordinary persisted path, serialised behind every other write. It does not
   * prove an IndexedDB transaction committed, because there is no IndexedDB in
   * a unit run — the adapter falls back to memory. That half belongs to a
   * browser, and `recordAct` does nothing special to reach the database: it
   * calls `set`, like every other write in this store.
   */
  const stored = await storedAuditEvents();
  expect(
    stored.length,
    "nothing at all reached storage, so this proves nothing about the entry",
  ).toBeGreaterThan(0);
  expect(
    stored.some((one) => one.summaryKey === EXPORT_AUDIT.summaryKey),
    "the entry is in the store and not in what was written",
  ).toBe(true);
});

it("queues nothing, because there is nothing to send", () => {
  useDemoStore.getState().recordAct(EXPORT_AUDIT, ACTOR, "org-1");

  // The queue replays changes to a server. An empty batch cannot fail, cannot
  // conflict and cannot be applied, and the pending count would have risen for
  // an act needing nobody's attention.
  expect(
    useDemoStore.getState().outbox,
    "an act with no changes was queued",
  ).toHaveLength(0);
});

it("leaves the guard on `commitMany` exactly as it was", () => {
  /*
   * The half that says this is additive.
   *
   * An import of zero rows must still write nothing — an entry claiming
   * records moved when none did is a worse trail than a silent one. If a later
   * change "helpfully" relaxes that guard to fix an export, this fails and
   * names it.
   */
  const before = useDemoStore.getState().data!.auditEvents.length;
  useDemoStore.getState().commitMany([], EXPORT_AUDIT, ACTOR, "org-1");
  expect(
    useDemoStore.getState().data!.auditEvents.length,
    "an empty batch wrote a trail entry saying records moved",
  ).toBe(before);
});
