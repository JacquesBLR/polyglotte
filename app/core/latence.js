// Sonde de latence du tuteur (#98) — fonctions pures.
//
// La nuit du 11 au 12 octobre 2026 a vu ~13 s par tour et 36 s pour le résumé de séance,
// sans que l'app le mesure ni le dise : l'élève attendait sans savoir si le tuteur
// réfléchissait ou si c'était cassé. Chaque appel au modèle est désormais chronométré —
// temps au premier jeton (premier fragment de texte reçu en streaming ; égal au total sans
// streaming) et temps total —, journalisé localement, et l'UI prévient au-delà d'un seuil.

// Seuils d'alerte, en millisecondes, par nature d'appel. En conversation, c'est le premier
// jeton qui compte (le tuteur commence à parler dès la première phrase) ; le total borne
// les tours qui traînent ensuite. Le résumé et l'explication ne sont pas streamés : seul
// leur total compte. Calés au-dessus de l'ordinaire mesuré — la nuit du 11/10 : 13 s par
// tour, 36 s le résumé ; le banc du 12/10 au matin (scripts/banc-latence.mjs, gw → vLLM
// qwen3.8-nvfp4) : premier jeton ~1,1 s, tour 16 à 26 s, résumé 42 s ; explication 12 à
// 21 s. L'alerte doit signaler un serveur anormalement lent, pas l'ordinaire.
export const SEUILS = {
  tour: { premierJeton: 6000, total: 35000 },
  resume: { premierJeton: null, total: 60000 },
  explique: { premierJeton: null, total: 35000 },
};

// Taille du journal conservé par profil.
export const MAX_MESURES = 50;

// Chronomètre à horloge injectable. `premierJeton()` ne retient que le premier appel ;
// `fin()` rend { premierJeton, total } en ms — premierJeton vaut le total si aucun
// fragment n'a été signalé (appel non streamé). `replique()` (#103) marque l'instant où le
// texte lu à l'élève est complet (la réplique du tour, le texte du résumé) : c'est ce que
// l'élève attend vraiment, le reste du JSON (traduction, suggestions…) arrivant pendant
// que le tuteur parle. Absent de `fin()` s'il n'a pas été marqué.
export function creeChrono(horloge = Date.now) {
  const t0 = horloge();
  let tPremier = null;
  let tReplique = null;
  return {
    premierJeton() { if (tPremier === null) tPremier = horloge(); },
    replique() { if (tReplique === null) tReplique = horloge(); },
    fin() {
      const total = Math.max(0, horloge() - t0);
      const m = { premierJeton: tPremier === null ? total : Math.max(0, tPremier - t0), total };
      if (tReplique !== null) m.replique = Math.max(0, tReplique - t0);
      return m;
    },
  };
}

// Construit une mesure à journaliser.
export function mesure(nature, chrono, { stream = false, modele = "", at = Date.now() } = {}) {
  return { nature, ...chrono, stream: !!stream, modele: String(modele || ""), at };
}

const nombre = (v) => Number.isFinite(v) && v >= 0;

// Raison de lenteur ("premierJeton" | "total") ou null. Mesure invalide → null.
export function lenteur(m) {
  const s = m && SEUILS[m.nature];
  if (!s) return null;
  if (s.premierJeton !== null && m.stream && nombre(m.premierJeton) && m.premierJeton >= s.premierJeton) return "premierJeton";
  if (nombre(m.total) && m.total >= s.total) return "total";
  return null;
}

// Virgule décimale écrite à la main : `toLocaleString` dépend du moteur JS (Hermes).
export const enSecondes = (ms) => `${String(Math.round(ms / 100) / 10).replace(".", ",")} s`;

// Message d'alerte pour l'UI, chaîne vide si la mesure n'est pas lente.
export function messageLenteur(m) {
  const r = lenteur(m);
  if (!r) return "";
  const chiffre = r === "premierJeton"
    ? `premier mot après ${enSecondes(m.premierJeton)}`
    : `réponse en ${enSecondes(m.total)}`;
  return `🐢 Le tuteur est lent (${chiffre}) — le serveur est peut-être chargé ; tu peux continuer, ou réessayer plus tard.`;
}

// Ajoute une mesure au journal, borné aux `max` plus récentes. Mesure invalide → journal
// rendu tel quel (identité testée par l'appelant).
export function ajouteMesure(journal, m, max = MAX_MESURES) {
  const base = Array.isArray(journal) ? journal : [];
  if (!m || !SEUILS[m.nature] || !nombre(m.total) || !nombre(m.premierJeton)) return journal;
  return [...base, m].slice(-max);
}

// Centile au rang le plus proche (p dans ]0, 100]) d'une liste de nombres.
export function centile(valeurs, p) {
  const v = valeurs.filter(nombre).sort((a, b) => a - b);
  if (!v.length) return null;
  const rang = Math.min(v.length, Math.max(1, Math.ceil((p / 100) * v.length)));
  return v[rang - 1];
}

// Statistiques d'une nature d'appel : { n, premierJeton (médiane), total (médiane),
// totalP90, lents } — null si aucune mesure.
export function statsLatence(journal, nature) {
  const ms = (Array.isArray(journal) ? journal : []).filter(m => m && m.nature === nature);
  if (!ms.length) return null;
  return {
    n: ms.length,
    premierJeton: centile(ms.map(m => m.premierJeton), 50),
    total: centile(ms.map(m => m.total), 50),
    totalP90: centile(ms.map(m => m.total), 90),
    replique: centile(ms.map(m => m.replique), 50), // null si aucune mesure ne la porte
    lents: ms.filter(m => lenteur(m)).length,
  };
}

// Ligne de journal console, une par appel.
export function ligneConsole(m) {
  const rep = nombre(m.replique) ? `, réplique ${m.replique} ms` : "";
  return `[latence] ${m.nature}${m.stream ? " (stream)" : ""} premier jeton ${m.premierJeton} ms${rep}, total ${m.total} ms${m.modele ? `, ${m.modele}` : ""}`;
}
