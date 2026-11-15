/* Migration kill-switch (temporary, safe to remove after 2026-12-31).
 *
 * The old GoDaddy WordPress site may have registered a Service Worker at
 * scope "/". After the cutover, requests for /sw.js used to fall through to
 * an HTML page, which meant the browser could never replace that stale
 * worker - it kept serving cached WordPress pages even though the origin had
 * switched to Cloudflare Pages. This valid JavaScript worker lets the
 * browser finally update, clear every cache owned by this origin, and
 * unregister itself. The new Astro site does not use a Service Worker.
 */
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    (async function () {
      try {
        var keys = await caches.keys();
        await Promise.all(keys.map(function (key) { return caches.delete(key); }));
      } catch (e) {
        // Cache Storage may be unavailable in private mode; unregister anyway.
      }
      try {
        await self.clients.claim();
      } catch (e) {}
      await self.registration.unregister();
    })()
  );
});

// Never serve anything from cache while this worker is alive.
self.addEventListener('fetch', function (event) {
  event.respondWith(fetch(event.request));
});
