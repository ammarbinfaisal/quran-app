const CACHE_NAME = "quran-assets-v6";
const ASSETS_TO_CACHE = [
  "/",
  "/manifest.json",
  "/favicon.ico",
];

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
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET") return;

  const isSameOrigin = url.origin === self.location.origin;
  const isQuranCdnFont =
    url.origin === "https://static.qurancdn.com" &&
    url.pathname.includes("/fonts/quran/hafs/") &&
    url.pathname.endsWith(".woff2");

  if (!isSameOrigin && !isQuranCdnFont) return;

  // Cache-first for app assets and mushaf fonts. If network fails, fall back
  // to whatever was already saved in Cache Storage.
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
