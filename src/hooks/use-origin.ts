"use client";

import { useSyncExternalStore } from "react";

/** The origin never changes while the page is open, so there is nothing to subscribe to. */
const subscribe = () => () => {};

/**
 * The address the application is being served from, or `null` on the server.
 *
 * A label's QR has to carry an absolute URL — the phone camera app that reads
 * it is not our application and can only act on a whole address — and that
 * address has to be whatever origin this copy is actually running on, so a
 * label printed from a preview deployment points at that preview.
 *
 * Read through `useSyncExternalStore` rather than an effect: the server has no
 * origin, the first client paint does, and this is the way to say that without
 * setting state in an effect or provoking a hydration mismatch.
 *
 * `null` is the third state — not "no origin", but "not known yet" — and
 * callers draw a skeleton for it rather than a broken QR.
 */
export function useOrigin(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => null,
  );
}
