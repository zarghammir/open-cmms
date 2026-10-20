"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useDemoStore } from "@/stores/demo-store";
import { useDemoData, useRepositories } from "./use-demo-data";

/**
 * When the rules run, and why it is here rather than on a timer.
 *
 * The demonstration has no server, so there is nothing to run a schedule. Three
 * places were possible and two are wrong:
 *
 * **A timer** is the obvious answer and the worst one. Nothing would fire while
 * a reviewer sat on a screen for four minutes and then everything would at
 * once; a screenshot run pins the clock, and a pinned clock defeats a timer —
 * measured on WA-67, `held: 0` pinned against `held: 1` unpinned. A test would
 * have to wait for wall-clock time it cannot control.
 *
 * **Boot only** covers the time-based rules and misses every record-based one:
 * assign a job to somebody and they hear about it on their next reload, which
 * is not what the tender's clause asks for.
 *
 * **On boot and after every change**, which is this. Every event these rules
 * describe is either caused by a write or true from the moment the records are
 * read, so those two moments between them catch all six. It needs no clock of
 * its own, so a test can make an event happen and look at the screen, and a
 * screenshot run behaves like an ordinary one.
 *
 * **It cannot loop**, and that is worth saying because it writes in response to
 * a write. The rules name every event they report, and a notice carries the
 * name of its event, so the pass that follows the pass that wrote something
 * finds nothing new and writes nothing. The termination is the dedupe, not a
 * flag — which also means removing the dedupe does not merely duplicate
 * notices, it spins. That is in the evaluator's own comment as well.
 */
/**
 * The marker's element, so a pass can write what it did straight onto it.
 *
 * `useState` was the first shape and the React Compiler lint refuses it: a
 * `setState` inside an effect cascades a render, and it said so. The rule is
 * right here rather than merely strict — this is a **test instrument**, not
 * state any screen reads, so re-rendering the tree to publish it would be
 * paying a render for something nothing renders.
 */
export function useNotificationSweep(): RefObject<HTMLSpanElement | null> {
  const { status, data } = useDemoData();
  const { repositories } = useRepositories();
  const marker = useRef<HTMLSpanElement | null>(null);
  const passes = useRef(0);

  useEffect(() => {
    if (status !== "ready" || !repositories || !data) return;
    /*
     * Compute, then apply — two steps, because a notice is derived state.
     *
     * The repository works out what is new and writes nothing; the store
     * appends it with `applyDerived`, which queues nothing and writes no trail
     * entry. It used to be one call through `commitMany`, and the browser suite
     * named both things that were wrong with it: a queue entry per sweep on a
     * technician's "waiting to send" screen, and "raised 67 notifications" as
     * the newest line in the trail, above the entry saying why the records had
     * been discarded and signed with whoever was holding the demonstration.
     */
    const pending = repositories.notifications.pendingNotices();
    const wrote = pending.notifications.length;
    if (wrote > 0 || pending.emailLog.length > 0) {
      useDemoStore.getState().applyDerived(pending);
    }
    passes.current += 1;

    /*
     * Written onto the element rather than held in state, and recorded even
     * when it is zero — that is the useful half. A pass that ran and found
     * nothing looks exactly like a pass that never ran from outside, and a
     * test that has just made an event happen has to tell those apart before
     * it can say a rule is broken.
     *
     * It does not loop. The effect depends on `data`, which only a commit
     * replaces. `evaluate` writes on the pass that finds something new, which
     * runs one further pass, and that pass finds every event already named in
     * the records and writes nothing. The chain ends at the dedupe, not at a
     * flag — so removing the dedupe does not merely duplicate notices, it
     * spins.
     */
    const element = marker.current;
    if (element) {
      element.dataset.sweepPasses = String(passes.current);
      element.dataset.sweepWrote = String(wrote);
    }
  }, [status, data, repositories]);

  return marker;
}
