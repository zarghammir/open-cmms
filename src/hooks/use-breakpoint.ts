"use client";

import { useSyncExternalStore } from "react";
import {
  DESKTOP_FROM,
  TABLET_FROM,
  type Breakpoint,
} from "@/components/data-table/column-priority";

const TABLET_QUERY = `(min-width: ${TABLET_FROM}px)`;
const DESKTOP_QUERY = `(min-width: ${DESKTOP_FROM}px)`;

function subscribe(onChange: () => void) {
  const tablet = window.matchMedia(TABLET_QUERY);
  const desktop = window.matchMedia(DESKTOP_QUERY);
  tablet.addEventListener("change", onChange);
  desktop.addEventListener("change", onChange);
  return () => {
    tablet.removeEventListener("change", onChange);
    desktop.removeEventListener("change", onChange);
  };
}

/**
 * Which of the three widths the interface is being read at.
 *
 * Read through `useSyncExternalStore`, like `useIsMobile`, so the first client
 * render already has the right answer instead of correcting itself in an
 * effect. The server answer is `desktop`; the tables that use this only render
 * once the records have been read, which happens in the browser, so the server
 * answer is never the one drawn.
 */
export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(
    subscribe,
    () =>
      window.matchMedia(DESKTOP_QUERY).matches
        ? "desktop"
        : window.matchMedia(TABLET_QUERY).matches
          ? "tablet"
          : "phone",
    () => "desktop" as const,
  );
}
