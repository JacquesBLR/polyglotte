// Carnet d'erreurs (#87) — fonctions pures.
//
// Une correction du tuteur (« ✗ jo veig vi → ✓ jo bec vi ») ne vit qu'un tour dans la
// bulle, puis disparaît avec la session. Le vocabulaire, lui, va au carnet et revient en
// révision ; les erreurs, signal pédagogique le plus personnel, n'étaient retenues nulle
// part. Elles deviennent des cartes FSRS comme les autres (`reviewCard` de fsrs.js), et
// les plus fragiles sont glissées dans le prompt de la séance suivante pour que le tuteur
// crée une occasion naturelle de les réemployer — ce que font Speak (Review), Praktika
// (Mistakes) et Loora.

import { DAY_MS } from "./leitner.js";

// Nombre maximal d'erreurs réactivées dans une séance : au-delà, la conversation tourne
// à l'exercice et le modèle les enfile toutes dans la première réplique.
export const MAX_REACTIVEES = 3;

// Une erreur réactivée récemment ne l'est pas deux séances de suite : laisser passer ce
// délai avant de la reproposer, sauf si elle est due en révision.
const DELAI_REACTIVATION_MS = DAY_MS;

// Clé de dédoublonnage : casse, espaces et ponctuation ignorés — « Bon dia! » relevé en
// conversation et « Bon dia » repris par le résumé sont la même erreur.
export const cleErreur = (s) => String(s ?? "").toLowerCase()
  .replace(/[.,;:!?¿¡«»"“”…。！？、،؛؟]/g, " ")
  .replace(/\s+/g, " ")
  .trim();
const cle = cleErreur;

// Ajoute une correction au carnet (dédoublonnage par langue + forme corrigée). Retourne
// un nouveau tableau, ou `carnet` lui-même si rien n'a été ajouté : les appelants testent
// l'identité pour savoir s'il faut enregistrer.
export function ajouteErreur(carnet, lang, correction, now = Date.now()) {
  if (!correction || !correction.original || !correction.corrected) return carnet;
  // Le modèle peut rendre autre chose qu'une chaîne malgré le schéma : on convertit.
  const original = String(correction.original).trim();
  const corrected = String(correction.corrected).trim();
  if (!original || !corrected || cle(original) === cle(corrected)) return carnet;
  const k = cle(corrected);
  const base = Array.isArray(carnet) ? carnet : [];
  if (base.some(e => e && e.lang === lang && cle(e.corrected) === k)) return carnet;
  return [...base, {
    id: now + Math.random(),
    lang,
    original,
    corrected,
    explanation: String(correction.explanation || "").trim(),
    nextReview: now,
    addedAt: now,
  }];
}

// Erreurs échues en révision.
export function erreursDues(carnet, now = Date.now()) {
  return (carnet || []).filter(e => e && Number.isFinite(e.nextReview) && e.nextReview <= now);
}

// Erreurs à réactiver dans la prochaine séance d'une langue : les dues d'abord, puis les
// plus souvent ratées, puis les plus récentes. Une erreur réactivée il y a moins d'un jour
// est écartée, même due : une erreur ajoutée est due tout de suite et le reste tant qu'elle
// n'est pas révisée, si bien qu'en dispenser les dues ramenait les trois mêmes à chaque
// séance et n'en laissait jamais passer d'autres (relecture adverse du 2026-10-12).
export function erreursAReactiver(carnet, lang, now = Date.now(), max = MAX_REACTIVEES) {
  const due = (e) => e.nextReview <= now;
  return (Array.isArray(carnet) ? carnet : [])
    .filter(e => e && e.lang === lang && e.corrected)
    .filter(e => !(e.reactivee && now - e.reactivee < DELAI_REACTIVATION_MS))
    .sort((a, b) =>
      (due(b) - due(a))
      || ((b.lapses || 0) - (a.lapses || 0))
      || ((b.addedAt || 0) - (a.addedAt || 0)))
    .slice(0, max);
}

// Marque des erreurs comme réactivées (horodatage), sans toucher à leur planification FSRS.
export function marqueReactivees(carnet, erreurs, now = Date.now()) {
  const ids = new Set((erreurs || []).map(e => e.id));
  if (!ids.size || !Array.isArray(carnet)) return carnet;
  return carnet.map(e => (ids.has(e.id) ? { ...e, reactivee: now } : e));
}

// Bloc de prompt : chaîne vide sans erreur, pour que le prompt reste strictement identique
// à celui d'aujourd'hui dans ce cas (testé). Le tuteur n'annonce ni ne liste rien : il
// amène la situation où la forme correcte sert, et ne corrige que si la faute revient.
export function blocErreursPrompt(erreurs) {
  if (!erreurs || !erreurs.length) return "";
  const lignes = erreurs.map(e => `  - « ${e.original} » → « ${e.corrected} »${e.explanation ? ` (${e.explanation})` : ""}`);
  return `
Erreurs faites par l'élève lors de séances précédentes, à RÉACTIVER discrètement :
${lignes.join("\n")}
Au fil de la conversation, amène naturellement une situation où la forme correcte est utile (pose une question qui
l'appelle, ou emploie-la toi-même dans ta réplique). Ne les annonce pas, ne les liste pas, ne dis pas que ce sont
d'anciennes erreurs. Si l'élève refait la faute, corrige-la comme d'habitude ; s'il emploie la bonne forme, continue
sans commentaire.`;
}
