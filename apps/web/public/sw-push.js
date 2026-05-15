self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || "NihonGo BJT";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    data: { url: data.url || "/" },
    vibrate: [100, 50, 100],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
