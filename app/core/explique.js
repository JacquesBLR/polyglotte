// « Explique-moi » (#97) — fonctions pures.
//
// Une correction du tuteur tient en une ligne (« accord du verbe ») : l'élève qui ne
// comprend pas pourquoi n'a aucun recours. Sur le modèle d'« Explain my answer » de
// Duolingo Max, un bouton demande une explication courte, au niveau CECRL de l'élève,
// avec un exemple et un contre-exemple. Elle est consignée dans l'entrée du carnet
// d'erreurs (#87), où la révision et l'écran Progrès la réaffichent, et n'est pas
// redemandée tant que le niveau ne change pas.

import { ajouteErreur, cleErreur } from "./erreurs.js";
import { grammarSystemPrompt } from "./prompts.js";

// Niveaux de l'app → bandes CECRL, telles que LEVEL_INSTRUCTIONS les annonce.
export const CECRL_PAR_NIVEAU = { debutant: "A1–A2", intermediaire: "B1–B2", avance: "C1" };

// Bornes de longueur : un modèle bavard ne doit pas transformer la bulle en fiche.
const MAX = { title: 80, content: 600, exemple: 240, contre_exemple: 240 };

// Même clé que le dédoublonnage du carnet, sans quoi une explication ne retrouverait pas
// son entrée quand la ponctuation diffère.
const cle = cleErreur;

const tronque = (s, n) => {
  const t = String(s).trim().replace(/\s+\n/g, "\n");
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
};

// Requête au modèle : { system, messages }, à passer à callModel avec EXPLAIN_SCHEMA.
// Le système reprend celui des fiches de grammaire (même professeur, même niveau) ; la
// demande porte sur une seule correction.
export function expliqueRequete({ cfg, level, correction }) {
  const cecrl = CECRL_PAR_NIVEAU[level] || CECRL_PAR_NIVEAU.debutant;
  const system = grammarSystemPrompt({ cfg, level: CECRL_PAR_NIVEAU[level] ? level : "debutant" });
  const lignes = [
    `L'élève (niveau ${cecrl}) a dit : « ${String(correction?.original || "").trim()} »`,
    `La forme correcte est : « ${String(correction?.corrected || "").trim()} »`,
  ];
  if (correction?.explanation) lignes.push(`Correction donnée : ${String(correction.explanation).trim()}`);
  const content = `${lignes.join("\n")}

Explique-moi cette correction, à mon niveau (${cecrl}) :
- "title" : la règle en quelques mots ;
- "content" : pourquoi, en 3 phrases au plus, EN FRANÇAIS, sans jargon au-delà de mon niveau ;
- "exemple" : une autre phrase correcte en ${cfg.langFr} qui applique la règle, avec sa traduction entre parenthèses ;
- "contre_exemple" : la forme fautive (ou une voisine), et en une phrase pourquoi elle ne convient pas.`;
  return { system, messages: [{ role: "user", content }] };
}

// Valide la réponse du modèle (chaîne JSON ou objet). Retourne l'explication nettoyée,
// ou null si elle est inexploitable — l'appelant affiche alors une erreur et la correction
// reste intacte. Un contre-exemple absent n'invalide pas l'explication ; un contenu absent,
// si.
export function expliqueValide(raw) {
  let data = raw;
  if (typeof raw === "string") {
    try { data = JSON.parse(raw); } catch (_) { return null; }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const champ = (k) => (typeof data[k] === "string" && data[k].trim() ? tronque(data[k], MAX[k]) : "");
  const content = champ("content");
  if (!content) return null;
  return {
    title: champ("title"),
    content,
    exemple: champ("exemple"),
    contre_exemple: champ("contre_exemple"),
  };
}

const memeErreur = (e, lang, correction) =>
  e && e.lang === lang && cle(e.corrected) === cle(correction?.corrected);

// Phrase fautive dont l'explication a été donnée. Le carnet dédoublonne par forme corrigée
// (#88) : « Jo vol un cafè » (conjugaison) et « Jo vull una cafè » (genre) partagent une
// entrée, mais pas une explication (relecture du 12/10, X1). Une explication consignée
// avant ce champ vaut pour l'original de l'entrée.
const originalExplique = (e) => e.explique.original ?? cle(e.original);

// Explication déjà consignée pour cette correction et ce niveau, ou null.
export function explicationConsignee(carnet, lang, correction, level) {
  const e = (carnet || []).find(x => memeErreur(x, lang, correction));
  return e?.explique && e.explique.level === level && originalExplique(e) === cle(correction?.original)
    ? e.explique
    : null;
}

// Consigne l'explication dans l'entrée du carnet de cette correction ; l'ajoute d'abord si
// elle n'y est pas (correction supprimée du carnet entre-temps). Retourne un nouveau
// tableau, ou `carnet` lui-même si rien n'a changé — même contrat d'identité qu'ajouteErreur.
export function consigneExplication(carnet, lang, correction, explication, level, now = Date.now()) {
  if (!explication || !explication.content) return carnet;
  const base = (carnet || []).some(e => memeErreur(e, lang, correction))
    ? carnet
    : ajouteErreur(carnet || [], lang, correction, now);
  if (!base.some(e => memeErreur(e, lang, correction))) return carnet; // correction inexploitable
  return base.map(e => (memeErreur(e, lang, correction)
    ? { ...e, explique: { ...explication, level, at: now, original: cle(correction.original) } }
    : e));
}
