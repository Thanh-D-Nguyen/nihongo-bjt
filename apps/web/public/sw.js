self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open("nihongo-shell-v1")
      .then((cache) => cache.add("/pwa-icon.svg").catch(() => undefined))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== self.location.origin
  ) {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(async () => {
      const hit = await caches.match(event.request);
      return hit ?? new Response("offline", { status: 503, statusText: "Offline" });
    })
  );
});
