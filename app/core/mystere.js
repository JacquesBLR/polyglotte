// « Personnage mystère » (#105) — fonctions pures.
//
// Tous les autres scénarios sont des jeux de rôle où les deux interlocuteurs savent tout :
// rien n'oblige l'élève à poser des questions ni à négocier le sens. Ici, le tuteur joue
// un personnage dont le métier est secret, et l'élève doit le découvrir en le
// questionnant dans la langue cible : une tâche à écart d'information (Doughty & Pica,
// « Information gap tasks », TESOL Quarterly 20(2), 1986 ; Prabhu, Second Language
// Pedagogy, 1987), où c'est l'information manquante qui provoque questions,
// vérifications et reformulations (hypothèse de l'interaction, Long, 1996).
//
// Le secret est tiré au sort par l'app, jamais par le modèle : la devinette se vérifie
// localement, sans appel, et le jeu reste honnête même si le modèle se trompe.

export const SCENARIO_MYSTERE = "mystere";
export const NB_CHOIX = 6;
// Questions posées avant de pouvoir deviner : deviner d'emblée, c'est jouer à pile ou face.
export const QUESTIONS_MIN = 2;

// Métiers du catalogue. `m` / `f` : intitulés (le tuteur joue selon son genre) ;
// `racines` : formes françaises sans accents qui trahiraient le secret dans la traduction,
// les suggestions ou le vocabulaire (filet de sécurité, cf. `masqueFuite`).
export const METIERS = [
  { id: "boulanger", m: "boulanger", f: "boulangère", racines: ["boulang"] },
  { id: "medecin", m: "médecin", f: "médecin", racines: ["medecin", "docteur", "doctoresse"] },
  { id: "pompier", m: "pompier", f: "pompière", racines: ["pompier"] },
  { id: "enseignant", m: "enseignant", f: "enseignante", racines: ["enseignant", "professeur", "instituteur", "institutrice", "prof"] },
  { id: "pecheur", m: "pêcheur", f: "pêcheuse", racines: ["pecheur", "pecheuse"] },
  { id: "taxi", m: "chauffeur de taxi", f: "chauffeuse de taxi", racines: ["taxi"] },
  { id: "cuisinier", m: "cuisinier", f: "cuisinière", racines: ["cuisinier"] },
  { id: "agriculteur", m: "agriculteur", f: "agricultrice", racines: ["agricult", "fermier", "fermiere", "paysan"] },
  { id: "musicien", m: "musicien", f: "musicienne", racines: ["musicien"] },
  { id: "facteur", m: "facteur", f: "factrice", racines: ["facteur", "factrice", "postier", "postiere"] },
  { id: "coiffeur", m: "coiffeur", f: "coiffeuse", racines: ["coiffeu"] },
  { id: "photographe", m: "photographe", f: "photographe", racines: ["photographe"] },
];

const parId = (id) => METIERS.find(m => m.id === id) || null;

// Intitulé affiché d'un métier, au genre du tuteur.
export function intitule(id, feminin = false) {
  const m = parId(id);
  return m ? (feminin ? m.f : m.m) : null;
}

// Tire un secret et NB_CHOIX - 1 leurres distincts, mélangés. `alea` : fonction [0, 1)
// injectée (Math.random en séance, déterministe en test).
export function tireMystere(alea = Math.random) {
  const tire = () => {
    const v = Number(alea());
    return Number.isFinite(v) ? Math.min(Math.max(v, 0), 0.999999) : 0;
  };
  const pioche = [...METIERS];
  // Fisher-Yates partiel : les NB_CHOIX premiers sont distincts et uniformes.
  for (let i = 0; i < NB_CHOIX; i++) {
    const j = i + Math.floor(tire() * (pioche.length - i));
    [pioche[i], pioche[j]] = [pioche[j], pioche[i]];
  }
  const choix = pioche.slice(0, NB_CHOIX).map(m => m.id);
  const secret = choix[Math.floor(tire() * NB_CHOIX)];
  return { secret, choix, revele: null };
}

// Gradation : la forme des questions attendues et des indices, selon le niveau de l'app.
export const INDICES_PAR_NIVEAU = {
  debutant: "l'élève posera surtout des questions simples ou fermées (oui / non) : réponds par une phrase très courte et claire. S'il piétine, donne un indice très concret (un lieu, un objet, un moment de ta journée)",
  intermediaire: "l'élève peut poser des questions ouvertes (ta journée, tes horaires, tes outils, ce que tu aimes dans ton travail) : réponds en deux phrases, avec un détail concret qui fait avancer l'enquête",
  avance: "sois plus subtil : anecdotes, sous-entendus, expressions imagées ; un indice indirect à la fois, et pousse l'élève à argumenter son hypothèse",
};

// Consigne de prompt. Chaîne vide si `mystere` est absent (autres scénarios).
export function blocMystere(level, mystere, feminin = false) {
  if (!mystere || !parId(mystere.secret)) return "";
  const metier = intitule(mystere.secret, feminin);
  if (mystere.revele) {
    const issue = mystere.revele.trouve
      ? "l'élève a trouvé ton métier"
      : `l'élève a proposé « ${intitule(mystere.revele.propose, feminin) || "?"} », mais tu es ${metier}`;
    return `- JEU DU PERSONNAGE MYSTÈRE TERMINÉ : ${issue}. Ton métier (${metier}) n'est plus un secret : parles-en
  librement et poursuis la conversation sur ce sujet.`;
  }
  const gradation = INDICES_PAR_NIVEAU[level] || INDICES_PAR_NIVEAU.debutant;
  return `- JEU DU PERSONNAGE MYSTÈRE : tu joues un personnage dont le métier SECRET est « ${metier} ». L'élève doit le
  découvrir en te posant des questions dans la langue cible ; il proposera sa réponse avec un bouton de l'application.
  Au message "[START]", salue-le, présente le jeu en une phrase simple (« devine mon métier ») et invite-le à te questionner.
- Ne dis JAMAIS le nom de ton métier, ni sa traduction, ni un mot de la même famille (par exemple le nom du lieu
  qui le désigne directement), ni dans "reply", ni dans "translation", ni dans "suggestions", ni dans "vocabulary".
- Réponds honnêtement et en restant dans ton rôle ; ${gradation}.
- Si l'élève propose un métier dans son message, dis seulement si c'est juste ou non, sans nommer le bon.
- "suggestions" : des QUESTIONS d'enquête que l'élève pourrait te poser ensuite (lieu, horaires, objets, clients…),
  sans nommer aucun métier.
- "cultural_note" : null tant que le métier n'est pas trouvé.`;
}

// Vérifie une devinette. Rend l'état révélé, ou null pour un choix hors liste.
export function devine(mystere, propose) {
  if (!mystere || mystere.revele || !mystere.choix.includes(propose)) return null;
  return { ...mystere, revele: { propose, trouve: propose === mystere.secret } };
}

const sansAccents = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Filet de sécurité : le modèle qui laisserait échapper son métier dans les champs EN
// FRANÇAIS (traduction, suggestions, vocabulaire) le verrait masqué avant affichage. La
// réplique en langue cible n'est pas contrôlable ici : c'est la consigne qui la protège.
// Les racines sont cherchées en début de mot (« prof » ne masque pas « profiter » s'il
// est suivi d'une lettre : la racine courte doit finir le mot).
export function trahit(texte, mystere) {
  if (!mystere || mystere.revele || typeof texte !== "string") return false;
  const m = parId(mystere.secret);
  if (!m) return false;
  const t = sansAccents(texte);
  return m.racines.some(r => motif(r).test(t));
}

const motif = (racine) => (racine.length <= 4
  ? new RegExp(`(^|[^a-z])${racine}s?($|[^a-z])`)
  : new RegExp(`(^|[^a-z])${racine}`));

// Données du tour expurgées : traduction et suggestions qui trahissent → masquées ;
// mot de vocabulaire qui trahit → retiré. Rend { data, fuite } (fuite : booléen).
export function expurge(data, mystere) {
  if (!data || !mystere || mystere.revele) return { data, fuite: false };
  let fuite = false;
  const masque = (s) => {
    if (!trahit(s, mystere)) return s;
    fuite = true;
    return "… (le tuteur a failli révéler son métier)";
  };
  const out = { ...data };
  if (typeof out.translation === "string") out.translation = masque(out.translation);
  if (Array.isArray(out.suggestions)) {
    const s = out.suggestions.filter(x => !trahit(x, mystere));
    if (s.length !== out.suggestions.length) fuite = true;
    out.suggestions = s;
  }
  if (Array.isArray(out.vocabulary)) {
    const v = out.vocabulary.filter(x => !(x && (trahit(x.term, mystere) || trahit(x.translation, mystere))));
    if (v.length !== out.vocabulary.length) fuite = true;
    out.vocabulary = v;
  }
  return { data: out, fuite };
}

// Message de révélation affiché à l'élève.
export function messageRevelation(mystere, questions, feminin = false) {
  if (!mystere?.revele) return "";
  const metier = intitule(mystere.secret, feminin);
  const q = `${questions} question${questions > 1 ? "s" : ""}`;
  return mystere.revele.trouve
    ? `🎉 Bravo ! C'était bien « ${metier} » — trouvé en ${q}.`
    : `🕵️ Raté : c'était « ${metier} » (tu as proposé « ${intitule(mystere.revele.propose, feminin)} »). Tu peux continuer à en parler avec le tuteur.`;
}

// Entrée d'historique, seulement une fois le secret révélé (avant, rien ne le trahit).
export function entreeMystere(mystere, questions) {
  if (!mystere?.revele) return null;
  return { metier: mystere.secret, trouve: !!mystere.revele.trouve, questions: Math.max(0, questions | 0) };
}

// Séances de l'historique où le personnage a été deviné.
export function nbMysteresTrouves(history) {
  return (history || []).filter(h => h && h.mystere && h.mystere.trouve === true).length;
}
