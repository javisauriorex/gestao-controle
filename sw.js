// Service worker do G&C:
//  - torna o app instalável (PWA);
//  - recebe as notificações push (avisos 🔔) e abre a obra certa quando a pessoa toca nelas.
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  // Passthrough simples, sem cache. Só toca nos pedidos GET do próprio site; o resto (Google, Turnstile,
  // envios de dados) vai direto pelo navegador, sem passar por aqui.
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request));
});

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: "G&C", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "G&C", {
    body: d.body || "",
    icon: "icon-192.png",
    badge: "icon-192.png",
    tag: d.tag || undefined,
    data: { url: d.url || "/" },
    vibrate: [120, 60, 120],
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  let url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  if (new URL(url).origin !== self.location.origin) url = self.location.origin + "/"; // nunca abre site de fora
  e.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of janelas) {
      if (new URL(c.url).origin === self.location.origin) {
        await c.focus();
        c.postMessage({ tipo: "abrir-aviso", url });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
