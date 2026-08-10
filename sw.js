/* =============================================================
   Service worker.

   Two jobs. It makes the game playable without a signal, and it is
   what lets Chrome offer a real one-tap install - `beforeinstallprompt`
   only fires for a site that answers a navigation while offline, so
   without this there is no Android install prompt at all.

   The cache must never fight the `?v=` discipline in index.html.
   It doesn't, for two reasons:

   - Navigations are network-first. A new deploy is picked up the moment
     the phone is online, rather than being pinned to whatever HTML was
     cached first. The cache is only the offline fallback.
   - Every script and stylesheet is requested with `?v=N`, so a bump
     asks for a URL that has never been cached and cannot be answered
     stale. CACHE below is bumped alongside it so the old entries are
     evicted rather than lingering forever.

   Music is deliberately not cached: the five tracks are ~21MB, which is
   a lot of somebody's phone to spend without asking. Offline play works,
   offline play is just quiet.
   ============================================================= */
var CACHE = 'santi-v105';

// Enough to answer a cold navigation offline. Everything else lands in
// the cache as it is fetched.
var SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      // One bad URL rejects addAll and the whole install fails, so they
      // go in one at a time and a miss is survivable.
      .then(function (c) {
        return Promise.all(SHELL.map(function (u) {
          return c.add(u).catch(function () {});
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          return k === CACHE ? null : caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

function isMusic(url) { return url.pathname.indexOf('/assets/music/') >= 0; }

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;
  if (isMusic(url)) return;                       // straight to the network

  // Navigations: network first, cache only as the offline fallback.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
          return res;
        })
        .catch(function () {
          return caches.match('./index.html').then(function (hit) {
            return hit || caches.match('./');
          });
        })
    );
    return;
  }

  // Everything else: cache first. Safe because the URLs carry ?v=.
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
