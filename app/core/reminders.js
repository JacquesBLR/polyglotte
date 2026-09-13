// Rappels de révision — calcul pur de la prochaine échéance à notifier (#37).
// La planification elle-même vit dans app/notify (dépendante de la plateforme).

import { DAY_MS } from "./leitner.js";

// Heure du rappel, en heure locale de l'appareil.
export const DEFAULT_REMINDER_HOUR = 19;

// Ramène un instant à `hour` h 00 le même jour (heure locale).
function atHour(ms, hour) {
  const d = new Date(ms);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

// Cartes dues à un instant donné.
function dueAt(deck, ms) {
  return deck.filter(c => c.nextReview <= ms).length;
}

/**
 * Prochain rappel à planifier pour un carnet, ou `null` s'il n'y a rien à revoir.
 * Le rappel tombe à `hour` h 00, le premier jour où au moins une carte est due —
 * jamais dans le passé, jamais pour zéro carte.
 *
 * @returns {{ at: number, count: number } | null} instant (ms) et nombre de cartes dues.
 */
export function nextReminder(deck, now = Date.now(), hour = DEFAULT_REMINDER_HOUR) {
  const cartes = (deck || []).filter(c => c && Number.isFinite(c.nextReview));
  if (!cartes.length) return null;

  const plusTot = Math.min(...cartes.map(c => c.nextReview));
  let at = atHour(Math.max(plusTot, now), hour);
  // Deux reports au plus : l'heure du jour peut être passée, et une carte due
  // en soirée peut ne pas l'être encore à l'heure du rappel.
  for (let i = 0; i < 2 && (at <= now || dueAt(cartes, at) === 0); i++) {
    at = atHour(at + DAY_MS, hour);
  }
  const count = dueAt(cartes, at);
  if (at <= now || count === 0) return null;
  return { at, count };
}

// Texte du rappel — accordé au nombre de cartes.
export function reminderBody(count) {
  return count === 1
    ? "1 mot t'attend au carnet. Deux minutes suffisent !"
    : `${count} mots t'attendent au carnet. Deux minutes suffisent !`;
}
