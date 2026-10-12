// Contrôle d'écriture de la réplique du tuteur (#107) — fonctions pures.
//
// Le décodage guidé garantit la forme du JSON, pas l'alphabet de "reply". Le tunisien en
// écriture arabe en est la preuve : sur 12 démarrages réels via gw (2026-10-12), un [START]
// est sorti entièrement en arabizi et un tour a mêlé de l'alphabet latin à l'arabe, malgré la
// consigne. La réplique est donc contrôlée après chaque tour : si son écriture n'est pas
// celle de la langue (cfg.ecriture), le tuteur est relancé UNE fois.
//
// Plages explicites plutôt que \p{Script=…} : le moteur Hermes de l'app native ne les
// garantit pas.
const PLAGES = {
  latin: /[A-Za-zÀ-ɏḀ-ỿ]/g,
  arabe: /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g,
  japonais: /[぀-ヿ㐀-䶿一-鿿ｦ-ﾟ]/g,
};

export const LIBELLES = { latin: "l'alphabet latin", arabe: "l'écriture arabe", japonais: "l'écriture japonaise (kanji et kana)" };

// Part minimale de lettres dans l'écriture attendue. Un nom propre ou un sigle étranger
// (« Paris », « OK ») dans une réplique ne doit pas déclencher de relance.
export const PART_MIN = 0.7;
// En dessous de ce nombre de lettres reconnues, pas de verdict (« OK! », « 3/7/9 »…).
export const LETTRES_MIN = 4;

const compte = (texte, ecriture) => (texte.match(PLAGES[ecriture]) || []).length;

// Mesure de l'écriture d'un texte : { attendu, autres, part } — part = attendu / (attendu +
// autres), null s'il y a trop peu de lettres pour juger.
export function mesureEcriture(texte, ecriture) {
  if (!PLAGES[ecriture] || typeof texte !== "string") return null;
  const attendu = compte(texte, ecriture);
  let autres = 0;
  for (const e of Object.keys(PLAGES)) if (e !== ecriture) autres += compte(texte, e);
  const total = attendu + autres;
  return { attendu, autres, part: total < LETTRES_MIN ? null : attendu / total };
}

// Vrai si le texte est dans l'écriture attendue, ou si l'on ne peut pas en juger (écriture
// inconnue, texte trop court) : le contrôle ne doit jamais bloquer un tour par excès de zèle.
export function ecritureConforme(texte, ecriture) {
  const m = mesureEcriture(texte, ecriture);
  return !m || m.part === null || m.part >= PART_MIN;
}

// Message ajouté à l'historique pour la relance : le modèle voit sa réplique fautive et
// la consigne, puis réécrit le tour entier (même schéma).
export function messageRelance(ecriture) {
  return `[CONSIGNE] Ta réplique précédente n'était pas écrite dans ${LIBELLES[ecriture] || ecriture}. `
    + `Réécris exactement le même tour (même sens, même JSON), avec "reply" entièrement dans ${LIBELLES[ecriture] || ecriture}.`;
}

// Contrôle avec relance unique. `relance(messages)` rend le JSON brut d'un nouvel appel ;
// `historique` est celui du tour (déjà terminé par le message de l'élève). Rend
// { data, relance: bool, conforme: bool } : la seconde réponse n'est retenue que si elle est
// conforme ; sinon la première reste (déjà affichée), signalée non conforme. Une relance en
// échec (réseau, troncature) ne fait jamais échouer le tour.
export async function controleEcriture({ data, ecriture, historique, relance }) {
  if (!data || ecritureConforme(data.reply, ecriture)) return { data, relance: false, conforme: true };
  let seconde = null;
  try {
    seconde = JSON.parse(await relance([
      ...historique,
      { role: "assistant", content: String(data.reply) },
      { role: "user", content: messageRelance(ecriture) },
    ]));
  } catch (_) { seconde = null; }
  if (seconde && typeof seconde.reply === "string" && ecritureConforme(seconde.reply, ecriture)) {
    return { data: seconde, relance: true, conforme: true };
  }
  return { data, relance: true, conforme: false };
}
