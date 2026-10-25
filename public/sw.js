self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let n = { title: "BatRadar 5.7", body: "Novidades no seu radar.", url: "/diarios" };
    try {
      const sub = await self.registration.pushManager.getSubscription();
      const res = await fetch("/api/public/push/latest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub && sub.endpoint }),
      });
      if (res.ok) n = await res.json();
    } catch (e) {}
    await self.registration.showNotification(n.title, { body: n.body, icon: "/icon-192.png", badge: "/icon-192.png", data: { url: n.url } });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/diarios";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) { if ("focus" in c) { await c.navigate(url).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(url);
  })());
});
