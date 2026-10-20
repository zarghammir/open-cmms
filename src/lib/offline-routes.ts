import { localePrefixes } from "@/i18n/routing";

/**
 * Addresses fetched into the page cache while there is still a connection.
 *
 * The one screen a person needs when the network is gone is the one screen they
 * have no reason to have visited. The worker caches a page when it is opened
 * and nothing before that, so "what is waiting to send" — reached from the
 * offline banner, which only appears once the connection has already gone —
 * answered with a blank page: a client navigation whose payload cannot be
 * fetched falls back to a full one, and a full one for an address with nothing
 * cached is refused with a 504 and an empty body.
 *
 * Both languages, because a person can switch language and then lose the
 * network, and the address carries the language. Built from the prefixes rather
 * than written out, so a third locale cannot be added and silently left cold.
 *
 * Keep this list short. Every address here is fetched on load, and warming a
 * screen nobody reaches offline spends a request to cache a page nobody opens.
 */
export const WARM_ROUTES: readonly string[] = Object.values(localePrefixes).map(
  (prefix) => `${prefix}/waiting-to-send`,
);

/** What the page asks the worker to do. One kind, so the worker can be sure. */
export const WARM_MESSAGE = "warm-pages";
