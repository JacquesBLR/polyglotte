// Répétition espacée FSRS-4.5 (#44) — remplace la planification Leitner.
// Fonctions pures, paramètres par défaut publiés du modèle FSRS-4.5.
//
// Migration transparente : les cartes Leitner existantes (champ `box`, pas de
// `stability`) gardent leur `nextReview` planifié ; à leur prochaine révision,
// elles entrent dans FSRS avec une stabilité initiale semée depuis leur boîte
// (l'avancement acquis n'est pas perdu). Les nouvelles cartes entrent dans FSRS
// à leur première révision.

import { DAY_MS, LEITNER_DAYS } from "./leitner.js";

// Paramètres par défaut FSRS-4.5 (w0…w16).
export const W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031,
  1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
];

export const REQUEST_RETENTION = 0.9; // probabilité de rappel visée à l'échéance
export const MAX_INTERVAL_DAYS = 365;

const DECAY = -0.5;
const FACTOR = 19 / 81; // tel que R(S, S) = 0.9

// Notes de révision.
export const RATINGS = { again: 1, hard: 2, good: 3, easy: 4 };

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// Probabilité de rappel après `elapsedDays` pour une stabilité S.
export function retrievability(elapsedDays, stability) {
  return Math.pow(1 + FACTOR * (elapsedDays / stability), DECAY);
}

// Intervalle (jours entiers) visant REQUEST_RETENTION.
export function nextInterval(stability) {
  const days = (stability / FACTOR) * (Math.pow(REQUEST_RETENTION, 1 / DECAY) - 1);
  return clamp(Math.round(days), 1, MAX_INTERVAL_DAYS);
}

function initStability(rating) {
  return Math.max(0.1, W[rating - 1]);
}

function initDifficulty(rating) {
  return clamp(W[4] - (rating - 3) * W[5], 1, 10);
}

function nextDifficulty(d, rating) {
  const updated = d - W[6] * (rating - 3);
  // Réversion vers la difficulté initiale d'une carte « facile » (anti-dérive).
  return clamp(W[7] * initDifficulty(RATINGS.easy) + (1 - W[7]) * updated, 1, 10);
}

function stabilityAfterSuccess(s, d, r, rating) {
  const hardPenalty = rating === RATINGS.hard ? W[15] : 1;
  const easyBonus = rating === RATINGS.easy ? W[16] : 1;
  return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hardPenalty * easyBonus);
}

function stabilityAfterLapse(s, d, r) {
  const next = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
  return clamp(next, 0.1, s);
}

export function isFsrsCard(card) {
  return typeof card.stability === "number" && typeof card.difficulty === "number";
}

// Note une carte (rating ∈ 1..4) et retourne la carte replanifiée.
export function reviewCard(card, rating, now = Date.now()) {
  let stability, difficulty;
  if (!isFsrsCard(card)) {
    // Première révision FSRS : carte neuve, ou carte Leitner migrée (semence
    // de stabilité depuis la boîte pour conserver l'avancement).
    stability = initStability(rating);
    difficulty = initDifficulty(rating);
    if (rating !== RATINGS.again && card.box >= 2) {
      stability = Math.max(stability, LEITNER_DAYS[clamp(card.box, 1, 5)]);
    }
  } else {
    const elapsedDays = Math.max(0, (now - (card.lastReview ?? now)) / DAY_MS);
    const r = retrievability(elapsedDays, card.stability);
    difficulty = nextDifficulty(card.difficulty, rating);
    stability = rating === RATINGS.again
      ? stabilityAfterLapse(card.stability, card.difficulty, r)
      : stabilityAfterSuccess(card.stability, card.difficulty, r, rating);
  }
  const days = rating === RATINGS.again ? 1 : nextInterval(stability);
  return {
    ...card,
    stability,
    difficulty,
    lastReview: now,
    nextReview: now + days * DAY_MS,
    reps: (card.reps || 0) + 1,
    lapses: (card.lapses || 0) + (rating === RATINGS.again ? 1 : 0),
  };
}
