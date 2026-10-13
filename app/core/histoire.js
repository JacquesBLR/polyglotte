// Histoires à écouter (#113) — compréhension orale, fonctions pures.
//
// L'app entraînait à parler et à transcrire, pas à comprendre un texte suivi à l'oreille.
// Modèle : Duolingo Stories (une courte histoire au niveau, lue à voix haute, avec des
// questions de compréhension à choix multiple), les Podcasts de Babbel, et Pimsleur (l'oreille
// d'abord, l'écrit ensuite). Le tuteur raconte ; le texte reste masqué tant que l'élève ne
// le demande pas ; trois questions EN FRANÇAIS, corrigées localement, sans second appel.

import { partialStringField } from "./stream.js";

export const NB_QUESTIONS = 3;

// Longueur de l'histoire par niveau de l'app : phrases et plafond de mots (#125). Sans plafond,
// une histoire avancée en japonais, arabe ou tunisien prenait 55 à 111 s (726 à 1 268 jetons :
// le texte, sa translittération, sa traduction et les questions). Le plafond tient la
// longueur, pas la difficulté : l'avancé garde ses registres et ses sous-entendus.
export const MOTS_MAX = { debutant: 40, intermediaire: 70, avance: 100 };
export const LONGUEUR = {
  debutant: `4 à 5 phrases très courtes (${MOTS_MAX.debutant} mots au plus), au présent, vocabulaire de base`,
  intermediaire: `5 à 6 phrases (${MOTS_MAX.intermediaire} mots au plus), temps du passé inclus, quelques connecteurs`,
  avance: `6 à 7 phrases denses (${MOTS_MAX.avance} mots au plus) : registres variés, sous-entendus, une expression idiomatique`,
};

const READING = {
  anyOf: [{ type: "null" }, { type: "string", description: "Translittération latine de l'histoire." }],
};

// Schéma de l'histoire ; sans `reading` en alphabet latin (même règle que le tour, #103).
export function schemaHistoire({ lecture = true } = {}) {
  const properties = {
    titre: { type: "string", description: "Titre court de l'histoire, en français." },
    texte: { type: "string", description: "L'histoire en langue cible, texte prononçable (pas de listes ni d'emojis)." },
    ...(lecture ? { reading: READING } : {}),
    traduction: { type: "string", description: "Traduction française fidèle de l'histoire." },
    questions: {
      type: "array",
      description: `Exactement ${NB_QUESTIONS} questions de compréhension EN FRANÇAIS, dans l'ordre du récit.`,
      items: {
        type: "object",
        properties: {
          question: { type: "string", description: "La question, en français." },
          choix: { type: "array", items: { type: "string" }, description: "3 réponses possibles en français, une seule juste." },
          bonne: { type: "integer", description: "Indice (0, 1 ou 2) de la bonne réponse dans choix." },
        },
        required: ["question", "choix", "bonne"],
        additionalProperties: false,
      },
    },
  };
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

// Demande au modèle (message utilisateur ; le système est exoSystemPrompt).
export function demandeHistoire({ cfg, level }) {
  const n = level in LONGUEUR ? level : "debutant";
  const japonais = cfg.ecriture === "japonais" ? ` (en japonais : ${Math.round(MOTS_MAX[n] * 2.5)} caractères au plus)` : "";
  return `Raconte une courte histoire en ${cfg.langFr} pour un élève francophone, qui va l'ÉCOUTER sans la lire.
Longueur : ${LONGUEUR[n]}${japonais} ; ne dépasse pas ce plafond. Elle se passe à ${cfg.tutor.city}, dans la vie quotidienne,
avec un personnage, un petit problème et sa résolution. Puis pose ${NB_QUESTIONS} questions de compréhension EN FRANÇAIS,
chacune avec 3 réponses possibles en français, courtes (une dizaine de mots au plus), dont une seule est juste (les deux
autres plausibles mais contredites par l'histoire) ; varie la place de la bonne réponse. Les questions portent sur le sens
(qui, où, pourquoi, que se passe-t-il), pas sur un mot isolé.`;
}

const chaine = (v) => (typeof v === "string" ? v.trim() : "");

// Normalise l'histoire rendue par le modèle ; null si elle n'est pas exploitable. Une
// question est gardée si elle a au moins 2 choix distincts et un indice de bonne réponse
// dans les bornes (après dédoublonnage des choix, l'indice suit la bonne réponse).
export function histoireValide(data) {
  if (!data || typeof data !== "object") return null;
  const texte = chaine(data.texte);
  if (!texte) return null;
  const questions = [];
  for (const q of Array.isArray(data.questions) ? data.questions : []) {
    if (!q || typeof q !== "object") continue;
    const question = chaine(q.question);
    const brut = Array.isArray(q.choix) ? q.choix.map(chaine) : [];
    if (!question || !Number.isInteger(q.bonne) || q.bonne < 0 || q.bonne >= brut.length || !brut[q.bonne]) continue;
    const juste = brut[q.bonne];
    const vus = new Set();
    const choix = brut.filter(c => c && !vus.has(c.toLowerCase()) && vus.add(c.toLowerCase()));
    if (choix.length < 2) continue;
    // Casse ignorée (le dédoublonnage aussi) : « Paris » / « paris » avec bonne = 1 rendait -1
    // (relecture du soir, #113).
    const bonne = choix.findIndex(c => c.toLowerCase() === juste.toLowerCase());
    if (bonne < 0) continue;
    questions.push({ question, choix, bonne });
  }
  if (!questions.length) return null;
  return {
    titre: chaine(data.titre) || "Histoire",
    texte,
    reading: chaine(data.reading) || null,
    traduction: chaine(data.traduction),
    questions: questions.slice(0, NB_QUESTIONS),
  };
}

// Score : { justes, total, pourcent }. `reponses[i]` = indice choisi pour la question i.
export function scoreHistoire(histoire, reponses) {
  const qs = histoire?.questions || [];
  const justes = qs.filter((q, i) => Array.isArray(reponses) && reponses[i] === q.bonne).length;
  return { justes, total: qs.length, pourcent: qs.length ? Math.round((100 * justes) / qs.length) : 0 };
}

// ---------- Progression pendant la génération (#125) ----------
//
// Une histoire avancée prenait jusqu'à 111 s sous un statut fixe « prépare une histoire… » :
// l'élève ne savait pas si le tuteur travaillait ou si c'était cassé. La réponse arrive
// désormais en flux ; ses champs arrivent dans l'ordre du schéma (texte, translittération,
// traduction, questions), ce qui donne l'étape en cours et une part estimée. Les longueurs
// attendues viennent de 16 histoires réelles via gw (13/10) : translittération 2,6 fois le
// texte en japonais, 1,4 en arabe ; traduction 2,8, 1,4 ou 1,1 fois le texte selon l'écriture.
const ETAPES = [
  { champ: "texte", libelle: "écrit l'histoire", poids: 1 },
  { champ: "reading", libelle: "écrit la transcription", poids: 1 },
  { champ: "traduction", libelle: "traduit l'histoire", poids: 1 },
  { champ: "questions", libelle: "prépare les questions", poids: 0.8 },
];
const CAR_PAR_MOT = { japonais: 2.5, arabe: 5.5, latin: 6 };
const RAPPORT = {
  reading: { japonais: 2.6, arabe: 1.4, latin: 1 },
  traduction: { japonais: 2.8, arabe: 1.4, latin: 1.1 },
};

// { etape (0 = rien encore), libelle, part (0 à 0,99) } d'après le JSON reçu jusqu'ici.
export function progressionHistoire(buffer, { lecture = true, level = "debutant", ecriture = "latin" } = {}) {
  const b = typeof buffer === "string" ? buffer : "";
  const etapes = ETAPES.filter(e => lecture || e.champ !== "reading");
  const total = etapes.reduce((t, e) => t + e.poids, 0);
  const ec = ecriture in CAR_PAR_MOT ? ecriture : "latin";
  const texte = partialStringField(b, "texte");
  const attendu = {
    texte: (MOTS_MAX[level] || MOTS_MAX.debutant) * CAR_PAR_MOT[ec],
    reading: Math.max(1, (texte?.text.length || 0) * RAPPORT.reading[ec]),
    traduction: Math.max(1, (texte?.text.length || 0) * RAPPORT.traduction[ec]),
  };
  let i = -1;
  etapes.forEach((e, k) => { if (b.includes(`"${e.champ}"`)) i = k; });
  if (i < 0) return { etape: 0, libelle: "réfléchit à l'histoire", part: 0 };
  const e = etapes[i];
  let fraction;
  if (e.champ === "questions") {
    fraction = (b.slice(b.indexOf('"questions"')).match(/"bonne"\s*:/g) || []).length / NB_QUESTIONS;
  } else {
    const champ = partialStringField(b, e.champ);
    fraction = champ ? (champ.complete ? 1 : champ.text.length / attendu[e.champ]) : 0;
  }
  const faits = etapes.slice(0, i).reduce((t, x) => t + x.poids, 0);
  const part = (faits + e.poids * Math.min(Math.max(fraction, 0), 0.95)) / total;
  return { etape: i + 1, libelle: e.libelle, part: Math.min(Math.round(part * 100) / 100, 0.99) };
}
