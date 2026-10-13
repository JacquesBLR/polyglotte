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
  const p = typeof point === "string" ? point.trim() : "";
  const japonais = cfg.ecriture === "japonais";
  const cible = p
    ? `Point visé : « ${p} ». Dans CHAQUE phrase, le trou est une forme qui relève de ce point (jamais un autre mot de la phrase).`
    : "Varie les points de grammaire importants du niveau (conjugaison, accords, prépositions…).";
  return `Prépare un exercice de texte à trous en ${cfg.langFr} : ${NB_PHRASES} phrases de la vie quotidienne à ${cfg.tutor.city},
chacune avec UN SEUL trou noté ${TROU} à la place d'une forme grammaticale (pas d'un nom propre ni d'un mot de vocabulaire
imprévisible). ${cible} Choisis un contexte où la réponse est la seule possible ; si une autre forme reste correcte
(ex. « es » et « está » avec « hoy »), donne-les toutes dans "reponse", séparées par « / ». L'indice en français dit ce
qu'il faut mettre sans donner la réponse.${japonais ? consigneJaponais(p) : ""}`;
}

// Japonais (#125) : sur 12 séries réelles via gw (13/10), le trou coupait souvent une forme
// verbale (« 読ん___て » pour 読んで, « 聞きました » suivi de « しました ») et la série « forme
// en て » ne trouait presque jamais une forme en て. La consigne exige un mot entier ;
// trousValides écarte ce qui reste coupé.
export const POINT_TE = /て|(^|[^a-z])te([^a-z]|$)/i;

export const EXEMPLE_TE = { phrase: `駅まで${TROU}、電車に乗りました。`, reponse: "歩いて", indice: "歩く, enchaîner" };

function consigneJaponais(point) {
  const te = POINT_TE.test(point)
    ? `
Forme en て : CHAQUE réponse est un verbe à la forme en て (食べて, 行って, 読んで, して, 来て), éventuellement suivie de
son auxiliaire (食べている, 待ってください), sans son complément, qui reste dans la phrase. Le て fait partie de la réponse,
jamais du texte après le trou. L'indice donne le verbe au dictionnaire (« 食べる ») et l'emploi (enchaîner, demander,
action en cours). Exemple, à ne pas reprendre : phrase « ${EXEMPLE_TE.phrase} », réponse « ${EXEMPLE_TE.reponse} », indice
« ${EXEMPLE_TE.indice} ».`
    : "";
  return `
En japonais : écris les phrases sans espaces entre les mots, le trou toujours noté ${TROU}. Le trou remplace un mot ENTIER — une particule, ou une forme verbale ou
adjectivale complète, terminaison comprise — jamais un morceau de mot : le texte qui suit le trou ne commence jamais par
une terminaison (ます, ました, た, て, で, ない, ている…), et la phrase complétée doit être du japonais correct.${te}`;
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

// ---------- Japonais : formes coupées par le trou (#125) ----------
//
// Sur 12 séries réelles via gw (13/10), 5 étaient illisibles : la phrase complétée n'était pas
// du japonais (« 読ん___て » → 読んて, « 食べて___ています » → 食べてています, « 聞きました___しました »,
// « 行___行きます »), et 2 trouaient du vocabulaire (本, 学生, 公園) contre la consigne.
// Règles, sur la réponse et le texte qui suit le trou :
// - espaces entre caractères japonais (« kana espacés », relecture de la nuit du 13/10) ;
// - même caractère de part et d'autre de la frontière (行 + 行きます, て + ていい) ;
// - terminaison après le trou qui demande un radical (ます, たい, ながら) alors que la réponse est
//   déjà conjuguée (会って + ましたか, 待ちました + ました) ;
// - て/で/た/だ après le trou alors que la réponse finit déjà par l'un d'eux, ou euphonie fausse
//   (ん + て : 読んて ; っ + で) ;
// - する conjugué après le trou alors que la réponse est un verbe conjugué ou un radical
//   (見る + している, 書い + した, 聞こえ + されている) ;
// - particule ajoutée après は, が, を ou も (私は + に → 私はに) ;
// - forme en て devant を, が, に (待って + を待った) ; radical en e devant の, こと (話せ + のが) ;
//   forme polie devant le nom qu'elle détermine (話します + 予定) ; deux を pour un même verbe ;
// - fin de la réponse répétée après le trou (お出しください + ください) ;
// - réponse sans hiragana : un nom (本, パン, 東京), du vocabulaire et non de la grammaire.
const JA = "\u3041-\u30ff\u3400-\u4dbf\u4e00-\u9fff\u3005\u30fc";
const ESPACE_JA = new RegExp(`[${JA}][\\s\\u3000]+[${JA}]`);
const HIRAGANA = /[\u3041-\u3096]/;
const APRES_RADICAL = /^(?:ま[すしせ]|たい|ながら)/;
// て, た, だ, ou で hors copule (です, でした, でしょう : « あなたですか » est juste).
const APRES_TE = /^(?:[てただ]|で(?![すし]))/;
const APRES_SURU = /^(?:し[てたまな]|する|さ[れせ])/;
const CONJUGUEE = /(?:ます|ました|ません|[てでただ]|[うくすつぬふむゆるぐぶ]|ない|ん|っ)$/;
// Avant する conjugué (して, した, します, される, させる) : un nom, jamais un verbe conjugué,
// un radical (食べ, 聞こえ, 書い, 行っ) ni un adjectif en い (« 書いした », « 聞こえされている »).
const VERBE_CONJUGUE = /(?:ます|ました|ません|ない|[てでただるいっえけせねへめれげべぺ])$/;
// Particule après は, が, を ou も : « 私は___東京に » / に donnerait « 私はに » (série réelle
// « les particules », 5 phrases sur 5). Les cumuls justes (には, では, にも) ont la particule
// de cas d'abord : ils ne sont pas visés.
const PARTICULE = /^(?:は|が|を|に|で|へ|と|も|の|から|まで|より)$/;
// Forme en て attendue quand le point la vise : 食べて, 読んで, 待ってください, 食べている.
// で ne suit que ん ou い (読んで, 泳いで) : « まで », « ので » ne sont pas des formes en て.
const FORME_TE = /(?:[んい]で|.て)(?:い(?:る|ます|た|ました|ない|ません)|ください|から|も)?$/u;

// Formes en て possibles d'un verbe au dictionnaire (起きる → 起きて ; 待つ → 待って ; 読む →
// 読んで). Un verbe en る précédé d'un kanji ou d'un kana en i/e peut être des deux groupes
// (見る → 見て, 帰る → 帰って) : les deux formes sont admises. [] si ce n'est pas un verbe.
// Radical en i d'un verbe du premier groupe → forme en て (待ち → 待って, 読み → 読んで).
const TE_DU_RADICAL = { い: "って", ち: "って", り: "って", み: "んで", び: "んで", に: "んで", き: "いて", ぎ: "いで", し: "して" };

export function formesTe(dico) {
  const v = String(dico ?? "").trim();
  if (!v) return [];
  // Forme polie (買います, 待ちます, 食べます, 見ます) : le radical décide.
  if (v.endsWith("ます")) {
    const rad = v.slice(0, -2);
    if (!rad) return [];
    if (rad.endsWith("し")) return [rad + "て"];
    if (/(?:行き|いき)$/.test(rad)) return [rad.slice(0, -1) + "って"];
    const godan = TE_DU_RADICAL[rad.at(-1)];
    return godan ? [rad + "て", rad.slice(0, -1) + godan] : [rad + "て"];
  }
  if (v.endsWith("する")) return [v.slice(0, -2) + "して"];
  if (/^(?:来る|くる)$/.test(v)) return [v === "来る" ? "来て" : "きて"];
  if (/(?:行く|いく)$/.test(v)) return [v.slice(0, -1) + "って"];
  const base = v.slice(0, -1);
  const fin = v.at(-1);
  if (fin === "る") {
    const avant = base.at(-1) || "";
    if (/[\u3041-\u3096]/.test(avant) && !/[いきぎしじちぢにひびぴみりえけげせぜてでねへべぺめれ]/.test(avant)) return [base + "って"];
    return [base + "て", base + "って"];
  }
  if ("うつ".includes(fin)) return [base + "って"];
  if ("むぶぬ".includes(fin)) return [base + "んで"];
  if (fin === "く") return [base + "いて"];
  if (fin === "ぐ") return [base + "いで"];
  if (fin === "す") return [base + "して"];
  return [];
}

// Verbes au dictionnaire cités dans l'indice (« verbe 起きる, enchaîner », « manger (食べる) »).
const VERBE_DICO = /[\u3400-\u9fff\u3005]+[\u3041-\u3096]*[うくすつぬふむゆるぐぶ](?![\u3041-\u30ff\u3400-\u9fff])/g;

// Forme en て fausse au regard du verbe de l'indice (« 起いて » pour 起きる). Sans verbe
// reconnaissable dans l'indice, pas de verdict.
export function formeTeFausse(reponse, indice) {
  const verbes = String(indice ?? "").match(VERBE_DICO) || [];
  const formes = verbes.flatMap(formesTe);
  if (!formes.length) return false;
  const r = reponse.split("/")[0].trim();
  return !formes.some(f => r.includes(f));
}

// Deux réparations, avant tout contrôle (13/10 : le modèle laisse le て hors du trou et met
// le complément dans la réponse — « 少しだけ___てください » / 待っ, « 公園で___て » / お花を見) :
// - un て ou で qui suit le trou y entre, si l'euphonie le permet (待っ + て → 待って) ;
// - le complément qui précède le verbe (« お花を », « コーヒーを ») passe avant le trou : sans
//   cela, l'élève qui écrit 見て serait compté faux.
// Rend { phrase, reponse } ; la réponse à variantes « / » n'est pas touchée.
export function repareJaponais(phrase, reponse) {
  if (reponse.includes("/") || occurrences(phrase, TROU) !== 1) return { phrase, reponse };
  let [avant, apres] = phrase.split(TROU);
  let r = reponse.trim();
  const a = apres.trimStart();
  const c = a[0];
  if (/^(?:て|で(?![すし]))/.test(a) && !/[てで]$/.test(r) && HIRAGANA_OU_KANJI.test(r.at(-1) || "")) {
    const fin = r.at(-1);
    // ん + で (読んで), っ + て (待って), い + て/で (書いて, 泳いで), radical en i/e ou kanji + て
    // (食べて, 起きて, 見て) ; jamais après un kana en a, u, o (« 使わて » n'existe pas).
    const euphonie = fin === "ん" ? c === "で" : fin === "っ" ? c === "て" : fin === "い" ? true
      : RADICAL_I_E.test(fin) || /[\u3400-\u9fff\u3005]/.test(fin) ? c === "て" : false;
    if (euphonie) { r += c; apres = a.slice(1); }
  }
  const m = r.match(/^(.*?(?:を|.[にでがはとへ]))(?=[\u3400-\u9fff])(.+)$/u);
  if (m && /[\u3041-\u3096]/.test(m[2]) && !/^(?:を|.[にでがはとへ])$/.test(m[2])) { avant += m[1]; r = m[2]; }
  return { phrase: `${avant}${TROU}${apres}`, reponse: r };
}
const HIRAGANA_OU_KANJI = /[\u3041-\u3096\u3400-\u9fff\u3005]/;
const RADICAL_I_E = /[きぎしじちぢにひびぴみりえけげせぜてでねへべぺめれ]/;

export function defautJaponais(phrase, reponse) {
  const [avant = "", apres = ""] = phrase.split(TROU);
  const r = reponse.split("/")[0].trim();
  if (ESPACE_JA.test(`${avant.trim()}${r}${apres.trim()}`)) return "espaces";
  const a = apres.trim();
  if (!HIRAGANA.test(r)) return "vocabulaire";
  if (a && r.at(-1) === a[0]) return "doublon";
  // Fin de la réponse répétée après le trou : « お出しください » + « ください ».
  for (let k = 2; k <= r.length; k++) if (a.startsWith(r.slice(-k))) return "doublon";
  if (PARTICULE.test(r) && /[はがをも]$/.test(avant.trim())) return "particules";
  if (APRES_RADICAL.test(a) && CONJUGUEE.test(r)) return "coupee";
  if (APRES_TE.test(a) && (/[てでただ]$/.test(r) || (r.endsWith("ん") && /^[てた]/.test(a)) || (r.endsWith("っ") && /^[でだ]/.test(a)))) return "coupee";
  // て après un kana en a, u ou o : aucune forme verbale (« 使わ » + « て »).
  if (/^て/.test(a) && /[あかさたなはまやらわがざだばぱうくすつぬふむゆるぐずづぶぷおこそとのほもよろをごぞどぼぽ]$/.test(r)) return "coupee";
  if (APRES_SURU.test(a) && VERBE_CONJUGUE.test(r)) return "coupee";
  // Forme en て suivie d'une particule de cas : « 電車を待って » + « を待った ».
  if (/[てで]$/.test(r) && /^[をがに]/.test(a)) return "coupee";
  // Radical en e devant の ou こと, qui demandent la forme du dictionnaire : « 話せ » + « のが ».
  if (/[えけげせぜてでねへべぺめれ]$/.test(r) && /^(?:の|こと)/.test(a)) return "coupee";
  // Forme polie devant un nom qu'elle détermine : « 話します » + « 予定です » (話す予定).
  if (/ま(?:す|した|せん)$/.test(r) && /^(?:予定|つもり|こと|ため|時|とき|前|後|ところ|人|の(?![でにか]))/.test(a)) return "coupee";
  // Deux を pour un même verbe : « 毎日___ご飯を食べます » / を. On ne regarde que jusqu'au
  // premier verbe après le trou : « 本___読んでからテレビを見ます » a deux verbes, deux を.
  if (r === "を") {
    const i = a.search(/[てでた]|ます|る|[、。，．！？]/);
    if ((i < 0 ? a : a.slice(0, i)).includes("を")) return "particules";
  }
  return null;
}

// Série japonaise illisible : moins de trois phrases exploitables une fois écartées les
// phrases coupées, espacées, lexicales ou hors du point visé. Elle est écartée en entier.
export const JA_PHRASES_MIN = 3;

// Phrases exploitables : un seul trou ; réponse non vide qui ne se trouve pas déjà collée au
// trou (« 猫___がかわいい » → が : la phrase complète aurait « がが ») ; délibération dans
// l'indice → phrase écartée ; indice qui donne la réponse → indice retiré. null si aucune.
//
// Options (relecture du soir, #115) : `charBased` — écriture sans espaces (japonais) : le
// test « collée au trou » n'a de sens qu'ici ; ailleurs il exige une limite de mot, sinon
// « This ___ my house » / is était écarté. `ecriture` — écriture attendue de la phrase :
// une phrase en rōmaji pour le japonais (observé via gw) est écartée. `point` — point visé :
// en japonais, « la forme en て » exige une forme en て (#125).
export function trousValides(data, opts = {}) {
  return bilanTrous(data, opts).phrases;
}

// Trou oublié par le modèle (phrase complète : 3 séries sur 24 en japonais, et une série
// allemande dans l'essai de bout en bout, 13/10) : si la réponse y figure une seule fois —
// mot entier, sans tenir compte de la majuscule, hors japonais —, elle devient le trou.
function troueReponse(phrase, reponse, charBased) {
  const r = reponse.split("/")[0].trim();
  if (!r) return phrase;
  const motif = new RegExp(charBased
    ? r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    : `(?<![\\p{L}\\p{M}\\p{N}])${r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{M}\\p{N}])`, charBased ? "gu" : "giu");
  const n = (phrase.match(motif) || []).length;
  return n === 1 ? phrase.replace(motif, () => TROU) : phrase;
}

// Même tri, avec le motif de chaque phrase écartée : { phrases (null si la série n'est pas
// exploitable), ecartees: [{ phrase, reponse, motif }], illisible }.
export function bilanTrous(data, { charBased = false, ecriture = null, point = "" } = {}) {
  const brut = data && Array.isArray(data.phrases) ? data.phrases : [];
  const japonais = ecriture === "japonais";
  const viseTe = japonais && typeof point === "string" && POINT_TE.test(point);
  const ok = [];
  const ecartees = [];
  const ecarte = (phrase, reponse, motif) => ecartees.push({ phrase, reponse, motif });
  for (const p of brut) {
    if (!p || typeof p !== "object") continue;
    // Trou noté « __ » ou en soulignés pleine chasse : ramené à TROU (relecture de la nuit du
    // 13/10 : un exercice entier noté « __ » était écarté, l'élève lisait « réessaie »).
    let phrase = chaine(p.phrase).replace(/[_＿]{2,}/g, TROU);
    const reponseBrute = chaine(p.reponse);
    if (reponseBrute && !phrase.includes(TROU)) phrase = troueReponse(phrase, reponseBrute, charBased);
    if (!reponseBrute || occurrences(phrase, TROU) !== 1) { ecarte(phrase, reponseBrute, "trou"); continue; }
    // Écriture sans espaces : les blancs autour du trou ne sont que de la mise en page.
    if (charBased) phrase = phrase.replace(/[\s\u3000]*___[\s\u3000]*/, TROU);
    let reponse = reponseBrute;
    if (japonais) ({ phrase, reponse } = repareJaponais(phrase, reponse));
    const [avant, apres] = phrase.split(TROU).map(t => t.trim());
    const premiere = reponse.split("/")[0].trim();
    if (charBased) {
      if (avant.endsWith(premiere) || apres.startsWith(premiere)) { ecarte(phrase, reponse, "doublon"); continue; }
    } else {
      // Voisin immédiat seulement : une ponctuation entre le trou et le mot les sépare
      // (« wohnen ___, würde ich » / würde est correct). Comparaison sans voyellation arabe,
      // facultative à l'écrit : elle masquait « طالِب طالب » (relecture de la nuit du 13/10).
      // Les accents latins, eux, distinguent des mots : « ¿Dónde está esta calle? » est juste.
      const sans = (t) => normalise(t).replace(/[\u064b-\u065f\u0670\u0640]/g, "");
      const mot = sans(premiere);
      const avN = /[\p{L}\p{M}\p{N}]$/u.test(avant) ? sans(avant).split(" ").at(-1) : null;
      const ap0 = /^[\p{L}\p{M}\p{N}]/u.test(apres) ? sans(apres).split(" ")[0] : null;
      if (!mot.includes(" ") && (avN === mot || ap0 === mot)) { ecarte(phrase, reponse, "doublon"); continue; } // « es es »
    }
    if (ecriture && !ecritureConforme(phrase.replace(TROU, premiere), ecriture)) { ecarte(phrase, reponse, "ecriture"); continue; }
    if (japonais) {
      const d = defautJaponais(phrase, reponse);
      if (d) { ecarte(phrase, reponse, d); continue; }
      if (viseTe && (!FORME_TE.test(premiere) || formeTeFausse(premiere, p.indice))) { ecarte(phrase, reponse, "hors-point"); continue; }
      // L'exemple de la consigne, recopié tel quel (3 séries sur 8, 13/10) : écarté.
      if (phrase.replace(/\s/g, "") === EXEMPLE_TE.phrase) { ecarte(phrase, reponse, "exemple"); continue; }
    }
    let indice = chaine(p.indice);
    if (indice.length > INDICE_MAX) { ecarte(phrase, reponse, "indice"); continue; }
    if (indice && indiceDonneReponse(indice, reponse)) indice = "";
    ok.push({
      phrase,
      reponse,
      indice,
      traduction: chaine(p.traduction),
      reading: chaine(p.reading) || null,
    });
  }
  if (japonais && ok.length < JA_PHRASES_MIN) return { phrases: null, ecartees, illisible: true };
  return { phrases: ok.length ? ok.slice(0, NB_PHRASES) : null, ecartees, illisible: false };
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

// ---------- Diacritiques porteurs de sens (#125) ----------
//
// Depuis #115, une réponse juste « aux accents près » compte juste, avec un avertissement,
// comme le « Attention à l'accent » de Duolingo. La relecture de la nuit du 13/10 en a montré
// l'envers : « hatte » comptait juste pour « hätte » — tout le Konjunktiv II allemand, dont
// l'umlaut EST la forme visée —, comme « esta » pour « está », « tem » pour « têm », « ano »
// pour « año » : d'autres mots, d'autres temps. Décision par défaut du 13/10 (réversible) :
// un diacritique qui porte le sens n'est plus toléré. La liste, par langue :
// - `lettres` : lettres à part entière, jamais remplaçables par leur lettre de base
//   (ä, ö, ü ; ñ ; ã, õ ; ç, que le clavier français a) ;
// - `mots` : mots que leur accent distingue d'un autre mot (accent diacritique : está/esta,
//   tú/tu, qué/que ; é/e, têm/tem, pôde/pode ; és/es, més/mes, té/te — liste du catalan de
//   2016) ;
// - `finales` : terminaisons accentuées qui changent le temps ou la personne du verbe
//   (habló/hablo, hablé/hable, hablará/hablara ; falámos/falamos ; cantà/canta) ;
// - `translit` : graphies de substitution admises comme « accent », pour qui n'a pas la
//   touche (Straße → Strasse, hätte → haette).
// Tout autre accent (difícil, música, també, você, cafè…) reste toléré, avec avertissement.
const PT = {
  lettres: "ãõç",
  mots: ["é", "está", "estás", "têm", "vêm", "pôde", "pôr", "dá", "dás", "à", "às", "nós", "vós", "avô", "avó"],
  finales: [/ámos$/],
};
export const DIACRITIQUES = {
  allemand: { lettres: "äöü", translit: { ä: "ae", ö: "oe", ü: "ue", ß: "ss" } },
  suisse: { lettres: "äöü", translit: { ä: "ae", ö: "oe", ü: "ue" } },
  espagnol: {
    lettres: "ñ",
    mots: ["tú", "él", "mí", "sí", "té", "sé", "dé", "más", "aún", "qué", "quién", "quiénes", "cuál", "cuáles",
      "cuánto", "cuánta", "cuántos", "cuántas", "cómo", "dónde", "adónde", "cuándo",
      "está", "estás", "están", "esté", "estés", "estén"],
    // Passé simple (habló, comió ; hablé), futur (hablaré, hablará, hablarás, hablarán ;
    // tendrá, habrá, querrá) — face au présent (hablo), au subjonctif (hable, hablara).
    finales: [/ó$/, /é$/, /(?:[aei]r|dr|br|rr)á[sn]?$/],
  },
  catalan: {
    lettres: "ç",
    mots: ["bé", "béns", "déu", "déus", "és", "mà", "més", "món", "pèl", "què", "sé", "sí", "sòl", "són", "té", "ús",
      "vós", "véns", "vénen"],
    // Passé simple (cantà, anà) face au présent (canta) ; « està » face à « esta ».
    finales: [/à$/],
  },
  ptpt: PT,
  ptbr: PT,
};
const MOTS = Object.fromEntries(Object.entries(DIACRITIQUES).map(([l, r]) => [l, new Set(r.mots || [])]));

const finaleEn = (re, mot, i) => { const m = re.exec(mot); return !!m && i >= m.index; };

// Vrai si `attendu` et `saisi` (déjà normalisés, égaux aux diacritiques près) diffèrent par
// un diacritique qui porte le sens dans cette langue. Langue sans liste : jamais.
export function signeDistinctif(attendu, saisi, langId) {
  const r = DIACRITIQUES[langId];
  if (!r) return false;
  const ma = String(attendu).split(" ");
  const ms = String(saisi).split(" ");
  if (ma.length !== ms.length) return false;
  return ma.some((a, k) => {
    const s = ms[k];
    if (a === s) return false;
    if (MOTS[langId].has(a) || MOTS[langId].has(s)) return true;
    const A = [...a], S = [...s];
    if (A.length !== S.length) return false;
    for (let i = 0; i < A.length; i++) {
      if (A[i] === S[i]) continue;
      if (r.lettres && (r.lettres.includes(A[i]) || r.lettres.includes(S[i]))) return true;
      if (r.finales && r.finales.some(re => finaleEn(re, a, i) || finaleEn(re, s, i))) return true;
    }
    return false;
  });
}

const translitere = (t, table) => [...t].map(c => table[c] ?? c).join("");

// Correction : "juste", "accent" (juste aux diacritiques près — compté juste, avec un
// avertissement), "diacritique" (le signe oublié ou ajouté change le mot ou le temps : compté
// faux, #125), "faux". `charBased` : écriture sans espaces (japonais), comparée sans
// espaces. `langId` : langue de l'exercice, pour les diacritiques porteurs de sens (sans
// elle, tous les accents sont tolérés). Plusieurs réponses acceptées si le modèle les sépare
// par « / ».
export function corrigeTrou(attendu, saisi, { charBased = false, langId = null } = {}) {
  const opts = { sansEspaces: charBased };
  const s = normalise(saisi, opts);
  if (!s) return "faux";
  const variantes = String(attendu ?? "").split("/").map(v => v.trim()).filter(Boolean);
  if (variantes.some(v => normalise(v, opts) === s)) return "juste";
  const table = DIACRITIQUES[langId]?.translit;
  if (table && variantes.some(v => translitere(normalise(v, opts), table) === translitere(s, table))) return "accent";
  const sa = normalise(saisi, { ...opts, sansAccents: true });
  const proches = variantes.filter(v => normalise(v, { ...opts, sansAccents: true }) === sa);
  if (!proches.length) return "faux";
  return proches.some(v => !signeDistinctif(normalise(v, opts), s, langId)) ? "accent" : "diacritique";
}

// Verdict compté juste (l'avertissement d'accent n'est pas une faute).
export const estJuste = (r) => r === "juste" || r === "accent";

// Fonction de remplacement : une réponse contenant « $& » ou « $' » n'est pas interprétée.
export const phraseComplete = (p) => p.phrase.replace(TROU, () => p.reponse.split("/")[0].trim());

// Score : les « accent » comptent juste, les « diacritique » faux.
export function scoreTrous(resultats) {
  const r = Array.isArray(resultats) ? resultats : [];
  const justes = r.filter(estJuste).length;
  return { justes, total: r.length };
}

// Progression pendant la génération (#125) : phrases complètes reçues sur NB_PHRASES (une
// phrase est complète quand son dernier champ, « traduction » ou « reading », est arrivé).
export function progressionTrous(buffer, { lecture = true } = {}) {
  const b = typeof buffer === "string" ? buffer : "";
  const n = (b.match(lecture ? /"reading"\s*:/g : /"traduction"\s*:/g) || []).length;
  const faites = Math.min(n, NB_PHRASES);
  return { faites, part: Math.min(Math.round((faites / NB_PHRASES) * 100) / 100, 0.99) };
}
