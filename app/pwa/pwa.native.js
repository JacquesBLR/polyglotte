// En natif, l'app est déjà installée : rien à enregistrer.

export function registerServiceWorker() {}

// Pas de service worker en natif : les mises à jour passent par TestFlight / l'App Store.
export async function forceUpdate() {}
