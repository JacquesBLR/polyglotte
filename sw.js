/* Service worker Polyglotte v2 — coquille applicative en cache, API toujours en réseau.
 * Le nom du cache est versionné : à bumper à chaque version publiée.
 * Portée : la racine du site (/polyglotte/) depuis la bascule #42. Ce fichier remplace,
 * au même chemin sw.js, l'ancien service worker de la v1 : chez les visiteurs existants,
 * la mise à jour purge les caches v1 à l'activation (keys !== CACHE). */

const CACHE = "polyglotte-v2-shell-2.0.0-beta.19";
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
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  // Jamais de cache sur les appels aux modèles (passerelle, serveur vocal, Anthropic).
  if (url.origin !== location.origin) return;

  // Le document d'abord par le réseau (#58). C'est lui qui référence le bundle JS haché :
  // servi depuis le cache, il désignait l'ancien bundle, et une version publiée n'arrivait
  // qu'au rechargement suivant. Le cache ne sert plus que de secours hors ligne.
  const estDocument = event.request.mode === "navigate"
    || url.pathname.endsWith("/")
    || url.pathname.endsWith("/index.html");

  if (estDocument) {
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          if (resp.ok) {
            const copie = resp.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copie));
          }
          return resp;
        })
        .catch(() => caches.match(event.request).then((c) => c || caches.match("./")))
    );
    return;
  }

  // Actifs hachés et icônes : immuables, donc cache d'abord, réseau en secours.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        if (resp.ok) {
          const copie = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copie));
        }
        return resp;
      });
    })
  );
});
