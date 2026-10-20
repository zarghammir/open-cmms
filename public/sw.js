/**
 * The service worker that makes the shell open with no network.
 *
 * Written by hand rather than generated. The whole of it is two caching rules,
 * and a build-time plugin would put a generated file in the repository that
 * nobody could read during a review.
 *
 * Two rules, because the two kinds of request fail differently:
 *
 *   /_next/static/*  is hashed and immutable, so it is served from the cache
 *                    the moment it is there and refreshed in the background.
 *   navigations      are HTML, which changes, so the network is tried first and
 *                    the cache answers only when the network does not.
 *
 * Network-first for HTML is the part that matters for the tender: after one
 * visit, reloading with the network switched off still opens the application.
 *
 * There is one more thing it does, and it is not a caching rule so much as an
 * admission about the first: a page is only cached once it has been opened, and
 * the page a person needs when the network is gone is the one they had no
 * reason to open. So the application sends a short list of addresses to warm
 * while there is still a connection, and they are fetched into the same page
 * cache the first rule fills.
 *
 * VERSION is what stops yesterday's HTML being served after a deploy. Bump it
 * when the caching rules change; old caches are dropped on activate.
 */
/** The language an address with no known prefix is answered in. */
const DEFAULT_PREFIX = "/en";

const VERSION = "workaxis-v3";
const ASSETS = `${VERSION}-assets`;
const PAGES = `${VERSION}-pages`;
const REFUSALS = `${VERSION}-refusals`;

self.addEventListener("install", (event) => {
  // Nothing is precached: the shell is server-rendered per route, so there is
  // no single file to pin. The first visit fills the cache.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== ASSETS && key !== PAGES && key !== REFUSALS)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached ?? network;
}

async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return refusal(request);
  }
}

/**
 * No network, and nothing on this device for the address asked for.
 *
 * This used to be a 504 with an empty body, which a browser draws as a blank
 * white page: measured at 390, a technician tapped a link and the screen went
 * white with nothing to read and nothing to press. The page returned instead is
 * built from the catalogues by the application and handed here, because a file
 * served rather than bundled cannot read them itself.
 *
 * The language comes from the address, which is all there is to go on: a path
 * carrying no known prefix is answered in the default language rather than
 * guessed at.
 */
async function refusal(request) {
  const cache = await caches.open(REFUSALS);
  const prefix = `/${new URL(request.url).pathname.split("/")[1] ?? ""}`;

  const page =
    (await cache.match(refusalKey(prefix))) ??
    (await cache.match(refusalKey(DEFAULT_PREFIX)));

  if (page) return page;

  // Nothing was ever handed over — only reachable if no page has run since this
  // worker took over, which cannot happen while it takes a load to install one.
  return new Response("", { status: 504, statusText: "Offline" });
}

function refusalKey(prefix) {
  return `/__offline-refusal${prefix}`;
}

/** Keeps the pages the application built, one per language prefix. */
async function keepRefusals(pages) {
  const cache = await caches.open(REFUSALS);

  await Promise.all(
    Object.entries(pages).map(([prefix, html]) =>
      cache.put(
        refusalKey(prefix),
        new Response(html, {
          status: 504,
          statusText: "Offline",
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      ),
    ),
  );
}

/**
 * Fetches addresses the page asks for into the page cache.
 *
 * Quiet on failure: warming is a convenience taken while a connection exists,
 * and no part of the application is worse off than it already was if it does
 * not happen. It never refreshes what the cache already holds from a real
 * visit, because that page was fetched under the role and language the person
 * was actually using.
 */
async function warm(urls) {
  const pages = await caches.open(PAGES);
  const assets = await caches.open(ASSETS);

  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, { credentials: "same-origin" });
        if (!response.ok) return;

        const html = await response.clone().text();
        await pages.put(url, response);
        await warmAssets(assets, html);
      } catch {
        // No connection, which is the state warming cannot help with anyway.
      }
    }),
  );
}

/**
 * The page's own code, not only its HTML.
 *
 * A cached document without its chunks opens to the error boundary: the shell
 * hydrates, the route's chunk is not in the cache because nobody ever asked for
 * it, the fetch for it fails, and the person sees "this screen did not load" —
 * which was measured, not guessed. Everything a warmed page references is
 * hashed and immutable, so anything already held is left alone.
 */
async function warmAssets(cache, html) {
  const referenced = new Set(html.match(/\/_next\/static\/[^"\\\s]+/g) ?? []);

  await Promise.all(
    [...referenced].map(async (path) => {
      if (await cache.match(path)) return;
      try {
        const response = await fetch(path);
        if (response.ok) await cache.put(path, response);
      } catch {
        // Same as above: nothing to warm with.
      }
    }),
  );
}

self.addEventListener("message", (event) => {
  const message = event.data;
  if (!message) return;

  if (message.type === "warm-pages" && Array.isArray(message.urls)) {
    event.waitUntil(warm(message.urls));
    return;
  }

  if (message.type === "offline-refusal" && message.pages) {
    event.waitUntil(keepRefusals(message.pages));
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  }
});
