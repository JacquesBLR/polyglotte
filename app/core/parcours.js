// Parcours guidé (#111) — un programme de leçons par niveau CECRL, fonctions pures.
//
// Jusqu'ici l'élève choisissait une langue, un niveau et un scénario, puis conversait :
// rien ne lui disait quoi travailler ensuite ni ce qu'il avait couvert. Les produits de
// référence organisent l'apprentissage en programme : Babbel en cours par niveau (une
// leçon = un objectif communicatif, un point de grammaire, un lexique), Duolingo en chemin
// d'unités alignées sur le CECRL, Speak en curriculum dont chaque leçon finit par une
// conversation guidée avec le tuteur IA. Le parcours reprend ce modèle, pour toutes les
// langues, en s'appuyant sur ce que l'app sait déjà faire :
// - les trois objectifs « je peux » d'une leçon (descripteurs du CECRL) deviennent les
//   MISSIONS de la séance (#91) : fixées par l'app avant le premier tour, cochées par le
//   tuteur au fil de la conversation ;
// - une leçon est VALIDÉE quand ses missions sont toutes accomplies — calculé depuis
//   l'historique des séances (entrée `lecon`), rien de plus n'est stocké ;
// - rien n'est verrouillé : on recommande la prochaine leçon, l'élève peut en choisir une
//   autre (un adulte saute ce qu'il sait déjà).

// Niveau de l'app → niveaux CECRL couverts (mêmes bandes que LEVEL_INSTRUCTIONS).
export const CECRL_PAR_NIVEAU = {
  debutant: ["A1", "A2"],
  intermediaire: ["B1", "B2"],
  avance: ["C1"],
};

// Niveau CECRL → niveau de l'app, pour régler le tuteur sur la leçon choisie.
export function niveauApp(cecrl) {
  return Object.keys(CECRL_PAR_NIVEAU).find(n => CECRL_PAR_NIVEAU[n].includes(cecrl)) || null;
}

// Programme commun aux langues. `situation` peut citer {ville} (ville du tuteur). Missions :
// à l'infinitif, 3 à 8 mots, en français — même forme que celles du tuteur (#91).
const L = (id, cecrl, titre, missions, grammaire, lexique, situation) =>
  ({ id, cecrl, titre, missions, grammaire, lexique, situation });

export const PROGRAMME = [
  // ---------- A1 : survie, présent, phrases isolées ----------
  L("a1-presentations", "A1", "Saluer et se présenter",
    ["Saluer et dire son prénom", "Dire d'où l'on vient", "Prendre congé poliment"],
    "le présent de « être » et de « s'appeler » ; les pronoms personnels sujets",
    "salutations, pays et nationalités, formules de politesse",
    "Première rencontre dans un café de {ville} : vous faites connaissance."),
  L("a1-famille", "A1", "Parler de sa famille",
    ["Dire combien on a de frères et sœurs", "Présenter un membre de sa famille", "Donner l'âge de quelqu'un"],
    "« avoir » au présent ; les possessifs ; les nombres jusqu'à 100",
    "la famille, l'âge, les métiers courants",
    "Tu montres à l'élève une photo de ta famille et lui demandes la sienne."),
  L("a1-cafe", "A1", "Commander à boire et à manger",
    ["Demander la carte", "Commander une boisson et un plat", "Demander l'addition au serveur"],
    "la formule de demande polie (« je voudrais ») ; les quantités simples",
    "boissons, plats courants, prix",
    "Tu es serveur ou serveuse dans un café de {ville}, l'élève est client."),
  L("a1-rendez-vous", "A1", "Dire l'heure et fixer un rendez-vous",
    ["Demander l'heure à quelqu'un", "Proposer un jour et une heure", "Accepter ou refuser une proposition"],
    "les nombres, l'heure ; les jours de la semaine ; les prépositions de temps",
    "l'heure, les jours, les moments de la journée",
    "Vous cherchez un moment pour aller ensemble au cinéma à {ville}."),
  L("a1-ville", "A1", "Se repérer en ville",
    ["Demander où se trouve un lieu", "Comprendre une direction simple", "Remercier et répéter l'itinéraire"],
    "« il y a » ; les prépositions de lieu ; l'impératif des verbes de déplacement",
    "lieux de la ville, directions, transports",
    "L'élève est perdu dans {ville} et te demande son chemin."),
  L("a1-gouts", "A1", "Dire ce qu'on aime",
    ["Dire trois choses qu'on aime", "Dire une chose qu'on n'aime pas", "Demander ses goûts au tuteur"],
    "« aimer » suivi d'un nom ou d'un verbe ; la négation",
    "loisirs, nourriture, musique, sport",
    "Discussion détendue : vous comparez vos goûts et vos loisirs."),
  // ---------- A2 : quotidien, passé simple à raconter, futur proche ----------
  L("a2-journee", "A2", "Raconter sa journée",
    ["Décrire sa matinée habituelle", "Dire à quelle heure on travaille", "Parler de son week-end habituel"],
    "les verbes de la routine (pronominaux s'ils existent) ; les adverbes de fréquence",
    "routine quotidienne, horaires, tâches ménagères",
    "Vous comparez vos journées types, la tienne à {ville} et celle de l'élève."),
  L("a2-week-end", "A2", "Raconter son dernier week-end",
    ["Raconter trois choses faites samedi", "Dire avec qui on était", "Donner son impression sur le week-end"],
    "le temps du passé qui sert à raconter des actions terminées",
    "sorties, activités, impressions (« c'était bien »)",
    "C'est lundi matin : tu demandes à l'élève comment s'est passé son week-end."),
  L("a2-courses", "A2", "Faire des courses et comparer",
    ["Demander un prix et une taille", "Comparer deux articles", "Acheter et payer"],
    "le comparatif ; les démonstratifs",
    "vêtements, couleurs, tailles, moyens de paiement",
    "Tu es vendeur ou vendeuse dans une boutique de {ville}."),
  L("a2-logement", "A2", "Décrire son logement",
    ["Décrire les pièces de son logement", "Situer un meuble dans une pièce", "Dire ce qu'on aimerait changer"],
    "les prépositions de lieu ; la forme polie pour exprimer un souhait",
    "pièces, meubles, quartier",
    "L'élève cherche une colocation à {ville} et te décrit ce qu'il a et ce qu'il veut."),
  L("a2-sante", "A2", "Chez le médecin",
    ["Dire où l'on a mal", "Dire depuis quand on est malade", "Comprendre un conseil simple"],
    "la douleur (« avoir mal à ») ; « depuis » ; l'obligation (« il faut », « devoir »)",
    "le corps, symptômes, pharmacie",
    "Tu es médecin dans un cabinet de {ville}, l'élève vient en consultation."),
  L("a2-projets", "A2", "Parler de ses projets",
    ["Dire ce qu'on va faire demain", "Parler de ses prochaines vacances", "Inviter le tuteur à une activité"],
    "le futur proche (aller + infinitif ou son équivalent)",
    "vacances, activités, invitations",
    "Vous parlez de vos projets pour les prochaines semaines."),
  // ---------- B1 : récit, opinion, imprévus ----------
  L("b1-souvenir", "B1", "Raconter un souvenir",
    ["Raconter un souvenir d'enfance", "Décrire le décor et les personnes", "Dire ce qu'on ressentait alors"],
    "l'opposition des temps du passé : actions de premier plan et description d'arrière-plan",
    "enfance, lieux, émotions",
    "Au coin du feu, vous échangez des souvenirs d'enfance."),
  L("b1-opinion", "B1", "Donner son avis et le justifier",
    ["Donner son avis sur un sujet", "Justifier par deux arguments", "Réagir à l'avis du tuteur"],
    "« je pense que », « à mon avis » ; les connecteurs de cause et de conséquence",
    "vie en ville ou à la campagne, écrans, travail à distance",
    "Tu lances un sujet de société simple et défends un avis opposé à celui de l'élève."),
  L("b1-reclamation", "B1", "Résoudre un problème",
    ["Expliquer un problème à l'hôtel", "Demander une solution précise", "Accepter ou refuser un compromis"],
    "la demande polie au conditionnel ; la cause (« parce que », « comme »)",
    "hôtel, pannes, remboursement, réclamation",
    "Tu es réceptionniste dans un hôtel de {ville} ; la chambre de l'élève a un problème."),
  L("b1-voyage", "B1", "Raconter un voyage et ses imprévus",
    ["Raconter un imprévu de voyage", "Expliquer comment on l'a résolu", "Donner un conseil pour ce voyage"],
    "l'antériorité dans le passé ; l'enchaînement chronologique (d'abord, ensuite, finalement)",
    "transports, bagages, retards, rencontres",
    "L'élève revient de voyage ; tu veux tout savoir, surtout ce qui ne s'est pas passé comme prévu."),
  L("b1-travail", "B1", "Parler de son travail ou de ses études",
    ["Décrire son poste et ses tâches", "Dire ce qu'on aime dans son travail", "Parler d'un projet en cours"],
    "l'action en cours ; les pronoms relatifs simples",
    "métiers, tâches, collègues, études",
    "Pause café entre collègues dans une entreprise de {ville}."),
  L("b1-hypotheses", "B1", "Imaginer et faire des hypothèses",
    ["Dire ce qu'on ferait avec plus de temps", "Imaginer une vie dans une autre ville", "Réagir à une hypothèse du tuteur"],
    "le conditionnel ; l'hypothèse sur le présent (« si j'avais… »)",
    "rêves, choix de vie, loisirs",
    "Jeu de l'imagination : « et si tu vivais à {ville} ? »"),
  // ---------- B2 : argumentation, discours rapporté, registre formel ----------
  L("b2-debat", "B2", "Débattre d'une question de société",
    ["Exposer une position nuancée", "Concéder un point au tuteur", "Défendre son point de vue jusqu'au bout"],
    "la concession (« bien que », « même si ») ; les connecteurs logiques",
    "société, environnement, technologie",
    "Débat amical sur une question qui fait discuter à {ville} en ce moment."),
  L("b2-actualite", "B2", "Commenter une actualité",
    ["Résumer une nouvelle récente", "Expliquer ses causes probables", "Envisager ses conséquences"],
    "la voix passive ; l'expression de la probabilité",
    "médias, politique locale, économie, culture",
    "Vous commentez ensemble une nouvelle (réelle ou plausible) concernant {ville}."),
  L("b2-entretien", "B2", "Passer un entretien d'embauche",
    ["Présenter son parcours en détail", "Mettre en valeur une réussite", "Poser une question pertinente au recruteur"],
    "le registre formel (vouvoiement ou équivalent) ; les temps composés",
    "compétences, expérience, conditions de travail",
    "Tu recrutes pour une entreprise de {ville} et l'élève passe l'entretien."),
  L("b2-regrets", "B2", "Exprimer regrets et reproches",
    ["Exprimer un regret sur le passé", "Formuler un reproche avec tact", "Imaginer un autre déroulement"],
    "le conditionnel passé ; l'hypothèse sur le passé (« si j'avais su… »)",
    "décisions, occasions manquées, relations",
    "Un ami (toi) a oublié un rendez-vous important avec l'élève ; vous en reparlez."),
  L("b2-rapporter", "B2", "Rapporter une conversation",
    ["Rapporter ce qu'un ami a dit", "Rapporter une question qu'on nous a posée", "Donner son avis sur ces propos"],
    "le discours indirect et la concordance des temps",
    "verbes introducteurs (affirmer, prétendre, demander…)",
    "L'élève te raconte une discussion animée qu'il a eue la veille."),
  L("b2-negocier", "B2", "Négocier un accord",
    ["Formuler une proposition chiffrée", "Poser une condition", "Conclure un compromis"],
    "la condition (« à condition que », « pourvu que ») et le mode qu'elle demande",
    "prix, délais, contrat, location",
    "L'élève négocie avec toi la location d'un appartement à {ville}."),
  // ---------- C1 : nuance, registres, idiomatique, médiation ----------
  L("c1-argumenter", "C1", "Argumenter avec nuance",
    ["Défendre une thèse en trois temps", "Réfuter un contre-argument", "Nuancer sa propre position"],
    "les connecteurs soutenus ; la mise en relief",
    "abstractions, éthique, débats d'idées",
    "Discussion d'idées exigeante, comme entre deux amis cultivés à {ville}."),
  L("c1-registres", "C1", "Changer de registre",
    ["Raconter une anecdote familièrement", "Reformuler la même chose formellement", "Expliquer la différence de registre"],
    "les marques de registre (lexique, syntaxe, tutoiement ou vouvoiement)",
    "argot courant, formules administratives",
    "Tu fais passer l'élève d'une conversation entre amis à un courriel formel, à l'oral."),
  L("c1-idiomes", "C1", "Jouer avec la langue",
    ["Employer deux expressions idiomatiques à propos", "Comprendre un jeu de mots", "Faire une plaisanterie"],
    "les expressions figées et leur emploi",
    "idiomes, proverbes, humour local",
    "Conversation pleine d'esprit dans un bar de {ville} ; tu glisses des expressions typiques."),
  L("c1-expose", "C1", "Présenter un sujet complexe",
    ["Introduire un sujet et son enjeu", "Structurer un exposé en parties", "Conclure en ouvrant une perspective"],
    "la structuration du discours ; la nominalisation",
    "vocabulaire du sujet choisi par l'élève",
    "L'élève te présente un sujet qu'il connaît bien, comme devant un petit public ; tu poses des questions."),
  L("c1-culture", "C1", "Discuter culture et société",
    ["Comparer un usage local et un usage français", "Expliquer une référence culturelle", "Poser une question critique"],
    "la comparaison nuancée ; l'expression de la réserve",
    "traditions, littérature, cinéma, débats propres à {ville}",
    "Conversation culturelle : ce qui surprend un Français à {ville}, et l'inverse."),
  L("c1-mediation", "C1", "Expliquer à quelqu'un d'autre",
    ["Résumer un point de vue complexe", "Expliquer un terme technique simplement", "Répondre à une objection"],
    "la reformulation (« autrement dit », « c'est-à-dire ») ; la simplification",
    "vocabulaire professionnel de l'élève",
    "Tu joues un ami qui ne connaît rien au métier ou à la passion de l'élève : il doit te l'expliquer (médiation, volume complémentaire du CECRL)."),
];

const PAR_ID = new Map(PROGRAMME.map(u => [u.id, u]));

// ---------- Bilan de fin de niveau (#114) ----------
//
// Rien ne clôturait un niveau : une leçon validée n'était plus jamais réemployée, et rien
// ne vérifiait que l'élève mobilise ENSEMBLE ce qu'il a appris séparément. Busuu termine
// chaque niveau par un Checkpoint, Duolingo par des checkpoints qui mélangent les unités,
// Babbel par un Review. Le bilan d'un niveau CECRL tire trois missions dans trois leçons
// différentes de ce niveau — un nouveau tirage à chaque séance — et le tuteur enchaîne les
// situations. Bilan validé (trois missions cochées) = niveau validé.

export const NIVEAUX_CECRL = ["A1", "A2", "B1", "B2", "C1"];
const idBilan = (cecrl) => `bilan-${cecrl.toLowerCase()}`;
const BILANS = new Map(NIVEAUX_CECRL.map(c => [idBilan(c), c]));

// Tirage de k indices distincts parmi n (Fisher-Yates partiel, aléa injectable et borné).
function tirage(n, k, alea) {
  const idx = [...Array(n).keys()];
  for (let i = 0; i < Math.min(k, n); i++) {
    const r = Number(alea());
    const u = Number.isFinite(r) ? Math.min(Math.max(r, 0), 0.999999) : 0;
    const j = i + Math.floor(u * (n - i));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, Math.min(k, n));
}

// Séance de bilan d'un niveau CECRL : même forme qu'une leçon (`bilan: true`), missions
// tirées dans trois leçons distinctes, dans l'ordre du programme. null si niveau inconnu.
export function bilanNiveau(cecrl, alea = Math.random) {
  const lecons = PROGRAMME.filter(u => u.cecrl === cecrl);
  if (!lecons.length) return null;
  const choisies = tirage(lecons.length, 3, alea).sort((a, b) => a - b).map(i => lecons[i]);
  const tirees = choisies.map(u => ({ u, m: u.missions[tirage(u.missions.length, 1, alea)[0]] }));
  // Une mission de clôture (« Prendre congé poliment ») tirée en premier fermait la
  // conversation avant les autres (relecture du soir) : elle passe en dernier.
  const cloture = (m) => /prendre congé|conclure/i.test(m);
  tirees.sort((a, b) => cloture(a.m) - cloture(b.m));
  const missions = tirees.map(t => t.m);
  return {
    id: idBilan(cecrl),
    cecrl,
    bilan: true,
    titre: `Bilan ${cecrl}`,
    missions,
    sources: tirees.map(t => t.u.id),
    grammaire: choisies.map(u => u.grammaire).join(" ; "),
    lexique: choisies.map(u => u.lexique).join(" ; "),
    situation: `Conversation de BILAN du niveau ${cecrl} à {ville} : enchaîne naturellement, l'une après l'autre, les situations `
      + `des leçons « ${tirees.map(t => t.u.titre).join(" », « ")} », sans annoncer que c'est un test. Dès qu'une mission est `
      + "accomplie, amène la situation de la suivante (change de décor si besoin : « bon, on va prendre un café ? »), sans "
      + "revenir sur une mission déjà accomplie ni reposer une question déjà répondue. Ne simplifie pas pour aider : "
      + "c'est l'occasion de vérifier ce que l'élève sait faire seul.",
  };
}

// Niveaux CECRL validés d'une langue : ceux dont un bilan a vu ses missions toutes cochées.
export function niveauxValides(history, lang) {
  const ok = new Set();
  for (const h of Array.isArray(history) ? history : []) {
    if (!h || h.lang !== lang || !BILANS.has(h.lecon)) continue;
    const m = h.missions;
    if (m && m.total > 0 && m.atteintes >= m.total) ok.add(BILANS.get(h.lecon));
  }
  return ok;
}

export function leconParId(id) {
  return PAR_ID.get(id) || null;
}

// Leçons d'un niveau de l'app, dans l'ordre du programme.
export function leconsDuNiveau(level) {
  const cecrl = CECRL_PAR_NIVEAU[level] || [];
  return PROGRAMME.filter(u => cecrl.includes(u.cecrl));
}

// Leçons validées d'une langue : séances de l'historique portant `lecon`, dans cette langue,
// dont toutes les missions ont été accomplies. Une séance d'une autre langue ne compte pas.
export function leconsValidees(history, lang) {
  const ok = new Set();
  for (const h of Array.isArray(history) ? history : []) {
    if (!h || h.lang !== lang || !PAR_ID.has(h.lecon)) continue;
    const m = h.missions;
    if (m && m.total > 0 && m.atteintes >= m.total) ok.add(h.lecon);
  }
  return ok;
}

// Prochaine leçon recommandée : la première non validée du niveau ; null si tout est fait.
export function prochaineLecon(level, validees) {
  return leconsDuNiveau(level).find(u => !validees.has(u.id)) || null;
}

// Avancement d'un niveau : { faites, total }.
export function avancement(level, validees) {
  const lecons = leconsDuNiveau(level);
  return { faites: lecons.filter(u => validees.has(u.id)).length, total: lecons.length };
}

// Numéro affiché d'une leçon dans son niveau CECRL : « A1·3 ».
export function numero(lecon) {
  if (lecon.bilan) return lecon.cecrl;
  // Par identifiant : une leçon recopiée (phrases clés ajoutées, #116) garde son numéro.
  const rang = PROGRAMME.filter(u => u.cecrl === lecon.cecrl).findIndex(u => u.id === lecon.id) + 1;
  return `${lecon.cecrl}·${rang}`;
}

// Consigne de prompt d'une leçon, à la place des instructions de scénario. Le point de
// grammaire est formulé pour le français : le tuteur le transpose à la langue enseignée (un
// point qui n'y existe pas — les articles en japonais — laisse place à son équivalent).
// Phrases préparées par l'élève (#116) : le tuteur amène les situations qui les appellent.
function blocPhrasesPreparees(phrases) {
  const l = (Array.isArray(phrases) ? phrases : []).map(p => p && p.phrase).filter(Boolean);
  if (!l.length) return "";
  return `
L'élève a préparé ces phrases avant la séance : ${l.map(x => `« ${x} »`).join(", ")}. Amène les situations où il peut les
dire ; s'il les emploie, n'en fais pas un exercice, continue la conversation. Ne les lui récite pas.`;
}

export function blocLecon(lecon, cfg) {
  const ville = (t) => t.replaceAll("{ville}", cfg.tutor.city);
  return `LEÇON DU PARCOURS « ${lecon.titre} » (niveau ${lecon.cecrl} du CECRL). ${ville(lecon.situation)}
Point de grammaire à faire pratiquer : ${lecon.grammaire}. Transpose-le à ${cfg.langFr} ; s'il n'y existe pas tel quel,
travaille son équivalent naturel. Amène des questions qui obligent l'élève à employer ces formes, sans faire de cours.
Lexique visé : ${ville(lecon.lexique)}. Réemploie-le dans tes répliques et dans tes suggestions.
Reste au niveau ${lecon.cecrl} : ni plus facile, ni plus difficile.${blocPhrasesPreparees(lecon.phrasesCles)}`;
}

// Bilan à proposer (#114) : le premier niveau CECRL du niveau de l'app dont les six leçons
// sont validées et qui n'est pas encore validé ; null sinon.
export function prochainBilan(level, validees, niveauxOk) {
  for (const c of CECRL_PAR_NIVEAU[level] || []) {
    const lecons = PROGRAMME.filter(u => u.cecrl === c);
    if (!niveauxOk.has(c) && lecons.every(u => validees.has(u.id))) return c;
  }
  return null;
}

// ---------- Préparer une leçon : phrases clés (#116) ----------
//
// Une leçon commençait directement par la conversation : un débutant arrivait à « Commander
// à boire et à manger » sans les phrases nécessaires. Speak ouvre chaque leçon par une phase
// Learn (écouter et répéter les phrases clés), Babbel présente phrases et vocabulaire avant
// le dialogue, Pimsleur fait écouter puis répéter. Ici : 5 phrases clés rattachées aux
// missions, écoutées avant de parler, puis transmises au tuteur pour qu'il les fasse
// réemployer.

export const NB_PHRASES_CLES = 5;

export function schemaPhrasesCles({ lecture = true } = {}) {
  const item = {
    phrase: { type: "string", description: "Phrase clé en langue cible, prononçable, au niveau de la leçon." },
    traduction: { type: "string", description: "Traduction française." },
    ...(lecture ? { reading: { anyOf: [{ type: "null" }, { type: "string", description: "Translittération latine." }] } } : {}),
    usage: { type: "string", description: "Quand l'employer, en français, une courte phrase." },
    mission: { type: "integer", description: "Numéro (1 à 3) de la mission que cette phrase aide à accomplir." },
  };
  return {
    type: "object",
    properties: {
      phrases: {
        type: "array",
        description: `Exactement ${NB_PHRASES_CLES} phrases clés, dans l'ordre où elles serviront.`,
        items: { type: "object", properties: item, required: Object.keys(item), additionalProperties: false },
      },
    },
    required: ["phrases"],
    additionalProperties: false,
  };
}

export function demandePhrasesCles(lecon, cfg) {
  const ville = (t) => t.replaceAll("{ville}", cfg.tutor.city);
  return `Prépare l'élève à la leçon « ${lecon.titre} » (niveau ${lecon.cecrl}) en ${cfg.langFr}. Situation : ${ville(lecon.situation)}
Missions de la leçon :
${lecon.missions.map((m, i) => `${i + 1}. ${m}`).join("\n")}
Donne ${NB_PHRASES_CLES} phrases clés que l'élève pourra dire LUI-MÊME pendant la conversation (pas tes répliques à toi),
au niveau ${lecon.cecrl}, qui emploient ${lecon.grammaire} et le lexique « ${ville(lecon.lexique)} ». Couvre les trois missions.`;
}

const texte = (v) => (typeof v === "string" ? v.trim() : "");

// Normalise les phrases clés ; null si aucune n'est exploitable. Mission hors bornes → null.
export function phrasesClesValides(data, nbMissions = 3) {
  const brut = data && Array.isArray(data.phrases) ? data.phrases : [];
  const vues = new Set();
  const ok = [];
  for (const p of brut) {
    if (!p || typeof p !== "object") continue;
    const phrase = texte(p.phrase);
    if (!phrase || vues.has(phrase.toLowerCase())) continue;
    vues.add(phrase.toLowerCase());
    ok.push({
      phrase,
      traduction: texte(p.traduction),
      reading: texte(p.reading) || null,
      usage: texte(p.usage),
      mission: Number.isInteger(p.mission) && p.mission >= 1 && p.mission <= nbMissions ? p.mission : null,
    });
  }
  return ok.length ? ok.slice(0, NB_PHRASES_CLES) : null;
}

// Libellé d'une séance de l'historique pour l'écran Progrès : la leçon plutôt que le
// scénario technique « lecon » (relecture du soir).
export function libelleSeance(h) {
  const u = h && PAR_ID.get(h.lecon);
  if (u) return `📚 ${numero(u)} ${u.titre}`;
  if (h && typeof h.lecon === "string" && h.lecon.startsWith("bilan-")) return `🏅 Bilan ${h.lecon.slice(6).toUpperCase()}`;
  return (h && h.scenario) || "libre";
}
