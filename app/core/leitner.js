// Répétition espacée (boîtes de Leitner) et statistiques — fonctions pures.

export const DAY_MS = 24 * 60 * 60 * 1000;
export const LEITNER_DAYS = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };

// Ajoute les mots extraits d'un tour au carnet (dédoublonnage par terme + langue).
// Retourne un nouveau tableau (le carnet n'est jamais muté).
export function addVocabulary(deck, lang, items, now = Date.now()) {
  if (!Array.isArray(items) || !items.length) return deck;
  const next = [...deck];
  for (const it of items) {
    if (!it || !it.term || !it.translation) continue;
    const key = it.term.trim().toLowerCase();
    if (next.some(c => c.lang === lang && c.term.trim().toLowerCase() === key)) continue;
    next.push({
      id: now + Math.random(),
      lang,
      term: it.term.trim(),
      translation: it.translation.trim(),
      reading: it.reading || null,
      box: 1,
      nextReview: now,
      addedAt: now,
    });
  }
  return next;
}

export function dueCards(deck, now = Date.now()) {
  return deck.filter(c => c.nextReview <= now);
}

// Note une carte : réussie → boîte supérieure, ratée → boîte 1. Retourne la carte mise à jour.
export function gradeCard(card, knew, now = Date.now()) {
  const box = knew ? Math.min(5, card.box + 1) : 1;
  return { ...card, box, nextReview: now + LEITNER_DAYS[box] * DAY_MS };
}

export function computeStreak(history, today = new Date()) {
  const days = new Set(history.map(s => new Date(s.date).toDateString()));
  let streak = 0;
  const d = new Date(today);
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (days.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}
