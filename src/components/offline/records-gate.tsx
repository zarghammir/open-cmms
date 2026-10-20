"use client";

import type { ReactNode } from "react";
import { RecordsUnreadable } from "@/components/offline/records-unreadable";
import { recordsState, useDemoData } from "@/hooks/use-demo-data";

/**
 * Stands between the shell and every screen, and refuses for all of them.
 *
 * When the browser could not read the records back, no screen below this can
 * say anything true, so none of them is drawn. The refusal takes their place —
 * it does not sit above them.
 *
 * **That is the whole design decision, and it is why this is a gate and not a
 * banner.** The ticket asked for a notice rendered once in the shell, above the
 * skeleton. A notice cannot remove the page's own words: `ModuleScreen` is a
 * server component and prints "Scan — point the camera at a label, or upload a
 * photo of one" before any client code has an opinion about the store. WA-68
 * correctly took the camera away and left that sentence standing over four grey
 * bars, so the screen went on inviting exactly what it was refusing. Replacing
 * `children` removes the invitation and the endless skeleton together, for
 * every route, without a single screen knowing about it.
 *
 * `reading` still draws the page. Three states stay three: a skeleton while the
 * browser is still reading is correct and is not what this is for.
 *
 * The banners are **inside** the passing branch, which is structure doing the
 * work of a rule. `NotSavingBanner` reads `durable`, and a failed read sets
 * `durable` to false before it throws — so without this it would appear beside
 * the refusal, two notices about the same device saying adjacent things. Being
 * unable to render is better than remembering not to.
 *
 * `DemoBoot` and `ServiceWorker` stay outside on purpose: the first is what
 * sets this status and publishes it for the tests to read, and a gate that hid
 * its own input would be reporting on nothing.
 */
export function RecordsGate({ children }: { children: ReactNode }) {
  const { status } = useDemoData();
  const state = recordsState(status);

  switch (state) {
    case "unreadable":
      return <RecordsUnreadable />;
    case "reading":
    case "records":
      return <>{children}</>;
    default: {
      const unhandled: never = state;
      return unhandled;
    }
  }
}
