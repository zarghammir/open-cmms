"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { buildSeed, SEED_VERSION, type DemoData } from "@/data/seed";
import type {
  AuditEvent,
  EmailLogEntry,
  Id,
  IsoDate,
  IsoDateTime,
  Notification,
} from "@/domain/types";
import {
  holdWrites,
  indexedDbStorage,
  isDurable,
  onDurableChange,
} from "./idb-storage";
import {
  applyMutation,
  applyMutations,
  type Actor,
  type Mutation,
  type MutationAudit,
} from "./mutations";
import { toIsoDate } from "@/data/seed/dates";
import {
  inQueueOrder,
  recordLabel,
  subjectKey,
  type OutboxEntry,
} from "./outbox";
import {
  PLANTED_CONFLICT,
  replayOutcome,
  shouldPlantConflict,
  versionOf,
  type ServerChange,
  type ServerVersions,
  type SyncLogEntry,
} from "@/lib/sync";

/**
 * The one store.
 *
 * Three states, not two. `unknown` is what the application knows before the
 * browser has read the database back: it is not "no records", and a screen
 * that drew it as an empty table would be lying. Every hook passes the status
 * up so a screen can show a skeleton, then records, then genuinely-empty.
 *
 * It stays empty during server rendering on purpose. Seeding at module load
 * would mean the server and the browser each deciding what "today" is, and
 * disagreeing across midnight is a hydration mismatch nobody could reproduce.
 */

/**
 * Three answers, not two. `unknown` is "the read has not finished"; `ready` is
 * "here are the records"; `unreadable` is "the read failed, and what is stored
 * is still there" — which is the one that must never be confused with an empty
 * store, because the boot's answer to empty is to seed over it.
 *
 * A list as well as a union, so a test can walk every member. A union alone
 * leaves nothing behind at runtime, and what has to be sayable is "each of
 * these is accounted for" — the same reason `WORK_ORDER_STATUSES` is a list
 * rather than only a type.
 *
 * Nothing outside this file compares a status to a member of it. Adding
 * `unreadable` to what had been a two-member union left five sites gating on
 * `=== "unknown"`, which `tsc` cannot see is now wrong, so screens went on
 * working over a store that held nothing. `hasRecords` in `@/hooks/use-demo-data`
 * is where that question is asked now, and `tests/unit/status-gate.test.ts`
 * keeps it there.
 */
export const DEMO_STATUSES = ["unknown", "ready", "unreadable"] as const;

export type DemoStatus = (typeof DEMO_STATUSES)[number];

interface DemoState {
  status: DemoStatus;
  data: DemoData | null;
  /** The day the records were generated for. Reseeded when it is no longer today. */
  seededOn: IsoDate | null;
  seedVersion: number;
  /**
   * The version the records were last stored at, when they had to be thrown
   * away to arrive here. Null once it has been said, and never persisted.
   *
   * It exists because the only thing that knows a rebuild happened is
   * `migrate`, and the only thing that can say so in the trail is
   * `ensureSeeded` — and between them the records, and their version, are
   * gone. Measured before it existed: a browser holding the previous version
   * rebuilt in silence, because by the time anything could write an entry
   * there was nothing left to say it about.
   */
  rebuiltFrom: number | null;
  auditSequence: number;
  hydrated: boolean;
  /**
   * Whether what this browser writes will still be here next time.
   *
   * The storage layer has always known — `isDurable()` — and nothing had ever
   * asked it. Recorded at rehydration so a screen can say so rather than
   * letting a person do an afternoon's work into a tab's memory.
   *
   * **Kept up to date, not sampled once.** Reading it at rehydration and never
   * again meant this said whatever was true at boot for the rest of the
   * session: a browser that stopped keeping changes at eleven o'clock went on
   * reporting `true` until the tab was closed. The standing notice reads this,
   * and a standing notice that cannot notice is worse than none — it is a
   * reassurance nobody asked for. The storage layer publishes the change now
   * and the subscription below records it.
   */
  durable: boolean | null;

  /** True when the browser reports a connection. Set by the shell. */
  online: boolean;
  /** Changes made here that the server has not been told about. */
  outbox: OutboxEntry[];
  /** What the simulated server holds: a version per record. */
  serverVersions: ServerVersions;
  /** What replay did, newest first, for the log in Settings. */
  syncLog: SyncLogEntry[];
  /** Whether the demonstration's one planted conflict has been used. */
  conflictPlanted: boolean;
  /** A change the server refused, waiting for somebody to choose. */
  pendingConflict: { entry: OutboxEntry; server: ServerChange } | null;

  /**
   * Applies a change, its audit entry and its queue entry. The only way one
   * change is written.
   *
   * `queue` is false only for changes that describe a decision about
   * synchronising rather than a change to send — recording which version of a
   * conflict somebody kept, for instance. Sending that back would be telling
   * the server about its own state.
   */
  commit: (mutation: Mutation, at?: IsoDateTime, queue?: boolean) => void;
  /**
   * Applies many changes as one act, under a single audit entry and a single
   * queue entry.
   *
   * For an import, and for anything else that is one decision a person made
   * rather than a run of separate ones. If any change is refused the whole call
   * throws and the store is left exactly as it was.
   *
   * One queue entry matters as much as one audit entry: replaying the pieces
   * separately would turn one thing that happened into several, and a
   * half-replayed batch is a state the records were never in.
   */
  commitMany: (
    mutations: readonly Mutation[],
    audit: MutationAudit,
    actor: Actor,
    entityId: Id,
    at?: IsoDateTime,
    queue?: boolean,
  ) => void;
  /**
   * Writes a trail entry for something a person did that changed no record.
   *
   * `commitMany` returns without writing when it is handed nothing, and that
   * guard is right: an import of zero rows must write zero rows, and a batch
   * that turned out to be empty should not leave an entry saying records
   * moved. But it makes an act with no changes **unrecordable**, and there is
   * at least one: exporting. Somebody asks the demonstration for a file of its
   * records, which is a real thing they did to real data, and the trail could
   * not say so — measured in a browser, where the entry simply never appeared.
   *
   * So this is beside `commitMany` rather than a relaxation of it. The guard
   * keeps its meaning, and an act that changes nothing says so explicitly
   * instead of being mistaken for a batch that came back empty.
   *
   * **Nothing is queued.** The queue replays changes to a server, and there is
   * nothing here to replay: the entry is the whole act. Queueing an empty
   * batch would put something in the outbox that cannot fail, cannot conflict
   * and cannot be applied, and the pending count would rise for an act that
   * needs nobody's attention.
   */
  /**
   * Appends records the rules worked out from the records already here.
   *
   * **Derived state, not a person's act**, and three things follow from that:
   *
   * *Nothing is queued.* A notice is produced by a rule reading this device's
   * own records. There is nothing to send — a server will run the same rules
   * over the same records and reach the same answer, and replaying these would
   * ask it to accept conclusions rather than changes. Going through
   * `commitMany` put a queue entry in the outbox per sweep, so a technician's
   * "waiting to send" screen filled with work nobody did.
   *
   * *No trail entry.* The notices **are** the record. A line reading "raised
   * 67 notifications" is not something anybody did, and attributing it to
   * whoever happened to be holding the demonstration is worse than silence —
   * which is what it did, directly above the entry explaining why their
   * records had just been discarded. If a notice ever needs a line of its own
   * it will be a system-kind entry and its own ticket.
   *
   * *The same write as everything else.* `set` is persisted and serialised, so
   * these land behind whatever is in flight and are durable on the same terms
   * as a work order.
   */
  applyDerived: (records: {
    notifications: readonly Notification[];
    emailLog: readonly EmailLogEntry[];
  }) => void;
  recordAct: (
    audit: MutationAudit,
    actor: Actor,
    entityId: Id,
    at?: IsoDateTime,
  ) => void;
  setOnline: (online: boolean) => void;
  /** Drains the queue in order. Stops at a conflict and waits to be told. */
  syncNow: (at?: IsoDateTime) => void;
  /** Answers the conflict on screen, then carries on draining. */
  resolveConflict: (
    choice: "mine" | "theirs",
    actor: Actor,
    at?: IsoDateTime,
  ) => void;
  /** Fills the store the first time, or after a reset. Safe to call twice. */
  ensureSeeded: (today: Date) => void;
  /** Puts the records back exactly as they started, and says so in the trail. */
  resetDemo: (today: Date, actor: Actor) => void;
}

const STORAGE_KEY = "workaxis-demo";

export const useDemoStore = create<DemoState>()(
  persist(
    (set, get) => ({
      status: "unknown",
      data: null,
      seededOn: null,
      seedVersion: SEED_VERSION,
      rebuiltFrom: null,
      auditSequence: 0,
      hydrated: false,
      durable: null,
      online: true,
      outbox: [],
      serverVersions: {},
      syncLog: [],
      conflictPlanted: false,
      pendingConflict: null,

      commit: (mutation, at, queue = true) => {
        const state = get();
        if (!state.data) {
          throw new Error("Cannot write before the records are loaded");
        }
        const sequence = state.auditSequence + 1;
        const when = at ?? new Date().toISOString();

        // The change lands in the local records whether or not there is a
        // connection: a technician has to see their own work. The queue is the
        // record of what the server has not been told, not of what has not
        // happened.
        const data = applyMutation(
          state.data,
          mutation,
          when,
          `aud-live-${String(sequence).padStart(6, "0")}`,
        );

        if (!queue) {
          set({ data, auditSequence: sequence });
          return;
        }

        const subject = { collection: mutation.collection, id: mutation.id };
        const entry: OutboxEntry = {
          id: `out-${String(sequence).padStart(6, "0")}`,
          kind: "one",
          // Labelled from the records *after* the change, not before: an insert
          // is not in the old snapshot, so looking there fell back to the
          // opaque id and the conflict screen offered "two versions of
          // wko-WO-2026-0041". Caught by reading a screenshot; no test asserted
          // the label's shape, so one does now.
          label: recordLabel(data, mutation.collection, mutation.id),
          queuedOffline: !state.online,
          subject,
          baseVersion: versionOf(subjectKey(subject), state.serverVersions),
          queuedAt: when,
          actor: mutation.actor,
          mutation,
        };

        set({
          data,
          auditSequence: sequence,
          outbox: [...state.outbox, entry],
        });

        // Online, a change is queued and sent in the same breath, so the queue
        // is empty in ordinary use and the pending count means what it says.
        if (state.online) get().syncNow(when);
      },

      setOnline: (online) => {
        const was = get().online;
        set({ online });
        // Coming back is what drains the queue. Nothing is retried while the
        // connection is still down, and nothing is retried on every render.
        if (online && !was) get().syncNow();
      },

      syncNow: (at) => {
        const state = get();
        // A conflict blocks the queue until somebody answers it. Replaying past
        // it would apply later changes to a record whose state is in dispute.
        if (!state.data || state.pendingConflict || !state.online) return;

        const when = at ?? new Date().toISOString();
        const versions: ServerVersions = { ...state.serverVersions };
        const log = [...state.syncLog];
        let planted = state.conflictPlanted;
        const remaining = inQueueOrder(state.outbox);

        while (remaining.length > 0) {
          const entry = remaining[0] as OutboxEntry;
          const subject = subjectKey(entry.subject);
          const plant = shouldPlantConflict(
            entry.subject.collection,
            planted,
            entry.queuedOffline,
          )
            ? { ...PLANTED_CONFLICT, at: when }
            : null;

          const outcome = replayOutcome(
            subject,
            entry.baseVersion,
            versions,
            plant,
            when,
          );

          if (outcome.kind === "conflict") {
            // Spent whether or not the person keeps their version: the server
            // has shown its hand, and showing it twice would be a second
            // conflict nobody caused.
            planted = true;
            set({
              outbox: remaining,
              serverVersions: versions,
              conflictPlanted: planted,
              syncLog: [
                {
                  id: entry.id,
                  subject,
                  label: entry.label,
                  at: when,
                  outcome: "conflicted",
                },
                ...log,
              ],
              pendingConflict: { entry, server: outcome.server },
            });
            return;
          }

          versions[subject] = outcome.version;
          log.unshift({
            id: entry.id,
            subject,
            label: entry.label,
            at: when,
            outcome: "applied",
          });
          remaining.shift();
        }

        set({
          outbox: remaining,
          serverVersions: versions,
          syncLog: log,
          conflictPlanted: planted,
        });
      },

      resolveConflict: (choice, actor, at) => {
        const state = get();
        const pending = state.pendingConflict;
        if (!pending || !state.data) return;

        const when = at ?? new Date().toISOString();
        const subject = subjectKey(pending.entry.subject);
        const versions: ServerVersions = { ...state.serverVersions };

        if (choice === "theirs") {
          // Their version wins, so ours is dropped and theirs is written here
          // — through the same commit path, so the trail says it happened.
          get().commit(
            {
              operation: "update",
              collection: pending.entry.subject.collection,
              id: pending.entry.subject.id,
              changes: { [pending.server.field]: pending.server.value },
              actor,
              audit: {
                entity: "workOrder",
                action: "statusChanged",
                summaryKey: "audit.conflictKeptTheirs",
                summaryParams: { record: pending.entry.label },
              },
            },
            when,
            false,
          );
        } else {
          get().commit(
            {
              operation: "update",
              collection: pending.entry.subject.collection,
              id: pending.entry.subject.id,
              changes: {},
              actor,
              audit: {
                entity: "workOrder",
                action: "statusChanged",
                summaryKey: "audit.conflictKeptMine",
                summaryParams: { record: pending.entry.label },
              },
            },
            when,
            false,
          );
        }

        versions[subject] = versionOf(subject, versions) + 1;

        set({
          serverVersions: versions,
          pendingConflict: null,
          outbox: get().outbox.filter((e) => e.id !== pending.entry.id),
          syncLog: [
            {
              id: pending.entry.id,
              subject,
              label: pending.entry.label,
              at: when,
              outcome: choice === "mine" ? "keptMine" : "keptTheirs",
            },
            ...get().syncLog,
          ],
        });

        // The rest of the queue was waiting on this answer.
        get().syncNow(when);
      },

      commitMany: (mutations, audit, actor, entityId, at, queue = true) => {
        const state = get();
        if (!state.data) {
          throw new Error("Cannot write before the records are loaded");
        }
        if (mutations.length === 0) return;
        const sequence = state.auditSequence + 1;
        // `applyMutations` throws before returning if any change is refused, so
        // `set` is never reached with a half-applied copy. That is what makes
        // this all-or-nothing rather than merely tidy.
        const next = applyMutations(
          state.data,
          mutations,
          audit,
          actor,
          entityId,
          at ?? new Date().toISOString(),
          `aud-live-${String(sequence).padStart(6, "0")}`,
        );
        if (!queue) {
          set({ data: next, auditSequence: sequence });
          return;
        }

        // One act, one entry. The subject is the record the act is about, so a
        // batch is versioned and refused as a unit — replaying a batch in
        // pieces would turn one thing that happened into several, and a
        // half-replayed batch is a state the records were never in.
        const first = mutations[0] as Mutation;
        const subject = { collection: first.collection, id: entityId };
        const when = at ?? new Date().toISOString();
        const entry: OutboxEntry = {
          id: `out-${String(sequence).padStart(6, "0")}`,
          kind: "many",
          label: recordLabel(next, first.collection, entityId),
          queuedOffline: !state.online,
          subject,
          baseVersion: versionOf(subjectKey(subject), state.serverVersions),
          queuedAt: when,
          actor,
          mutations,
          audit,
          entityId,
        };

        set({
          data: next,
          auditSequence: sequence,
          outbox: [...state.outbox, entry],
        });

        if (state.online) get().syncNow(when);
      },

      applyDerived: (records) => {
        const state = get();
        if (!state.data) {
          throw new Error("Cannot write before the records are loaded");
        }
        if (
          records.notifications.length === 0 &&
          records.emailLog.length === 0
        ) {
          return;
        }

        /*
         * Appended directly rather than through `applyMutation`, because that
         * writes a trail entry by construction and a trail entry is exactly
         * what must not happen here. The guard above has the same shape as
         * `commitMany`'s: asked to write nothing, write nothing.
         */
        set({
          data: {
            ...state.data,
            notifications: [
              ...state.data.notifications,
              ...records.notifications,
            ],
            emailLog: [...state.data.emailLog, ...records.emailLog],
          },
        });
      },

      recordAct: (audit, actor, entityId, at) => {
        const state = get();
        if (!state.data) {
          throw new Error("Cannot write before the records are loaded");
        }

        /*
         * The same write as `commitMany` makes, with an empty change list.
         *
         * `applyMutations` folds the changes and then appends the entry, so
         * folding nothing and appending the entry is exactly what it already
         * does — there is no second path here, and no second way for the
         * trail's numbering to drift. `auditSequence` advances as it does for
         * any other act, because this *is* another act.
         *
         * `set` is what makes it durable: every `set` on this store is a write
         * through persist, which serialises them and resolves on the commit.
         * Nothing extra is needed to reach the database, and nothing here may
         * bypass it.
         */
        const sequence = state.auditSequence + 1;
        const next = applyMutations(
          state.data,
          [],
          audit,
          actor,
          entityId,
          at ?? new Date().toISOString(),
          `aud-live-${String(sequence).padStart(6, "0")}`,
        );

        set({ data: next, auditSequence: sequence });
      },

      ensureSeeded: (today) => {
        const state = get();

        // Known-empty only. An unreadable store still holds the person's
        // records; seeding here is what destroyed them, and a screen showing a
        // skeleton forever is a worse outcome than a wrong one only if you
        // ignore that the wrong one is silent and permanent.
        if (state.status === "unreadable") return;
        const day = toIsoDate(today);
        const usable =
          state.data !== null &&
          state.seedVersion === SEED_VERSION &&
          state.seededOn === day;

        if (usable) {
          if (state.status !== "ready") set({ status: "ready" });
          return;
        }

        const fresh = buildSeed(today);

        // Why the records changed under somebody, in the trail rather than
        // nowhere. A rebuild discards everything they had done, and the
        // newest entry afterwards used to be one of the seed's own — so a
        // person who opened the demonstration after a deploy found their work
        // gone and the trail saying nothing about it.
        //
        // Nothing is said on a first visit: there were no records, so none
        // were discarded, and an entry about it would be a claim about a
        // person who has not been here before.
        //
        // A version change and a day change can both be true at once, and
        // then it is one entry, not two: the version is why the records could
        // not have been kept, and the day would only have replaced them.
        // Which of the three this is. A version the records could not be kept
        // at, a day they were built for, or a first visit — and a first visit
        // discarded nothing, so it says nothing.
        //
        // `rebuiltFrom` is how the first one is known at all: persist discards
        // the records before this runs, so by now `seedVersion` says the
        // current version and `data` says null, and only the number carried
        // across the discard still remembers. The in-memory comparison below
        // it stays for a store changed in place without a reload.
        const previousVersion =
          state.rebuiltFrom !== null && state.rebuiltFrom !== SEED_VERSION
            ? state.rebuiltFrom
            : state.data !== null && state.seedVersion !== SEED_VERSION
              ? state.seedVersion
              : null;

        const said: Pick<AuditEvent, "summaryKey" | "summaryParams"> | null =
          previousVersion !== null
            ? {
                summaryKey: "audit.dataRebuilt",
                summaryParams: { version: SEED_VERSION, previousVersion },
              }
            : state.data === null
              ? null
              : {
                  summaryKey: "audit.dataRefreshed",
                  summaryParams: {
                    day,
                    previousDay: state.seededOn ?? day,
                  },
                };

        const rebuilt: AuditEvent | null = said && {
          id: "aud-live-000001",
          organizationId: fresh.organization.id,
          at: new Date().toISOString(),
          // Nobody did this. The application did, and the trail has somewhere
          // to say so rather than naming a person who was not involved or an
          // author it could not read.
          actorKind: "system",
          entity: "demo",
          entityId: "demo",
          action: "rebuilt",
          summaryKey: said.summaryKey,
          summaryParams: said.summaryParams,
          changes: [],
        };

        set({
          data: rebuilt
            ? { ...fresh, auditEvents: [rebuilt, ...fresh.auditEvents] }
            : fresh,
          seededOn: day,
          seedVersion: SEED_VERSION,
          // Said once. A reload after this would otherwise find the same
          // number still there and say it again, and an entry that reappears
          // every boot is noise in the one place noise is least affordable.
          rebuiltFrom: null,
          auditSequence: rebuilt ? 1 : 0,
          status: "ready",
        });
      },

      resetDemo: (today, actor) => {
        const fresh = buildSeed(today);
        const at = new Date().toISOString();
        set({
          data: {
            ...fresh,
            auditEvents: [
              {
                id: "aud-live-000001",
                organizationId: fresh.organization.id,
                at,
                actorKind: "person",
                actorUserId: actor.userId,
                actorRole: actor.role,
                entity: "demo",
                entityId: "demo",
                action: "demoReset",
                summaryKey: "audit.demoReset",
                summaryParams: {},
                changes: [],
              },
              ...fresh.auditEvents,
            ],
          },
          seededOn: toIsoDate(today),
          seedVersion: SEED_VERSION,
          auditSequence: 1,
          status: "ready",
          // The demonstration has to be re-runnable: a spent conflict and a
          // half-drained queue would make the second run different from the
          // first.
          outbox: [],
          serverVersions: {},
          syncLog: [],
          conflictPlanted: false,
          pendingConflict: null,
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => indexedDbStorage),
      version: SEED_VERSION,
      // Only the records and where they came from are worth keeping. Status
      // and the hydration flag describe this tab, not the data.
      partialize: (state) => ({
        data: state.data,
        seededOn: state.seededOn,
        seedVersion: state.seedVersion,
        auditSequence: state.auditSequence,
        // The queue survives a reload on purpose: work done in a corridor with
        // no signal must still be waiting after the phone is locked and opened
        // again.
        outbox: state.outbox,
        serverVersions: state.serverVersions,
        syncLog: state.syncLog,
        conflictPlanted: state.conflictPlanted,
      }),
      // A version bump rebuilds rather than migrates: the stored records are
      // discarded and the next boot generates the seed again. Right for data
      // that is entirely generated — and worth stating, because nothing is
      // carried across, so changes made in the browser do not survive a bump.
      // The one number that survives the discard: which version the records
      // were at. Everything else goes, and the next boot says in the trail
      // what happened to it — see `rebuiltFrom`. It is not persisted, so a
      // reload after the entry has been written says nothing a second time.
      migrate: (_persisted, version) => ({
        data: null,
        seededOn: null,
        seedVersion: SEED_VERSION,
        rebuiltFrom: version,
        auditSequence: 0,
        outbox: [],
        serverVersions: {},
        syncLog: [],
        conflictPlanted: false,
      }),
      onRehydrateStorage: () => (state, error) => {
        // Records, nothing, or a failure — and the third is not the second.
        // This used to collapse all three into "ready or unknown", and
        // `ensureSeeded` reads "unknown" as a first visit and seeds. That is
        // how a browser that could not be read had its records replaced.
        //
        // Runs twice on a rehydrate cycle, measured, so it sets a value rather
        // than toggling one: writing the same answer twice changes nothing.
        // Before anything else, including the setState below: this state has
        // no records in it, and persisting it would put `data: null` where the
        // records still are.
        if (error) holdWrites();

        useDemoStore.setState({
          hydrated: true,
          durable: isDurable(),
          status: error ? "unreadable" : state?.data ? "ready" : "unknown",
        });
      },
    },
  ),
);

/**
 * The storage layer's answer, followed rather than sampled.
 *
 * At module scope, so it is in place before the first write and there is
 * exactly one of it. `onRehydrateStorage` would have been the obvious home and
 * is the wrong one: it runs **twice** on a rehydrate cycle — the comment there
 * says so, measured — and two subscriptions would each set the same value, a
 * waste that grows every time anything rehydrates.
 *
 * The unsubscribe is deliberately dropped. This store lives as long as the
 * module that defines it, so there is no moment at which stopping would be
 * right, and holding a function nobody can call would only suggest otherwise.
 *
 * Rehydration still reads `isDurable()` directly, and that is not redundant:
 * the boot read happens before this store finishes being created, so the first
 * answer is already in the past by the time anything can hear it.
 */
onDurableChange((durable) => {
  /*
   * Nothing before the boot has finished, and the browser suite is why.
   *
   * A `setState` on a persisted store **is a write**: zustand's persist calls
   * `setItem` on every one of them. The first version of this subscription
   * listened from the moment the module loaded — so a failed boot read called
   * `setDurable(false)` from inside `getItem`, this fired, and the store
   * persisted the state it had at that instant, which is the initial one with
   * `data: null`, straight over the records that were still on the device.
   *
   * `onRehydrateStorage` calls `holdWrites()` for exactly that, and it had not
   * run yet. `boot-data-loss.spec.ts` caught it on the first full run: 119
   * audit entries became -4, "no records in the blob". That is WA-58's defect,
   * reintroduced by a fix to a message about it.
   *
   * So this follows the storage layer only once the boot has decided. The boot
   * is not missed: rehydration reads `isDurable()` directly, which is the
   * answer this would have delivered.
   */
  if (!useDemoStore.getState().hydrated) return;
  useDemoStore.setState({ durable });
});
