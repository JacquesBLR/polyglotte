// Choix du moteur de synthèse vocale (#67). Fonction pure, testée.
//
// Symétrique de choisitMicro(), avec une asymétrie importante : la liste des voix du
// navigateur est **asynchrone**, et sur iOS elle reste vide tant que la synthèse n'a pas
// servi une première fois. « Aucune voix » ne veut donc pas dire « cet appareil ne parle
// pas » mais « pas encore » — et se taire dans ce cas revient à ne jamais parler.
//
// `repliEpuise` ferme la boucle : le serveur vocal, quand il échoue, retombe sur la voix
// du navigateur ; sans ce drapeau, l'absence de voix la renverrait aussitôt au serveur.
//
// `voixServeur` est une préférence de langue (#79), distincte du support : le catalan a une
// reconnaissance vocale parfaite dans le navigateur, mais une voix de synthèse médiocre sur
// iOS (voix « compacte »). Il demande donc le serveur pour la synthèse seule, là où
// `support: "partial"` dirait aussi « route le micro vers Whisper, et préviens l'élève ».
//
// `appareilIos` est une préférence d'appareil (#129) : sur iPhone, la voix du navigateur
// (`speechSynthesis`) se tait en mode silencieux, alors que l'élément audio du serveur
// vocal joue malgré l'interrupteur. Toute langue y passe donc par le serveur quand il est
// là ; la voix de l'iPhone ne sert plus qu'en repli. Le japonais, sans voix sur le
// serveur, y retombe : speech.web.js le retient et ne le renvoie plus au serveur.
export function choisitVoix({
  support,
  voixServeur = false,
  appareilIos = false,
  voixNavigateur = false,
  distantDisponible = false,
  repliEpuise = false,
} = {}) {
  const viseServeur = support === "partial" || voixServeur || appareilIos;
  if (viseServeur && distantDisponible && !repliEpuise) return "distant";
  if (voixNavigateur) return "local";
  if (distantDisponible && !repliEpuise) return "distant";
  return null;
}
