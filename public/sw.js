const CACHE_NAME = "quran-assets-r5";
const ASSETS_TO_CACHE = [
  "/",
  "/manifest.webmanifest",
  "/icon/32",
  "/icon/192",
  "/icon/512",
  "/apple-icon",
  "/data/chapters.json",
  "/data/verse-pages.v2.json",
  "/data/surah-pages.v2.json",
  "/data/juz-pages.madani.json",
  "/data/abu-iyaad.json",
  "/data/abu-iyaad-notes.json",
  "/data/abu-iyaad-surahs.json",
  "/data/mutashabihat/phrase-verses.json",
  "/data/mutashabihat/phrases.json",
  "/data/mutashabihat/verse-texts.json",
  "/mushaf-data/translation-footnotes.json",
  "/fonts/quran/surah-names/v1/sura_names.woff2",
];

const IS_DEV_HOST =
  self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(ASSETS_TO_CACHE);

      // The cached app shell is only useful offline if the hashed Next.js
      // runtime chunks it references are cached too. The SW is installed after
      // the first page load, so those first-load chunks are not seen by the
      // fetch handler yet.
      try {
        const shell = await cache.match("/");
        const html = await shell?.clone().text();
        if (!html) return;

        const assetPaths = new Set();
        for (const match of html.matchAll(/["'](\/_next\/static\/[^"'\\]+)["']/g)) {
          assetPaths.add(match[1].replace(/&amp;/g, "&"));
        }
        if (assetPaths.size > 0) {
          await cache.addAll(Array.from(assetPaths));
        }
      } catch {
        // Static chunk precache is a best-effort optimization; runtime caching
        // below still catches Next assets once the SW controls the page.
      }
    })()
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

  const isSameOrigin = url.origin === self.location.origin;
  const isNextStaticAsset =
    isSameOrigin && url.pathname.startsWith("/_next/static/");
  const isQuranCdnFont =
    url.origin === "https://static.qurancdn.com" &&
    url.pathname.includes("/fonts/quran/hafs/") &&
    url.pathname.endsWith(".woff2");

  if (!isSameOrigin && !isQuranCdnFont) return;

  // Hashed Next.js static assets are immutable for a build. Cache them so a
  // cached offline HTML document can actually hydrate.
  if (isNextStaticAsset) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.ok) {
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return networkResponse;
      })(),
    );
    return;
  }

  // Navigation requests are network-first to avoid serving stale HTML. Cache
  // successful route HTML by URL; offline, prefer the exact route before
  // falling back to the app shell.
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.ok) {
            const cloned = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          }
          return networkResponse;
        } catch {
          const cachedRoute = await caches.match(event.request, { ignoreSearch: true });
          if (cachedRoute) return cachedRoute;

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
