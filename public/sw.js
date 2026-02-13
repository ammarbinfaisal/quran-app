const CACHE_NAME = "quran-assets-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/manifest.json",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener("fetch", (event) => {
  // We prefer network for mushaf-data/fonts but fallback to cache if available
  // Actually for mushaf data we rely on browser's force-cache mostly,
  // but SW can help with offline support for basic app shell.
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
