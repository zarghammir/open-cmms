import type { DemoData } from "@/data/seed";
import type { Actor, Mutation, MutationAudit } from "@/stores/mutations";
import type { Id, IsoDateTime } from "@/domain/types";

/**
 * What a repository is given: a way to read the records, one way to write, and
 * the clock. Nothing else — which is what lets every repository be tested
 * without a store, a browser or a React tree.
 *
 * `data` is read **every time it is touched**, and callers are expected to make
 * that live rather than a snapshot. A caller that passes a fixed object hands
 * every repository the records as they were at that moment, and a handler
 * writing twice then reads, on its second write, a world in which its first did
 * not happen. The unit harnesses always used a getter; the application did not,
 * and that asymmetry is WA-76 — the suite was green and the screen was not.
 *
 * So the seven harnesses that build a context with `get data()` are right and
 * stay. A harness that passed a fixed object would now be the wrong control: it
 * would be testing a caller the application no longer has, and it would pass
 * whether or not the repository under it reads live records. There is no shared
 * helper to hang that note on — each harness builds its own context — so it
 * lives here, on the contract every one of them implements.
 *
 * Phase 2 replaces the implementations with REST calls. Nothing above this
 * line changes.
 */
export interface RepositoryContext {
  data: DemoData;
  commit: (mutation: Mutation, at?: IsoDateTime) => void;
  /**
   * Many changes as one act: one audit entry, one entry in the offline queue,
   * all-or-nothing. An import is one thing a person did, not two hundred
   * things, and neither is a repository method that writes several records —
   * counting those separately is what made the pending count read six when
   * three things had been done.
   */
  commitMany: (
    mutations: readonly Mutation[],
    audit: MutationAudit,
    actor: Actor,
    entityId: Id,
    at?: IsoDateTime,
  ) => void;
  now: () => Date;
}
