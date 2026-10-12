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
  // Test de niveau : jamais streamé, seul le total compte ; journalisé à part pour ne plus
  // fausser la médiane du premier mot des tours (relecture du 12/10, L1).
  evaluation: { premierJeton: null, total: 35000 },
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
// `relance` (#110, D3) : le tour a été réécrit par le contrôle d'écriture — le total
// couvre alors les deux appels, ce que l'élève a réellement attendu. Absent sinon.
export function mesure(nature, chrono, { stream = false, modele = "", at = Date.now(), relance = false } = {}) {
  const m = { nature, ...chrono, stream: !!stream, modele: String(modele || ""), at };
  if (relance) m.relance = true;
  return m;
}

const nombre = (v) => Number.isFinite(v) && v >= 0;

// Appels en échec (#107) : sans eux, un serveur qui coupe ou une réponse tronquée restaient
// invisibles dans les statistiques — seuls les succès étaient chronométrés. Chaque échec
// est journalisé avec sa nature, son type et sa durée jusqu'à l'échec.
export const TYPES_ECHEC = {
  tronque: "coupé par le plafond de jetons",
  coupure: "connexion coupée en cours de réponse",
  reseau: "serveur injoignable",
  serveur: "erreur du serveur",
  json: "réponse illisible",
  vide: "réponse vide",
  autre: "autre",
};

// Type d'échec d'une erreur levée par core/api.js ou core/stream.js.
export function typeEchec(err) {
  if (!err) return "autre";
  if (err.tronque) return "tronque";
  if (err.coupure) return "coupure";
  if (err.reseau || (err.name === "TypeError" && /fetch|network|réseau/i.test(String(err.message)))) return "reseau";
  const msg = String(err.message || "");
  if (Number.isFinite(err.status) || /^Erreur (API|du serveur) \(\d{3}\)|^Erreur \d{3}|^Limite de requêtes|^Clé API/.test(msg)) return "serveur";
  if (/JSON/.test(msg) || err instanceof SyntaxError) return "json";
  if (/vide|épuisé ses tokens/.test(msg)) return "vide";
  return "autre";
}

// Mesure d'un appel en échec : même forme qu'une mesure, plus `echec` (type). Le premier
// jeton reste celui observé (un flux coupé a pu commencer) ; `total` est la durée jusqu'à
// l'échec.
export function mesureEchec(nature, chrono, err, opts = {}) {
  return { ...mesure(nature, chrono, opts), echec: typeEchec(err) };
}

const auDixieme = (ms) => Math.round(ms / 100) * 100;

// Raison de lenteur ("premierJeton" | "total") ou null. Mesure invalide → null.
export function lenteur(m) {
  const s = m && SEUILS[m.nature];
  if (!s || m.echec) return null; // un échec n'est pas « lent » : il est compté à part
  // Comparaison au dixième de seconde affiché (enSecondes) : 59,95 s s'affichait « 60 s »
  // sans alerte au seuil de 60 s (#107).
  if (s.premierJeton !== null && m.stream && nombre(m.premierJeton) && auDixieme(m.premierJeton) >= s.premierJeton) return "premierJeton";
  if (nombre(m.total) && auDixieme(m.total) >= s.total) return "total";
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

// Médiane vraie : moyenne des deux valeurs centrales sur un nombre pair. Le rang le plus
// proche prenait la valeur basse et minimisait la lenteur affichée (#107).
export function mediane(valeurs) {
  const v = (Array.isArray(valeurs) ? valeurs : []).filter(nombre).sort((a, b) => a - b);
  if (!v.length) return null;
  const k = v.length >> 1;
  return v.length % 2 ? v[k] : (v[k - 1] + v[k]) / 2;
}

// Statistiques d'une nature d'appel : { n (appels réussis), premierJeton (médiane), total
// (médiane), totalP90, lents, appels (réussis + échecs), echecs, tauxEchec (0..1),
// echecsParType } — null si aucune mesure. Les temps ne portent que sur les succès : une
// coupure à 2 s ferait passer un serveur en panne pour rapide.
export function statsLatence(journal, nature) {
  const tous = (Array.isArray(journal) ? journal : []).filter(m => m && m.nature === nature);
  if (!tous.length) return null;
  const ms = tous.filter(m => !m.echec);
  const echecs = tous.filter(m => m.echec);
  const echecsParType = {};
  for (const e of echecs) echecsParType[e.echec] = (echecsParType[e.echec] || 0) + 1;
  return {
    appels: tous.length,
    echecs: echecs.length,
    tauxEchec: echecs.length / tous.length,
    echecsParType,
    n: ms.length,
    // Premier mot : seulement les appels streamés — sans streaming il vaut le total (L1).
    premierJeton: mediane(ms.filter(m => m.stream).map(m => m.premierJeton)),
    total: mediane(ms.map(m => m.total)),
    totalP90: centile(ms.map(m => m.total), 90),
    replique: mediane(ms.map(m => m.replique)), // null si aucune mesure ne la porte
    lents: ms.filter(m => lenteur(m)).length,
    relances: ms.filter(m => m.relance).length, // tours réécrits par le contrôle d'écriture
  };
}

// Ligne de journal console, une par appel.
export function ligneConsole(m) {
  if (m.echec) return `[latence] ${m.nature}${m.stream ? " (stream)" : ""} ÉCHEC ${m.echec} après ${m.total} ms${m.modele ? `, ${m.modele}` : ""}`;
  const rep = nombre(m.replique) ? `, réplique ${m.replique} ms` : "";
  return `[latence] ${m.nature}${m.stream ? " (stream)" : ""}${m.relance ? " (relancé)" : ""} premier jeton ${m.premierJeton} ms${rep}, total ${m.total} ms${m.modele ? `, ${m.modele}` : ""}`;
}

// Ligne « échecs » pour l'écran Progrès : chaîne vide sans échec. Pourcentage arrondi à
// l'entier, types les plus fréquents d'abord.
export function resumeEchecs(st) {
  if (!st || !st.echecs) return "";
  const pct = Math.round(st.tauxEchec * 100);
  const types = Object.entries(st.echecsParType).sort((a, b) => b[1] - a[1])
    .map(([t, k]) => `${k} ${TYPES_ECHEC[t] || t}`).join(", ");
  return `${st.echecs} échec${st.echecs > 1 ? "s" : ""} sur ${st.appels} (${pct} %) : ${types}`;
}
