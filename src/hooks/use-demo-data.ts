"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { createRepositories, type Repositories } from "@/data/repositories";
import type { DemoData } from "@/data/seed";
import { currentUserIdForRole } from "@/data/seed/people";
import type { Role } from "@/domain/constants/roles";
import type { Id, IsoDateTime } from "@/domain/types";
import type { AuditPhrase } from "@/lib/audit-summary";
import type { SyncLogEntry } from "@/lib/sync";
import { useDemoStore, type DemoStatus } from "@/stores/demo-store";
import type { Actor } from "@/stores/mutations";
import { inQueueOrder, type OutboxEntry } from "@/stores/outbox";

/**
 * How a screen reaches the records.
 *
 * The status travels with the data, always. Before the browser has read the
 * database back there are no records *and no answer*, which is a different
 * thing from there being none — and a table that drew "nothing here" during
 * that moment would be telling a reviewer something untrue.
 */

/**
 * Whether a screen may draw records. Asked here, never at a call site.
 *
 * `status === "unknown"` was valid TypeScript against a two-member union and
 * stayed valid when a third member arrived, so five sites went on gating on one
 * member while silently admitting the others. Two of them offered a technician
 * a camera over a store that held nothing, and an unmatched code there means
 * "we do not hold this" — so a read that failed was reported to the person as a
 * part the system does not have. A wrong answer, presented as an answer.
 *
 * The switch is exhaustive and its default assigns to `never`, which is the
 * whole point: a fourth member cannot be added without this function failing to
 * compile, so the decision about what a new state means is forced here, once,
 * rather than made by default at every call site that never heard of it.
 *
 * That catches a new *member*. It says nothing about a new *call site* written
 * the old way, which is a different question with a different answer:
 * `tests/unit/status-gate.test.ts` reads the source and fails on one.
 */
export type RecordsState = "records" | "reading" | "unreadable";

/**
 * What the store's state means to a screen, in the screen's own vocabulary.
 *
 * WA-68 asked one question — may a screen draw records? — and a boolean was
 * enough for it. WA-66 asks the second: *why not*. Waiting and unreadable are
 * different answers to a person, and collapsing them is what left a failed read
 * showing a skeleton with no end.
 *
 * Widened here rather than answered by a new comparison at the gate, so there
 * is still exactly **one** exhaustive switch over `DemoStatus` in the codebase
 * and a fourth member still fails the build in one place. `hasRecords` is now
 * derived from this rather than parallel to it — two switches over one union
 * would be the duplication this design exists to remove.
 */
export function recordsState(status: DemoStatus): RecordsState {
  switch (status) {
    case "ready":
      return "records";
    case "unknown":
      return "reading";
    case "unreadable":
      return "unreadable";
    default: {
      const unhandled: never = status;
      return unhandled;
    }
  }
}

export function hasRecords(status: DemoStatus): boolean {
  // Waiting and unreadable are different answers to a person, and WA-66 gives
  // the second its own words — but neither is a store a screen may read from,
  // which is the only question this one asks.
  return recordsState(status) === "records";
}

export interface DemoDataResult {
  status: DemoStatus;
  data: DemoData | null;
}

export function useDemoData(): DemoDataResult {
  const status = useDemoStore((state) => state.status);
  const data = useDemoStore((state) => state.data);
  return { status, data };
}

export interface RepositoriesResult {
  status: DemoStatus;
  /**
   * Null whenever there are no records to build them from, never an empty
   * stand-in. That is not the same question as the status and must not be read
   * as an answer to it: ask `hasRecords`.
   */
  repositories: Repositories | null;
}

export function useRepositories(): RepositoriesResult {
  const status = useDemoStore((state) => state.status);
  const data = useDemoStore((state) => state.data);
  const commit = useDemoStore((state) => state.commit);
  const commitMany = useDemoStore((state) => state.commitMany);

  const repositories = useMemo(
    () =>
      data
        ? createRepositories({
            /*
             * Live, not the snapshot of this render — and the difference is a
             * defect two lanes hit in one evening.
             *
             * React does not re-render inside a click handler. Passing `data`
             * by value gave every repository the records as they were when the
             * component last rendered, so a handler that wrote twice read, on
             * its second write, a world in which its first write had not
             * happened. Measured: a sweep that raised one work order per click
             * instead of thirteen, because the second schedule was handed the
             * same free number as the first and `applyMutation` threw
             * `workOrders already holds id …` — a throw that escaped the
             * handler, so the person saw nothing at all.
             *
             * A getter costs nothing and removes the whole class: a repository
             * reads the records at the moment it is asked, which is what every
             * one of the seven unit harnesses has always given it. The
             * application was the only caller passing a snapshot, which is why
             * the suite was green and the screen was not.
             *
             * The memo keeps its dependency on `data`, so consumers still
             * re-render and recompute when the records change. This changes
             * what a repository *reads*, not when a screen redraws.
             */
            get data() {
              return useDemoStore.getState().data ?? data;
            },
            commit,
            commitMany,
            now: () => new Date(),
          })
        : null,
    [data, commit, commitMany],
  );

  return { status, repositories };
}

/**
 * Whether this browser is actually keeping what it is told.
 *
 * Three answers, like everything that reads the store. `null` is "nothing has
 * been read or written yet", which is not the same as "yes" — a screen that
 * treated it as yes would be vouching for a device nobody has asked. `false`
 * means a write did not reach the database, and the person needs telling,
 * because what is on their screen is not on their machine.
 *
 * This is `durable`'s first consumer. WA-58 put the value on the store and
 * nothing read it, which is the shape of the `isDurable()` the review flagged
 * one layer down: a signal with no consumer is not a signal.
 */
export function useDurable(): boolean | null {
  return useDemoStore((state) => state.durable);
}

/**
 * Who the demo is acting as. Phase 1 has no sign-in, so the role from the
 * cookie decides, and every audit entry names a seeded person rather than
 * "system".
 */
export function useActor(role: Role): Actor {
  return useMemo(() => ({ userId: currentUserIdForRole(role), role }), [role]);
}

/**
 * Fills the store once the browser has finished reading the database.
 *
 * Waiting matters: seeding before the read finishes would discard records the
 * reviewer had already changed, and seeding during server rendering would have
 * the server and the browser each decide what "today" is.
 */
export function useDemoBoot(): void {
  const hydrated = useDemoStore((state) => state.hydrated);
  const ensureSeeded = useDemoStore((state) => state.ensureSeeded);

  useEffect(() => {
    if (hydrated) {
      ensureSeeded(new Date());
    }
  }, [hydrated, ensureSeeded]);
}

/**
 * Rebuilds the records for today and writes the reset into the audit trail.
 *
 * A store-level operation rather than a repository one: it replaces every
 * collection at once, which is not something any single repository owns.
 */
export function useDemoReset(role: Role): () => void {
  const resetDemo = useDemoStore((state) => state.resetDemo);
  const actor = useActor(role);

  return useCallback(() => {
    resetDemo(new Date(), actor);
  }, [resetDemo, actor]);
}

/**
 * What is waiting to be sent, and whether we know yet.
 *
 * Three states like everything else that reads the store: `unknown` while the
 * browser is still reading the database, then a count. Drawing "nothing waiting
 * to send" during that moment would be a claim about a queue nobody has looked
 * at, and the queue is the one thing a technician needs to trust.
 */
export function usePendingChanges(): {
  status: DemoStatus;
  count: number;
  online: boolean;
} {
  const status = useDemoStore((state) => state.status);
  const outbox = useDemoStore((state) => state.outbox);
  const online = useDemoStore((state) => state.online);

  return { status, count: outbox.length, online };
}

/**
 * One queued change, in the shape a screen can draw.
 *
 * Deliberately not the outbox entry itself. Screens may not reach into the
 * store — the mutation, the base version and the subject are the queue's
 * business, not a reader's — and `phrase` is the half that makes a sentence,
 * so what a change *will* do is said in the same words the trail will use once
 * it has.
 */
export interface PendingChange {
  id: Id;
  /** The record as a person says it: a work-order number, an asset tag. */
  label: string;
  phrase: AuditPhrase;
  /** Written with no connection, which is worth saying on the screen. */
  queuedOffline: boolean;
  queuedAt: IsoDateTime;
  /** Who wrote it, so a change somebody else made can be named as theirs. */
  actorRole: Role;
}

function asPendingChange(entry: OutboxEntry): PendingChange {
  return {
    id: entry.id,
    label: entry.label,
    phrase: entry.kind === "one" ? entry.mutation.audit : entry.audit,
    queuedOffline: entry.queuedOffline,
    queuedAt: entry.queuedAt,
    actorRole: entry.actor.role,
  };
}

/**
 * The device's queue: what is waiting, in the order it will be sent.
 *
 * `changes` is null until the records have been read, never an empty array.
 * Nothing waiting and nothing known yet are different answers, and a screen
 * that drew the second as the first would tell a technician in a basement that
 * their work has gone through.
 *
 * The whole device's queue, not the current role's. Roles switch inside one
 * browser and the outbox belongs to the browser: filtering by actor would show
 * "nothing waiting" to somebody who had changed role while three changes sat
 * unsent. Each change carries the role that wrote it so the screen can say so
 * when it was not this one.
 */
export function usePendingQueue(): {
  status: DemoStatus;
  online: boolean;
  changes: PendingChange[] | null;
  /** The record the queue is stopped on, when two versions are in dispute. */
  stoppedOn: string | null;
  /** What replay did last, whatever it did — sent, refused, or resolved. */
  last: SyncLogEntry | null;
} {
  const status = useDemoStore((state) => state.status);
  const online = useDemoStore((state) => state.online);
  const outbox = useDemoStore((state) => state.outbox);
  const syncLog = useDemoStore((state) => state.syncLog);
  const conflict = useDemoStore((state) => state.pendingConflict);

  const ready = status === "ready";
  const changes = useMemo(
    () => (ready ? inQueueOrder(outbox).map(asPendingChange) : null),
    [ready, outbox],
  );

  return {
    status,
    online,
    changes,
    stoppedOn: ready ? (conflict?.entry.label ?? null) : null,
    last: ready ? (syncLog[0] ?? null) : null,
  };
}

/** What replay did, newest first. Null until the records have been read. */
export function useSyncLog() {
  const status = useDemoStore((state) => state.status);
  const syncLog = useDemoStore((state) => state.syncLog);

  return { status, entries: status === "ready" ? syncLog : null };
}

/**
 * Keeps the store's idea of the connection in step with the browser's.
 *
 * The event listener is the only source: polling `navigator.onLine` on a timer
 * would be a second answer to a question that already has one. Coming back
 * online is what drains the queue, and that happens in the store rather than
 * here, so a screen cannot forget to do it.
 */
export function useConnection(): boolean {
  const online = useSyncExternalStore(
    subscribeToConnection,
    () => navigator.onLine,
    () => true,
  );
  const setOnline = useDemoStore((state) => state.setOnline);
  const known = useDemoStore((state) => state.online);

  if (known !== online) {
    // Writing during render is deliberate and safe here: zustand's setter is
    // not React state, and an effect would leave a frame in which the banner
    // and the browser disagreed about the connection.
    setOnline(online);
  }

  return online;
}

function subscribeToConnection(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** The conflict waiting for an answer, and the way to answer it. */
export function useConflict(role: Role) {
  const pending = useDemoStore((state) => state.pendingConflict);
  const resolveConflict = useDemoStore((state) => state.resolveConflict);
  const actor = useActor(role);

  return {
    conflict: pending,
    keepMine: () => resolveConflict("mine", actor),
    keepTheirs: () => resolveConflict("theirs", actor),
  };
}
