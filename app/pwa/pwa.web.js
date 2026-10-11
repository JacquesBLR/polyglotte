// Enregistrement du service worker (web uniquement) : installation sur l'écran
// d'accueil et fonctionnement hors ligne de la coquille applicative.

export function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const local = ["localhost", "127.0.0.1"].includes(location.hostname);
  if (location.protocol !== "https:" && !local) return;
  // Chemin relatif : la portée devient le sous-répertoire de la v2.
  navigator.serviceWorker.register("sw.js")
    // Contrôle explicite de mise à jour (#61) : en mode autonome sur iOS, rouvrir l'app
    // ne provoque pas toujours la revérification du script. Sans ce rappel, une version
    // publiée peut rester invisible plusieurs jours.
    .then((reg) => reg.update().catch(() => {}))
    .catch(() => {});
}

// Déloge une installation restée sur une version périmée (#61) : désinscrit les service
// workers, vide les caches, recharge. Ne touche **pas** au stockage local — carnet de
// vocabulaire, historique et profils sont préservés, contrairement à l'effacement des
// données du site ou à la suppression de l'app.
export async function forceUpdate() {
  if (typeof navigator === "undefined") return;
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (typeof caches !== "undefined") {
      const noms = await caches.keys();
      await Promise.all(noms.map((n) => caches.delete(n)));
    }
  } catch (_) {
    // Même en cas d'échec partiel, le rechargement sans cache vaut la peine d'être tenté.
  }
  location.reload();
}
