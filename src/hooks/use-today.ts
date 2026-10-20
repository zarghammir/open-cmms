"use client";

import { toIsoDate } from "@/data/seed/dates";

/**
 * The day the screens reckon from.
 *
 * The same call `ensureSeeded` makes, so a screen's idea of today is the one
 * the records were built for. It lives in a hook because screens may not reach
 * `@/data/seed` — the data boundary — and because every screen asking the same
 * question the same way is what keeps two of them from disagreeing about
 * whether a work order is late.
 *
 * A tab left open across midnight reads a day ahead of its data until the next
 * load reseeds it, which is exactly what the store does on that load.
 */
export function useToday(): string {
  return toIsoDate(new Date());
}
