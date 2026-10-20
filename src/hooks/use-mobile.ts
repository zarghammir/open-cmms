import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onChange: () => void) {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Whether the viewport is phone sized. Read through `useSyncExternalStore` so
 * the first client render already has the right answer and the server render
 * stays deterministic (desktop).
 *
 * Adapted from the shadcn/ui version, which set state inside an effect and
 * caused a cascading render on every mount.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
