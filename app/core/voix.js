// Choix du moteur de synthèse vocale (#67). Fonction pure, testée.
//
// Symétrique de choisitMicro(), avec une asymétrie importante : la liste des voix du
// navigateur est **asynchrone**, et sur iOS elle reste vide tant que la synthèse n'a pas
// servi une première fois. « Aucune voix » ne veut donc pas dire « cet appareil ne parle
// pas » mais « pas encore » — et se taire dans ce cas revient à ne jamais parler.
//
// `repliEpuise` ferme la boucle : le serveur vocal, quand il échoue, retombe sur la voix
// du navigateur ; sans ce drapeau, l'absence de voix la renverrait aussitôt au serveur.
export function choisitVoix({
  support,
  voixNavigateur = false,
  distantDisponible = false,
  repliEpuise = false,
} = {}) {
  if (support === "partial" && distantDisponible && !repliEpuise) return "distant";
  if (voixNavigateur) return "local";
  if (distantDisponible && !repliEpuise) return "distant";
  return null;
}
