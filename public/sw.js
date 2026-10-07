/* Cook's Kitchen service worker (hand-written, no build step).
 *
 * What it does:
 *  - Static, non-personal assets (/_next/static/*, icons, fonts, brand images) → stale-while-revalidate.
 *  - Page navigations → always the network. If the network fails, show the static /offline page.
 *    Personal HTML is NEVER cached, so one person's kitchen can't be shown to someone else on a shared device.
 *  - Everything else (Supabase, /api/*, /auth/*, /login, server actions / POSTs, RSC data requests,
 *    cross-origin requests such as Sentry) is left completely alone.
 *
 * Bump VERSION when this file's caching logic or the precache list changes; old caches are deleted on activate.
 */
const VERSION = "v1";
const STATIC_CACHE = `ck-static-${VERSION}`;
const OFFLINE_CACHE = `ck-offline-${VERSION}`;
const OFFLINE_URL = "/offline";
const MAX_STATIC_ENTRIES = 150;

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/cooks-kitchen-circle-v2.webp",
];

const NEVER_HANDLE_PREFIXES = ["/api/", "/auth/", "/login", "/logout", "/invite/", "/reset-password", "/forgot-password", "/monitoring"];
const STATIC_PATH = /^\/(?:_next\/static\/|icons\/)|\.(?:png|jpe?g|webp|svg|ico|gif|woff2?|ttf|otf)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(OFFLINE_CACHE);
      await cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { cache: "reload", credentials: "omit" })));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, OFFLINE_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith("ck-") && !keep.has(name)).map((name) => caches.delete(name)));
      // Navigation preload is intentionally left off: it would send a second request for routes this worker
      // ignores (e.g. the one-time /auth/callback code exchange).
      await self.clients.claim();
    })(),
  );
});

let offlinePageRefreshed = false;

/** Keep the offline page in step with the currently deployed build (at most once per worker lifetime). */
async function refreshOfflinePage() {
  if (offlinePageRefreshed) return;
  offlinePageRefreshed = true;
  try {
    const response = await fetch(new Request(OFFLINE_URL, { cache: "no-store", credentials: "omit" }));
    if (response.ok) await (await caches.open(OFFLINE_CACHE)).put(OFFLINE_URL, response);
  } catch {
    offlinePageRefreshed = false;
  }
}

async function handleNavigation(event) {
  try {
    const response = await fetch(event.request);
    event.waitUntil(refreshOfflinePage());
    return response;
  } catch {
    const cache = await caches.open(OFFLINE_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    return offline || new Response("You're offline. Your saved plan will be back when you reconnect.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(event.request);
  const network = fetch(event.request)
    .then(async (response) => {
      // Only cache complete, same-origin, non-personal responses.
      if (response.ok && response.type === "basic" && !response.headers.has("set-cookie")) {
        await cache.put(event.request, response.clone());
        await trimCache(STATIC_CACHE, MAX_STATIC_ENTRIES);
      }
      return response;
    })
    .catch(() => undefined);

  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  const response = await network;
  return response || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // server actions, form posts, uploads

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase, Sentry, Google, etc.
  if (NEVER_HANDLE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return;
  // React Server Component payloads are personal page data; never touch them.
  if (request.headers.has("RSC") || request.headers.has("Next-Router-State-Tree") || url.searchParams.has("_rsc")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  // Build assets are content-hashed (a ?dpl= query may be added by Vercel); other static files only without a query.
  if (url.pathname.startsWith("/_next/static/") || (STATIC_PATH.test(url.pathname) && !url.search)) {
    event.respondWith(staleWhileRevalidate(event));
  }
});
