// Texte à trous ciblé (#115) — fonctions pures.
//
// Dictée, prononciation et conversation travaillent l'oreille et la bouche ; aucun exercice
// ne faisait PRODUIRE une forme grammaticale précise, le pont entre la fiche (je comprends
// la règle) et la conversation (je l'emploie). Babbel (phrases à compléter dans chaque
// leçon, indice, correction immédiate), Duolingo (« Complète la phrase », tolérance des
// accents avec « Attention à l'accent ») et Busuu (Fill the gap) le font. Cinq phrases, un
// trou chacune, un point de grammaire facultatif ; correction locale, sans appel au modèle.

import { ecritureConforme } from "./ecriture.js";

export const TROU = "___";
export const NB_PHRASES = 5;

const READING = {
  anyOf: [{ type: "null" }, { type: "string", description: "Translittération latine de la phrase COMPLÈTE." }],
};

export function schemaTrous({ lecture = true } = {}) {
  const item = {
    phrase: { type: "string", description: `Phrase en langue cible avec UN SEUL trou noté ${TROU} à la place de la forme visée.` },
    reponse: { type: "string", description: "La forme exacte qui remplit le trou (un mot ou un groupe très court)." },
    indice: { type: "string", description: "Indice en français : ce qu'il faut mettre (ex. « être, 1re pers. du sing. »), sans donner la réponse." },
    traduction: { type: "string", description: "Traduction française de la phrase complète." },
    ...(lecture ? { reading: READING } : {}),
  };
  return {
    type: "object",
    properties: {
      phrases: {
        type: "array",
        description: `Exactement ${NB_PHRASES} phrases à trous, variées, adaptées au niveau.`,
        items: { type: "object", properties: item, required: Object.keys(item), additionalProperties: false },
      },
    },
    required: ["phrases"],
    additionalProperties: false,
  };
}

export function demandeTrous({ cfg, point }) {
  const cible = typeof point === "string" && point.trim()
    ? `Point visé : « ${point.trim()} ». Dans CHAQUE phrase, le trou est une forme qui relève de ce point (jamais un autre mot de la phrase).`
    : "Varie les points de grammaire importants du niveau (conjugaison, accords, prépositions…).";
  return `Prépare un exercice de texte à trous en ${cfg.langFr} : ${NB_PHRASES} phrases de la vie quotidienne à ${cfg.tutor.city},
chacune avec UN SEUL trou noté ${TROU} à la place d'une forme grammaticale (pas d'un nom propre ni d'un mot de vocabulaire
imprévisible). ${cible} Choisis un contexte où la réponse est la seule possible ; si une autre forme reste correcte
(ex. « es » et « está » avec « hoy »), donne-les toutes dans "reponse", séparées par « / ». L'indice en français dit ce
qu'il faut mettre sans donner la réponse.`;
}

const chaine = (v) => (typeof v === "string" ? v.trim() : "");
const occurrences = (t, motif) => t.split(motif).length - 1;

// L'indice contient-il la réponse ? (il la donnerait). Mot entier en écriture à espaces,
// sous-chaîne sinon (japonais, arabe sans espaces entre particule et mot). Les chiffres
// comptent dans le mot : « 2e personne » ne contient pas la réponse « é » (relecture de la
// nuit du 13/10 : l'indice était retiré pour tout « é » portugais).
function indiceDonneReponse(indice, reponse) {
  const i = normalise(indice, { sansAccents: true });
  return reponse.split("/").map(v => normalise(v, { sansAccents: true })).filter(Boolean).some(v => {
    if (/[a-z]/.test(v)) return new RegExp(`(^|[^\\p{L}\\p{N}])${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "u").test(i);
    return i.includes(v);
  });
}

// Indice plus long qu'une ligne : le modèle y a déversé sa délibération (sondé le 12/10 :
// « estuvo… Attendons… Je vais mettre estuvo / estaba »). La phrase est alors douteuse.
export const INDICE_MAX = 160;

// Phrases exploitables : un seul trou ; réponse non vide qui ne se trouve pas déjà collée au
// trou (« 猫___がかわいい » → が : la phrase complète aurait « がが ») ; délibération dans
// l'indice → phrase écartée ; indice qui donne la réponse → indice retiré. null si aucune.
//
// Options (relecture du soir, #115) : `charBased` — écriture sans espaces (japonais) : le
// test « collée au trou » n'a de sens qu'ici ; ailleurs il exige une limite de mot, sinon
// « This ___ my house » / is était écarté. `ecriture` — écriture attendue de la phrase :
// une phrase en rōmaji pour le japonais (observé via gw) est écartée.
export function trousValides(data, { charBased = false, ecriture = null } = {}) {
  const brut = data && Array.isArray(data.phrases) ? data.phrases : [];
  const ok = [];
  for (const p of brut) {
    if (!p || typeof p !== "object") continue;
    // Trou noté « __ » ou en soulignés pleine chasse : ramené à TROU (relecture de la nuit du
    // 13/10 : un exercice entier noté « __ » était écarté, l'élève lisait « réessaie »).
    const phrase = chaine(p.phrase).replace(/[_＿]{2,}/g, TROU);
    const reponse = chaine(p.reponse);
    if (!reponse || occurrences(phrase, TROU) !== 1) continue;
    const [avant, apres] = phrase.split(TROU).map(t => t.trim());
    const premiere = reponse.split("/")[0].trim();
    if (charBased) {
      if (avant.endsWith(premiere) || apres.startsWith(premiere)) continue;
    } else {
      // Voisin immédiat seulement : une ponctuation entre le trou et le mot les sépare
      // (« wohnen ___, würde ich » / würde est correct). Comparaison sans voyellation arabe,
      // facultative à l'écrit : elle masquait « طالِب طالب » (relecture de la nuit du 13/10).
      // Les accents latins, eux, distinguent des mots : « ¿Dónde está esta calle? » est juste.
      const sans = (t) => normalise(t).replace(/[\u064b-\u065f\u0670\u0640]/g, "");
      const mot = sans(premiere);
      const avN = /[\p{L}\p{M}\p{N}]$/u.test(avant) ? sans(avant).split(" ").at(-1) : null;
      const ap0 = /^[\p{L}\p{M}\p{N}]/u.test(apres) ? sans(apres).split(" ")[0] : null;
      if (!mot.includes(" ") && (avN === mot || ap0 === mot)) continue; // « es es »
    }
    if (ecriture && !ecritureConforme(phrase.replace(TROU, premiere), ecriture)) continue;
    let indice = chaine(p.indice);
    if (indice.length > INDICE_MAX) continue;
    if (indice && indiceDonneReponse(indice, reponse)) indice = "";
    ok.push({
      phrase,
      reponse,
      indice,
      traduction: chaine(p.traduction),
      reading: chaine(p.reading) || null,
    });
  }
  return ok.length ? ok.slice(0, NB_PHRASES) : null;
}

// Normalisation de comparaison : casse, espaces, apostrophes typographiques, ponctuation de
// bord. `sansAccents` retire en plus les diacritiques (é → e, ç → c, ß reste ; harakat arabes).
export function normalise(t, { sansAccents = false, sansEspaces = false } = {}) {
  let s = String(t ?? "").toLowerCase().normalize("NFC").replace(/[’ʼ`]/g, "'").trim();
  s = s.replace(/^[\s.,;:!?¡¿"«»()。、！？「」『』،؛؟]+|[\s.,;:!?¡¿"«»()。、！？「」『』،؛؟]+$/g, "").replace(/\s+/g, " ");
  // Diacritiques latins, et voyellation arabe (harakat, tatweel) : l'élève écrit souvent
  // sans tachkil, comme on écrit l'arabe au quotidien. Les dakuten japonais (か/が) ne sont
  // pas touchés : ils changent le mot.
  if (sansAccents) s = s.normalize("NFD").replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, "").normalize("NFC");
  if (sansEspaces) s = s.replace(/\s+/g, "");
  return s;
}

// Correction : "juste", "accent" (juste aux diacritiques près — compté juste, avec un
// avertissement), "faux". `charBased` : écriture sans espaces (japonais), comparée sans
// espaces. Plusieurs réponses acceptées si le modèle les sépare par « / ».
export function corrigeTrou(attendu, saisi, { charBased = false } = {}) {
  const opts = { sansEspaces: charBased };
  const s = normalise(saisi, opts);
  if (!s) return "faux";
  const variantes = String(attendu ?? "").split("/").map(v => v.trim()).filter(Boolean);
  if (variantes.some(v => normalise(v, opts) === s)) return "juste";
  const sa = normalise(saisi, { ...opts, sansAccents: true });
  if (variantes.some(v => normalise(v, { ...opts, sansAccents: true }) === sa)) return "accent";
  return "faux";
}

// Fonction de remplacement : une réponse contenant « $& » ou « $' » n'est pas interprétée.
export const phraseComplete = (p) => p.phrase.replace(TROU, () => p.reponse.split("/")[0].trim());

// Score : les « accent » comptent juste.
export function scoreTrous(resultats) {
  const r = Array.isArray(resultats) ? resultats : [];
  const justes = r.filter(x => x === "juste" || x === "accent").length;
  return { justes, total: r.length };
}
