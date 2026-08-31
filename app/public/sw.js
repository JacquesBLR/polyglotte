/* Service worker Polyglotte v2 — coquille applicative en cache, API toujours en réseau.
 * Le nom du cache est versionné : à bumper à chaque version publiée.
 * Portée : la racine du site (/polyglotte/) depuis la bascule #42. Ce fichier remplace,
 * au même chemin sw.js, l'ancien service worker de la v1 : chez les visiteurs existants,
 * la mise à jour purge les caches v1 à l'activation (keys !== CACHE). */

const CACHE = "polyglotte-v2-shell-2.0.0-beta.1";
const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // Le bundle JS est haché à chaque build : il est mis en cache à la volée (fetch),
      // pas ici, pour ne pas faire échouer l'installation.
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Jamais de cache sur les appels aux modèles (Anthropic, serveur local/Nous).
  if (event.request.method !== "GET") return;
  if (url.origin !== location.origin) return;

  // Stale-while-revalidate : réponse immédiate depuis le cache, rafraîchie en arrière-plan.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fresh = fetch(event.request)
        .then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return resp;
        })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});
