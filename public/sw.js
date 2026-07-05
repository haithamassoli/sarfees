// Serfees service worker — hand-written (Turbopack build; no Serwist).
// Scope: offline fallback for navigations, runtime cache for immutable build
// assets, Web Push. Convex data rides its own WebSocket; this worker never
// touches it, and no page data is cached.

const CACHE = "serfees-v1";
const OFFLINE_URL = "/offline";

// Install: pre-cache the offline page, activate without waiting.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

// Activate: drop caches from older versions, take over open clients.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

// Fetch: navigations are network-first with the offline page as fallback.
// Hashed build assets (/_next/static/* — the offline page's CSS and font
// chunks) are immutable, so they get cache-first with a runtime fill: any
// online visit leaves them cached and the offline page renders styled.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/_next/static/")) return;
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(
              caches.open(CACHE).then((cache) => cache.put(request, copy)),
            );
          }
          return response;
        }),
    ),
  );
});

// Push: payload is JSON {title, body, url} built by convex/pushActions.ts.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      dir: "rtl",
      lang: "ar",
      data: { url: data.url },
    }),
  );
});

// Notification tap: focus a tab already on the target URL, else open one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (new URL(client.url).pathname === url && "focus" in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
