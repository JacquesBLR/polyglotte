// Choix du moteur de reconnaissance vocale (#65). Fonction pure, testée.
//
// Deux moteurs coexistent :
//   "distant" — serveur vocal du projet (Whisper) : appuyer, parler, retoucher le micro ;
//   "local"   — reconnaissance du navigateur ou de l'appareil, en continu.
//
// Le distant l'emporte dans deux cas. D'abord les langues au support partiel, que les
// moteurs grand public transcrivent mal. Ensuite — et c'est moins intuitif — une app
// installée sur l'écran d'accueil d'un iPhone : WebKit y **expose** SpeechRecognition
// mais ne transcrit jamais rien. L'objet existe, `start()` réussit, aucun résultat
// n'arrive ; la détection de fonctionnalité ne peut donc pas voir le problème, et sans
// cette règle l'app paraît simplement sourde.
// https://bugs.webkit.org/show_bug.cgi?id=225298
export function choisitMicro({
  support,
  autonomeIos = false,
  distantDisponible = false,
  localDisponible = false,
} = {}) {
  const prefereDistant = support === "partial" || autonomeIos;
  const ordre = prefereDistant ? ["distant", "local"] : ["local", "distant"];
  for (const moteur of ordre) {
    if (moteur === "distant" && distantDisponible) return "distant";
    if (moteur === "local" && localDisponible) return "local";
  }
  return null;
}
