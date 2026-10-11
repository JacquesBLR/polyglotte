// Réglages : valeurs d'une installation neuve et fusion avec ce qui est enregistré.
// Fonctions pures, couvertes par tests/settings.test.mjs.

// Les champs moteur pointent sur le DGX, dont la passerelle compatible OpenAI et le
// serveur vocal sont exposés en HTTPS sur le tailnet : hors tailnet ils sont injoignables,
// et tout reste modifiable dans ⚙️. `apiKey` et `localKey` restent vides par principe —
// aucun secret dans le dépôt, et la passerelle n'en demande pas.
export const DEFAULT_SETTINGS = {
  provider: "local",
  apiKey: "",
  model: "claude-opus-5",
  localUrl: "https://spark-4569.tail34da6b.ts.net:8646/v1",
  localKey: "",
  localModel: "qwen3.8-nvfp4",
  localModelAlt: "",
  autospeak: true,
  rate: 1,
  reversedCards: false,
  voiceUrl: "https://spark-4569.tail34da6b.ts.net:8664",
  reminders: false,
};

// Champs garnis une seule fois s'ils sont vides (#56). Les clés en sont exclues : elles
// doivent rester vides tant que l'utilisateur n'en saisit pas.
const CHAMPS_GARNIS = ["localUrl", "localModel", "voiceUrl"];

const vide = (v) => !String(v ?? "").trim();

// Fusionne les réglages enregistrés avec les défauts.
//
// `{ ...DEFAULT_SETTINGS, ...saved }` seul ne suffisait pas : une chaîne vide enregistrée
// est une valeur comme une autre et gagnait sur le défaut, si bien qu'une installation
// antérieure au préremplissage gardait ses champs moteur vides pour toujours.
//
// On garnit donc les champs vides **une seule fois**, puis on pose le marqueur
// `defautsDgx`. Ainsi vider un champ ensuite reste possible et durable — couper le serveur
// vocal en effaçant son URL, par exemple, ne sera pas défait au rechargement suivant.
//
// Retourne { settings, modifie } ; `modifie` dit s'il faut réenregistrer.
export function fusionneReglages(saved) {
  if (!saved) return { settings: { ...DEFAULT_SETTINGS }, modifie: false };

  const settings = { ...DEFAULT_SETTINGS, ...saved };
  if (settings.defautsDgx) return { settings, modifie: false };

  for (const champ of CHAMPS_GARNIS) {
    if (vide(settings[champ])) settings[champ] = DEFAULT_SETTINGS[champ];
  }

  // Un moteur Claude sans clé n'a jamais pu servir une seule conversation : on bascule sur
  // le moteur local, désormais renseigné. Une clé saisie est au contraire respectée.
  if (settings.provider === "claude" && vide(settings.apiKey)) settings.provider = "local";

  settings.defautsDgx = true;
  return { settings, modifie: true };
}
