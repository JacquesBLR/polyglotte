// Réglages : valeurs d'une installation neuve et fusion avec ce qui est enregistré.
// Fonctions pures, couvertes par tests/settings.test.mjs.

// Les champs moteur pointent sur le serveur du projet, sur le DGX, exposé en HTTPS sur le
// tailnet : hors tailnet il est injoignable, et tout reste modifiable dans ⚙️. Un seul
// hôte pour les deux usages — il sert le vocal (Whisper, Piper) et relaie le LLM vers la
// passerelle, qui elle-même ne renvoie pas d'en-tête CORS (#59). `apiKey` et `localKey`
// restent vides par principe : aucun secret dans le dépôt, et le relais n'en demande pas.
export const DEFAULT_SETTINGS = {
  provider: "local",
  apiKey: "",
  model: "claude-opus-5",
  localUrl: "https://spark-4569.tail34da6b.ts.net:8664/v1",
  localKey: "",
  localModel: "qwen3.8-nvfp4",
  localModelAlt: "",
  autospeak: true,
  rate: 1,
  reversedCards: false,
  voiceUrl: "https://spark-4569.tail34da6b.ts.net:8664",
  reminders: false,
  // Objectif hebdomadaire (#89) : jours de pratique visés par semaine. Un champ ajouté
  // après coup se garnit par la fusion ci-dessous, sans étape de migration.
  objectifJours: 4,
  defautsDgx: 2,
};

// Version des défauts déjà appliqués à une installation. Un **numéro** et non un booléen :
// la beta.8 avait garni les champs vides (v1) avec une URL de passerelle qui s'est révélée
// inappelable depuis un navigateur, et il a fallu pouvoir la corriger (v2) sans réécrire
// les réglages à chaque chargement (#59).
export const VERSION_DEFAUTS = 2;

// Champs garnis s'ils sont vides, en v1. Les clés en sont exclues : elles doivent rester
// vides tant que l'utilisateur n'en saisit pas.
const CHAMPS_GARNIS = ["localUrl", "localModel", "voiceUrl"];

// URL livrées par une version antérieure, remplacées en v2. Seules ces valeurs exactes sont
// réécrites — une URL saisie à la main n'est jamais touchée.
const URL_MOTEUR_PERIMEES = ["https://spark-4569.tail34da6b.ts.net:8646/v1"];

const vide = (v) => !String(v ?? "").trim();

// Fusionne les réglages enregistrés avec les défauts.
//
// `{ ...DEFAULT_SETTINGS, ...saved }` seul ne suffit pas : une chaîne vide enregistrée est
// une valeur comme une autre et gagnerait sur le défaut, si bien qu'une installation
// antérieure au préremplissage garderait ses champs moteur vides pour toujours.
//
// On applique donc les étapes que l'installation n'a pas encore vues, en lisant la version
// **dans les réglages enregistrés** — pas dans l'objet fusionné, qui hérite sinon du numéro
// courant et sauterait toute migration. Puis on enregistre la version atteinte. C'est ce qui
// préserve les gestes de l'utilisateur : vider l'URL du serveur vocal pour le couper tient au
// rechargement suivant, l'URL par défaut ne réapparaît pas.
//
// Retourne { settings, modifie } ; `modifie` dit s'il faut réenregistrer.
export function fusionneReglages(saved) {
  if (!saved) return { settings: { ...DEFAULT_SETTINGS }, modifie: false };

  const settings = { ...DEFAULT_SETTINGS, ...saved };
  const vu = Number(saved.defautsDgx) || 0; // la beta.8 écrivait `true`, soit 1
  if (vu >= VERSION_DEFAUTS) return { settings, modifie: false };

  if (vu < 1) {
    for (const champ of CHAMPS_GARNIS) {
      if (vide(settings[champ])) settings[champ] = DEFAULT_SETTINGS[champ];
    }
    // Un moteur Claude sans clé n'a jamais pu servir une seule conversation : on bascule sur
    // le moteur local, désormais renseigné. Une clé saisie est au contraire respectée.
    if (settings.provider === "claude" && vide(settings.apiKey)) settings.provider = "local";
  }

  if (vu < 2 && URL_MOTEUR_PERIMEES.includes(String(settings.localUrl || "").trim())) {
    settings.localUrl = DEFAULT_SETTINGS.localUrl;
  }

  settings.defautsDgx = VERSION_DEFAUTS;
  return { settings, modifie: true };
}
