// « Répète après moi » (#95) — fonctions pures.
//
// Le retour sur la prononciation n'existait que dans l'écran Exercices. En conversation,
// l'élève peut désormais répéter une réplique du tuteur : la reconnaissance vocale rend ce
// qu'elle a entendu, et l'alignement mot à mot de diff.js dit ce qui est passé — comme la
// répétition des répliques chez Speak (mots manqués surlignés, score, on réessaie) ou le
// pronunciation feedback de Praktika. Les scores d'une séance sont agrégés dans son entrée
// d'historique ; rien n'est envoyé au tuteur.

import { gradeAttempt } from "./diff.js";

export function scorePrononciation(cible, entendu, langId) {
  const g = gradeAttempt(cible, entendu, langId);
  const reconnus = g.tokens.map((_, i) => g.matched.has(i));
  return {
    score: g.score,
    tokens: g.tokens,
    reconnus,
    manques: g.tokens.filter((_, i) => !reconnus[i]),
    isCharBased: g.isCharBased,
    entendu: String(entendu || "").trim(),
  };
}

// Appréciation courte, accordée au score.
export function appreciation(score) {
  if (score >= 100) return "🌟 Parfait";
  if (score >= 80) return "👍 Très bien";
  if (score >= 50) return "🙂 Pas mal";
  return "💪 Encore un essai";
}

// Somme des scores d'une agrégation ; les entrées antérieures à `somme` (beta.27) la
// reconstituent depuis leur moyenne arrondie — au plus une demi-unité d'écart, une fois.
const sommeDe = (p) => (Number.isFinite(p.somme) ? p.somme : p.moyenne * p.n);

// Agrège un score dans l'entrée d'historique d'une séance : { n, somme, moyenne, meilleur }.
// La somme est exacte ; seule la moyenne affichée est arrondie, et elle est recalculée depuis
// la somme — recombiner une moyenne arrondie cumulait l'erreur à chaque essai.
// Retourne une nouvelle entrée ; l'original n'est pas muté.
export function integreScore(entry, score) {
  const s = Number(score);
  if (!entry || !Number.isFinite(s)) return entry;
  const p = entry.prononciation || { n: 0, somme: 0, moyenne: 0, meilleur: 0 };
  const n = p.n + 1;
  const somme = sommeDe(p) + s;
  return {
    ...entry,
    prononciation: { n, somme, moyenne: Math.round(somme / n), meilleur: Math.max(p.meilleur, s) },
  };
}

// Moyenne des `max` dernières séances mesurées, pondérée par le nombre d'essais ; null sans mesure.
export function moyennePrononciation(history, max = 5) {
  const mesurees = (history || [])
    .filter(h => h && Number.isFinite(h.date) && h.prononciation && h.prononciation.n > 0)
    .sort((a, b) => b.date - a.date)
    .slice(0, max);
  const essais = mesurees.reduce((t, h) => t + h.prononciation.n, 0);
  if (!essais) return null;
  return Math.round(mesurees.reduce((t, h) => t + sommeDe(h.prononciation), 0) / essais);
}
