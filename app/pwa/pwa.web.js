// Enregistrement du service worker (web uniquement) : installation sur l'écran
// d'accueil et fonctionnement hors ligne de la coquille applicative.

export function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const local = ["localhost", "127.0.0.1"].includes(location.hostname);
  if (location.protocol !== "https:" && !local) return;
  // Chemin relatif : la portée devient le sous-répertoire de la v2.
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
