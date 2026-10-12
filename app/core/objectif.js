// Objectif hebdomadaire (#89) — fonctions pures.
//
// La série de jours d'affilée se casse au premier jour manqué et ne dit rien de
// l'intention. Ici, l'élève choisit un nombre de jours de pratique par semaine (comme
// Speak : 3, 5, 7 ; Duolingo et Praktika comptent en minutes ou en XP) ; l'app montre où il
// en est dans la semaine (lundi → dimanche, heure locale) et depuis combien de semaines il
// tient. Tout est calculé depuis l'historique des sessions, rien n'est stocké en plus.

import { DAY_MS } from "./leitner.js";

export const OBJECTIFS_JOURS = [3, 4, 5, 7];
export const OBJECTIF_JOURS_DEFAUT = 4;
export const JOURS_COURTS = ["L", "M", "M", "J", "V", "S", "D"];

// Une session a duré au moins une minute dès qu'elle a eu un tour : sans ce plancher, une
// session d'un seul échange compterait zéro, ce qui serait plus faux qu'une minute.
const PLANCHER_SESSION_MS = 60 * 1000;
const MAX_SEMAINES = 520;

export function normaliseCible(cible) {
  const n = Number(cible);
  return Number.isInteger(n) && n >= 1 && n <= 7 ? n : OBJECTIF_JOURS_DEFAUT;
}

// Index du jour dans la semaine : 0 = lundi … 6 = dimanche (heure locale).
export function indexJour(ms) {
  return (new Date(ms).getDay() + 6) % 7;
}

// Ajoute des jours civils (robuste aux changements d'heure : on passe par la date).
function ajouteJours(ms, n) {
  const d = new Date(ms);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

// Lundi 0 h 00 (heure locale) de la semaine contenant `ms`.
// Le lundi est construit directement depuis sa date civile : partir du minuit du jour de
// `ms` puis reculer échouait dans les fuseaux où ce minuit n'existe pas (changement d'heure
// à 0 h, America/Santiago, Asia/Beirut) — 01:00 était reporté au lundi, qui perdait ses
// séances entre 0 h et 1 h.
export function debutSemaine(ms) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - indexJour(ms), 0, 0, 0, 0).getTime();
}

// Une séance ouverte puis quittée sans que l'élève ait parlé n'a qu'un tour — l'accueil du
// tuteur — et ne compte pas comme un jour de pratique. Les entrées sans compteur de tours
// (antérieures) comptent.
const pratiquee = (s) => !Number.isFinite(s.turns) || s.turns >= 2;

function dureeSession(s) {
  const fin = Number.isFinite(s.lastAt) ? s.lastAt : s.date;
  return Math.max(PLANCHER_SESSION_MS, fin - s.date);
}

/**
 * Bilan de la semaine contenant `now`.
 * @returns {{ jours: boolean[], pratiques: number, cible: number, minutes: number,
 *   atteint: boolean, restants: number, aujourdhui: number, joursRestants: number, tenable: boolean }}
 *  - jours : sept booléens, lundi → dimanche ; une session compte pour le jour où elle a commencé.
 *  - restants : jours de pratique encore nécessaires ; joursRestants : jours de la semaine
 *    encore disponibles, aujourd'hui compris ; tenable : l'objectif reste atteignable.
 */
export function bilanHebdo(history, cible, now = Date.now()) {
  const debut = debutSemaine(now);
  const fin = ajouteJours(debut, 7);
  const jours = Array(7).fill(false);
  let dureeMs = 0;
  for (const s of history || []) {
    if (!s || !Number.isFinite(s.date) || s.date < debut || s.date >= fin || !pratiquee(s)) continue;
    jours[indexJour(s.date)] = true;
    dureeMs += dureeSession(s);
  }
  const pratiques = jours.filter(Boolean).length;
  const cibleN = normaliseCible(cible);
  const aujourdhui = indexJour(now);
  const joursRestants = 7 - aujourdhui;
  const restants = Math.max(0, cibleN - pratiques);
  // Aujourd'hui compte parmi les jours disponibles seulement s'il n'est pas déjà pratiqué.
  const disponibles = joursRestants - (jours[aujourdhui] ? 1 : 0);
  return {
    jours, pratiques, cible: cibleN, minutes: Math.round(dureeMs / 60000),
    atteint: pratiques >= cibleN, restants, aujourdhui, joursRestants, tenable: restants <= disponibles,
  };
}

// Semaines consécutives où l'objectif a été tenu, la semaine en cours comprise si elle
// l'est déjà — et non comptée contre l'élève tant qu'elle est en cours.
export function semainesTenues(history, cible, now = Date.now()) {
  let n = bilanHebdo(history, cible, now).atteint ? 1 : 0;
  const debut = debutSemaine(now);
  for (let k = 1; k <= MAX_SEMAINES; k++) {
    // Milieu de la semaine visée : à l'abri des changements d'heure.
    const repere = ajouteJours(debut, -7 * k + 3);
    if (!bilanHebdo(history, cible, repere).atteint) break;
    n++;
  }
  return n;
}

const jour = (n) => `${n} jour${n > 1 ? "s" : ""}`;

export function messageHebdo(bilan) {
  if (bilan.atteint) return `Objectif atteint : ${jour(bilan.pratiques)} cette semaine. Continue si tu veux !`;
  if (!bilan.tenable) return `${jour(bilan.pratiques)} sur ${bilan.cible} — plus assez de jours cette semaine. On repart lundi.`;
  if (bilan.restants === 1) return "Plus qu'un jour de pratique pour tenir ton objectif.";
  return `Encore ${jour(bilan.restants)} de pratique pour tenir ton objectif.`;
}
