var IMG = "aniflix-img-v1";
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function (e) {
  var r = e.request;
  if (r.method !== "GET") return;
  var u = new URL(r.url);
  if (u.origin !== location.origin) return;
  if (r.destination === "image" || /\.(jpe?g|png|webp|gif)$/i.test(u.pathname)) {
    e.respondWith(caches.open(IMG).then(function (c) {
      return c.match(r).then(function (hit) {
        var net = fetch(r).then(function (res) {
          if (res && res.ok) c.put(r, res.clone());
          return res;
        }).catch(function () { return hit; });
        return hit || net;
      });
    }));
    return;
  }
  e.respondWith(fetch(r));
});
