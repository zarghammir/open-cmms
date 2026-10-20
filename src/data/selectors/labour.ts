import type { DemoData } from "@/data/seed";
import type { Id } from "@/domain/types";

/**
 * How long a work order has actually taken.
 *
 * There is no stored total. A number on the order beside a list of entries that
 * adds to something else is a question nobody can answer, so the entries are
 * the record and this is the only way to a total.
 *
 * **Null is not zero.** An order with no entries has no time logged — which is
 * what every order imported from the legacy system will look like, because the
 * MP2 export has no minutes column at all. Returning 0 there would let a screen
 * print "0 min", claiming somebody worked no time rather than that nobody wrote
 * anything down. The distinction lives here rather than in each screen's
 * formatting: a screen can be careful, a shared function is the thing that
 * cannot be talked out of it.
 *
 * An entry's minutes are positive by its schema, so a non-null total is always
 * greater than zero — "0 min" is not a value this can produce.
 */
export function loggedMinutes(data: DemoData, workOrderId: Id): number | null {
  const entries = data.labourEntries.filter(
    (entry) => entry.workOrderId === workOrderId,
  );

  if (entries.length === 0) return null;

  return entries.reduce((total, entry) => total + entry.minutes, 0);
}
