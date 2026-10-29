// Service worker: la app funciona sin conexión tras la primera visita.
const CACHE = "tinta-reader-v1";
const PAGES = ["/", "/read"];
const STATIC = ["/manifest.webmanifest", "/icons/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/pdf.worker.min.mjs"];

async function precache() {
  const cache = await caches.open(CACHE);
  const assets = new Set(STATIC);
  for (const page of PAGES) {
    try {
      const res = await fetch(page, { cache: "reload" });
      await cache.put(page, res.clone());
      const html = await res.text();
      for (const m of html.matchAll(/\/_next\/static\/[^"'\s\\)<>]+/g)) assets.add(m[0].replace(/&amp;/g, "&"));
    } catch {}
  }
  // fuentes y recursos referenciados desde los CSS
  const cssFiles = [...assets].filter((u) => u.endsWith(".css"));
  for (const css of cssFiles) {
    try {
      const res = await fetch(css);
      const text = await res.text();
      for (const m of text.matchAll(/url\(([^)]+)\)/g)) {
        const raw = m[1].replace(/["']/g, "");
        if (raw.startsWith("data:")) continue;
        // solo woff2 de subconjuntos latinos (el resto se cachea al usarse)
        if (/\.woff2?(\?|$)/.test(raw) && !(/\.woff2(\?|$)/.test(raw) && /-latin(-ext)?-/.test(raw))) continue;
        assets.add(new URL(raw, new URL(css, self.location.origin)).pathname);
      }
    } catch {}
  }
  await Promise.all(
    [...assets].map((u) =>
      cache.add(u).catch(() => {
        /* un recurso opcional no debe romper la instalación */
      }),
    ),
  );
  // elimina recursos de compilaciones anteriores
  for (const req of await cache.keys()) {
    const p = new URL(req.url).pathname;
    if (p.startsWith("/_next/static/") && !assets.has(p)) await cache.delete(req);
  }
}

self.addEventListener("install", (e) => {
  e.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && (url.pathname === "/" || url.pathname === "/read")) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE);
          return (await cache.match(url.pathname === "/read" ? "/read" : "/")) ?? (await cache.match("/")) ?? Response.error();
        }),
    );
    return;
  }

  const cacheFirst =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/pdfjs/") ||
    url.pathname === "/pdf.worker.min.mjs" ||
    url.pathname === "/manifest.webmanifest";
  if (!cacheFirst) return;
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ??
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
