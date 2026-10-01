// Caches only the app shell so Notes Taker opens offline. Note data is never
// cached here: it stays in Firestore's own (opt-in) offline cache, and pages
// are rendered on the client, so cached HTML holds no personal content.
const SHELL_CACHE = "notes-shell-v2";
const STATIC_CACHE = "notes-static-v2";
const SHELL_ROUTES = ["/", "/notes", "/write", "/groups", "/friends"];

// Pages reference hashed /_next/static files; cache those too so a page works offline
// even if it was first loaded before this worker took control.
async function cacheShellPage(path, response) {
  const html = await response.clone().text();
  await (await caches.open(SHELL_CACHE)).put(path, response);
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || [])];
  const staticCache = await caches.open(STATIC_CACHE);
  await Promise.all(assets.map(async (asset) => {
    if (await staticCache.match(asset)) return;
    try {
      const assetResponse = await fetch(asset);
      if (assetResponse.ok) await staticCache.put(asset, assetResponse);
    } catch {
      // Fetched again on the next online visit.
    }
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all(SHELL_ROUTES.map(async (path) => {
      try {
        const response = await fetch(path, { cache: "no-cache" });
        if (response.ok) await cacheShellPage(path, response);
      } catch {
        // Cached on a later visit instead.
      }
    }))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE && key !== STATIC_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isCacheableStatic(url) {
  return url.pathname.startsWith("/_next/static/")
    || url.pathname.startsWith("/icons/")
    || url.pathname === "/icon.svg"
    || url.pathname === "/manifest.webmanifest";
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // Network first so updates appear immediately; the cached shell is the offline fallback.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && SHELL_ROUTES.includes(url.pathname)) {
            event.waitUntil(cacheShellPage(url.pathname, response.clone()));
          }
          return response;
        })
        .catch(async () => (await caches.match(url.pathname)) || (await caches.match("/notes")) || (await caches.match("/")) || Response.error())
    );
    return;
  }

  if (isCacheableStatic(url)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      }))
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/notes", self.location.origin);
  // Only ever open pages of this app.
  const url = target.origin === self.location.origin ? target.href : new URL("/notes", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) return existing.focus().then((client) => client.navigate(url));
      return self.clients.openWindow(url);
    })
  );
});
