// The Rusty Chef service worker.
// Pages always come fresh from the network, so visitors get the newest site.
// Only a small "you're offline" page is stored, shown when there is no connection.
var CACHE = "rc-offline-v1";
var OFFLINE_URL = "/offline.html";

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE).then(function (c) { return c.add(new Request(OFFLINE_URL, { cache: "reload" })); }));
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(function () {
      return caches.open(CACHE).then(function (c) { return c.match(OFFLINE_URL); });
    })
  );
});
