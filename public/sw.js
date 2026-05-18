// CommApp service worker — Web Push handler.
// Fires OS notifications when a push arrives and the tab is closed or
// unfocused. When a tab is already focused, the push is silenced so the
// in-app notification doesn't get duplicated.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "CommApp", body: "New activity" };
  try {
    if (event.data) data = event.data.json();
  } catch (_) {
    // Non-JSON payload; keep defaults.
  }

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const focused = clients.some((c) => c.focused);
      if (focused) return;

      await self.registration.showNotification(data.title || "CommApp", {
        body: data.body,
        tag: data.tag || data.conversationId || "commapp",
        icon: "/icon.svg",
        badge: "/icon.svg",
        renotify: true,
        data: {
          conversationId: data.conversationId,
          url: data.url || "/demo",
        },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/demo";
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const c of clients) {
        if (c.url.includes(target)) {
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
