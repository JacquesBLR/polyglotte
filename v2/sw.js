/* Service worker d'auto-destruction pour l'ancien emplacement /v2/ (bascule #42).
 * Les navigateurs des testeurs alpha mettent à jour leur ancien SW vers ce fichier :
 * il purge les caches de l'aperçu (l'app servie à la racine repeuplera les siens),
 * se désinscrit, puis recharge les onglets — qui suivent alors la redirection. */

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith("polyglotte-v2-shell-")).map((k) => caches.delete(k)),
      ))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((clients) => clients.forEach((c) => c.navigate(c.url)))
  );
});
