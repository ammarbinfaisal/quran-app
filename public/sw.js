const CACHE_NAME = "quran-assets-v7";
const ASSETS_TO_CACHE = [
  "/",
  "/manifest.json",
  "/favicon.ico",
];

const IS_DEV_HOST =
  self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // If this SW was previously registered on localhost, automatically remove it
      // to avoid interfering with development.
      if (IS_DEV_HOST) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
        await self.registration.unregister();
        return;
      }

      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET") return;

  // App Router navigation fetches can include an `_rsc` query param. These
  // responses are highly dynamic and should never be cached by the SW.
  if (url.origin === self.location.origin && url.searchParams.has("_rsc")) {
    return;
  }

  // Never handle Next.js internals; they are already cache-busted by hashes and
  // caching them here can cause stale bundle issues across deployments.
  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/")) {
    return;
  }

  const isSameOrigin = url.origin === self.location.origin;
  const isQuranCdnFont =
    url.origin === "https://static.qurancdn.com" &&
    url.pathname.includes("/fonts/quran/hafs/") &&
    url.pathname.endsWith(".woff2");

  if (!isSameOrigin && !isQuranCdnFont) return;

  // Navigation requests should be network-first to avoid serving stale HTML or
  // stale RSC payloads. For offline, fall back to the cached app shell (/).
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(event.request);
        } catch {
          const shell = await caches.match("/");
          if (shell) return shell;
          return new Response("Offline", { status: 503, statusText: "Offline" });
        }
      })(),
    );
    return;
  }

  // Cache-first for same-origin assets and mushaf fonts/data. If network fails,
  // fall back to whatever was already saved in Cache Storage.
  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;

      try {
        const networkResponse = await fetch(event.request);
        if (
          networkResponse &&
          (networkResponse.ok || networkResponse.type === "opaque")
        ) {
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return networkResponse;
      } catch {
        const fallback = await caches.match(event.request);
        if (fallback) return fallback;
        return new Response("Offline", { status: 503, statusText: "Offline" });
      }
    })()
  );
});
