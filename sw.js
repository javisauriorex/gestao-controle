// Service worker mínimo: solo existe para que Chrome/Android
// reconozca esto como una app instalable de verdad (PWA).
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => self.clients.claim());
self.addEventListener("fetch", (e) => {
  // passthrough simple, sin cache especial
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
