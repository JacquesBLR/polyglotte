// Résumé de séance structuré (#93) — fonctions pures.
//
// Le résumé de fin de session était un texte libre, affiché une fois puis perdu : ce qu'il
// relevait n'allait nulle part. Il arrive désormais structuré (SUMMARY_SCHEMA) : ses erreurs
// et son vocabulaire sont versés aux carnets existants, le bilan est conservé dans
// l'historique pour être relu depuis l'écran Progrès, et le niveau observé pendant la séance
// (pas le réglage) permet de voir, séance après séance, s'il bouge — ce que donnent le
// lesson report de Praktika et le session summary de Speak.

import { ajouteErreur } from "./erreurs.js";
import { addVocabulary } from "./leitner.js";

export const NIVEAUX_CECRL = ["A1", "A2", "B1", "B2", "C1"];

// Taille maximale du texte conservé dans l'historique (l'affichage immédiat reste entier).
export const TEXTE_MAX = 1500;

const chaine = (v) => (typeof v === "string" ? v.trim() : "");
const listeChaines = (v) => (Array.isArray(v) ? v.map(chaine).filter(Boolean) : []);

// Normalise la réponse du modèle ; `null` si elle n'est pas exploitable (pas de texte).
export function resumeValide(data) {
  if (!data || typeof data !== "object") return null;
  const texte = chaine(data.texte);
  if (!texte) return null;
  const niveau = chaine(data.niveau_observe).toUpperCase();
  return {
    texte,
    points_forts: listeChaines(data.points_forts),
    erreurs: (Array.isArray(data.erreurs) ? data.erreurs : [])
      .map(e => e && { original: chaine(e.original), corrected: chaine(e.corrected), explanation: chaine(e.explanation) })
      .filter(e => e && e.original && e.corrected),
    vocabulaire: (Array.isArray(data.vocabulaire) ? data.vocabulaire : [])
      .map(v => v && { term: chaine(v.term), translation: chaine(v.translation), reading: chaine(v.reading) || null })
      .filter(v => v && v.term && v.translation),
    phrases_a_reviser: listeChaines(data.phrases_a_reviser),
    conseil: chaine(data.conseil),
    niveau_observe: NIVEAUX_CECRL.includes(niveau) ? niveau : null,
  };
}

// Verse les erreurs et le vocabulaire du résumé aux carnets. Les dédoublonnages existants
// s'appliquent ; les tableaux rendus sont les mêmes objets si rien n'a changé.
export function integreResume(deck, carnet, resume, lang, now = Date.now()) {
  if (!resume) return { deck, carnet };
  let carnetSuivant = carnet;
  for (const e of resume.erreurs) carnetSuivant = ajouteErreur(carnetSuivant, lang, e, now);
  let deckSuivant = addVocabulary(deck, lang, resume.vocabulaire, now);
  if (deckSuivant.length === deck.length) deckSuivant = deck; // addVocabulary recopie même sans ajout
  return { deck: deckSuivant, carnet: carnetSuivant };
}

// Ce qui est conservé dans l'entrée d'historique : compact, texte borné.
export function entreeResume(resume) {
  if (!resume) return null;
  const texte = resume.texte.length > TEXTE_MAX ? resume.texte.slice(0, TEXTE_MAX - 1).trimEnd() + "…" : resume.texte;
  return {
    texte,
    pointsForts: resume.points_forts,
    conseil: resume.conseil,
    phrases: resume.phrases_a_reviser,
    nbErreurs: resume.erreurs.length,
    nbMots: resume.vocabulaire.length,
  };
}

// Niveaux observés, du plus ancien au plus récent (séances qui en ont un).
export function niveauxObserves(history) {
  return (history || [])
    .filter(h => h && Number.isFinite(h.date) && NIVEAUX_CECRL.includes(h.niveauObserve))
    .sort((a, b) => a.date - b.date)
    .map(h => ({ date: h.date, niveau: h.niveauObserve, lang: h.lang }));
}

// Tendance sur les `n` dernières séances observées d'une langue (toutes langues si omise) :
// { de, a, n, sens: -1|0|1 } ou null s'il y a moins de deux observations.
export function tendanceNiveau(history, lang = null, n = 5) {
  const obs = niveauxObserves(history).filter(o => !lang || o.lang === lang).slice(-n);
  if (obs.length < 2) return null;
  const de = obs[0].niveau;
  const a = obs[obs.length - 1].niveau;
  return { de, a, n: obs.length, sens: Math.sign(NIVEAUX_CECRL.indexOf(a) - NIVEAUX_CECRL.indexOf(de)) };
}
