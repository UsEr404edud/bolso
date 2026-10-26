/* Service worker do Bolso — app shell em cache e navegação offline. */

const VERSION = "1.0.1";
const CACHE_PREFIX = "bolso-";
const CACHE_NAME = `${CACHE_PREFIX}${VERSION}`;
const APP_ROOT = new URL("./", self.location).href;

const PRECACHE_PATHS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./js/store.js",
  "./js/theme.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
];

const PRECACHE_URLS = PRECACHE_PATHS.map((path) => new URL(path, APP_ROOT).href);
const INDEX_URL = new URL("./index.html", APP_ROOT).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((error) => {
        console.error("Falha ao preparar o cache do Bolso:", error);
      }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(INDEX_URL, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    const cached = (await caches.match(INDEX_URL)) || (await caches.match(APP_ROOT));
    return (
      cached ||
      new Response(
        "<!doctype html><html lang=\"pt-BR\"><meta charset=\"utf-8\"><title>Bolso offline</title><body style=\"font-family:sans-serif;padding:2rem;background:#f4f1ea;color:#17211b\"><h1>Bolso</h1><p>O app ainda não está disponível offline. Conecte-se à internet e tente novamente.</p></body></html>",
        { headers: { "Content-Type": "text/html; charset=utf-8" } },
      )
    );
  }
}

async function handleAsset(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    const fallback = await caches.match(request, { ignoreSearch: true });
    if (fallback) return fallback;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  event.respondWith(handleAsset(request));
});
