const CACHE = 'salary-calculator-v7';

self.addEventListener('install', (e) => {
  e.waitUntil(Promise.resolve());
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(Promise.all([
    clients.claim(),
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    })
  ]));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request)
      .then(function(res) {
        return caches.open(CACHE).then(function(cache) {
          if (e.request.method === 'GET') cache.put(e.request, res.clone());
          return res;
        });
      })
      .catch(function() {
        return caches.match(e.request);
      })
  );
});
