// Programme de grammaire par langue et par niveau (#112) — donnée pure et fonctions pures.
//
// L'écran Grammaire proposait les mêmes cinq sujets aux dix langues (dont « les articles »
// à un élève de japonais). Les produits de référence ont un programme PROPRE À CHAQUE
// LANGUE : Babbel (leçons de grammaire par langue, ordonnées par niveau), Busuu (Grammar
// review par niveau CECRL), Duolingo (Guidebook de chaque unité). Six points par niveau de
// l'app, du plus fondamental au plus fin ; libellés en français, formes en langue cible.

export const PROGRAMME_GRAMMAIRE = {
  catalan: {
    debutant: [
      "Les articles (el, la, l', els, les) et l'article personnel (en, na)",
      "Ser et estar",
      "Le présent des trois conjugaisons (parlar, perdre, dormir, servir)",
      "Les possessifs (el meu, la meva, els meus)",
      "La négation (no, no… pas, mai, res, ningú)",
      "Hi ha et les prépositions de lieu",
    ],
    intermediaire: [
      "Le passé périphrastique (vaig anar) et le passé composé (he anat)",
      "L'imparfait (anava) face au passé périphrastique",
      "Les pronoms faibles (em, et, el, la, en, hi)",
      "Le futur et le conditionnel",
      "Le subjonctif présent (que vingui)",
      "Les prépositions per et per a",
    ],
    avance: [
      "Les combinaisons de pronoms faibles (l'hi, n'hi, li'n)",
      "Le subjonctif imparfait et les hypothèses (si vingués)",
      "La concordance des temps",
      "Le passé simple littéraire (anà, digué)",
      "Les variétés du catalan (central, valencien, baléare)",
      "Les connecteurs du discours soutenu",
    ],
  },
  espagnol: {
    debutant: [
      "Ser et estar",
      "Le présent : réguliers et irréguliers courants (tener, ir, hacer)",
      "Les verbes à diphtongue (querer, poder, dormir)",
      "Gustar et les verbes de goût",
      "Hay ou está : situer et dire ce qui existe",
      "Le genre des noms et les articles",
    ],
    intermediaire: [
      "Pretérito perfecto et pretérito indefinido",
      "Indefinido et imperfecto pour raconter",
      "Les pronoms compléments (lo, la, le, se lo)",
      "Le subjonctif présent (quiero que, ojalá)",
      "L'impératif affirmatif et négatif",
      "Por et para",
    ],
    avance: [
      "Le subjonctif imparfait et les hypothèses (si tuviera)",
      "La concordance des temps au subjonctif",
      "Les périphrases verbales (llevar + gérondif, acabar de, volver a)",
      "Le discours rapporté",
      "Ser et estar qui changent le sens (ser listo, estar listo)",
      "Les variétés d'espagnol et le voseo",
    ],
  },
  anglais: {
    debutant: [
      "Present simple et present continuous",
      "Be et have got",
      "Les questions et négations avec do / does",
      "There is / there are",
      "Le past simple (réguliers et irréguliers)",
      "A, an, the, some, any",
    ],
    intermediaire: [
      "Present perfect ou past simple",
      "Les futurs : will, going to, present continuous",
      "Les modaux (can, must, have to, should)",
      "Le premier et le deuxième conditionnel",
      "Le passif",
      "Les phrasal verbs courants",
    ],
    avance: [
      "Le troisième conditionnel et les conditionnels mixtes",
      "Wish et if only",
      "L'inversion d'insistance (Never have I…)",
      "Les modaux au passé (must have, should have)",
      "Le discours indirect et le recul des temps",
      "Anglais britannique et américain",
    ],
  },
  allemand: {
    debutant: [
      "Le genre et les articles (der, die, das)",
      "Le présent (sein, haben, verbes forts)",
      "Le verbe en deuxième position",
      "L'accusatif",
      "La négation : nicht ou kein",
      "Les verbes à particule séparable (aufstehen, einkaufen)",
    ],
    intermediaire: [
      "Le datif et les prépositions mixtes (in, an, auf)",
      "Le Perfekt : haben ou sein",
      "Les subordonnées : verbe à la fin (weil, dass, wenn)",
      "Les verbes de modalité (können, müssen, dürfen)",
      "La déclinaison de l'adjectif",
      "Le Präteritum des verbes courants",
    ],
    avance: [
      "Le génitif et ses prépositions (wegen, trotz)",
      "Le Konjunktiv II (hätte, wäre, würde)",
      "Le Konjunktiv I du discours rapporté",
      "Le passif (werden, sein) et ses substituts",
      "Le participe en fonction d'adjectif (die gestern gekaufte Zeitung)",
      "Les particules modales (doch, ja, mal, halt)",
    ],
  },
  suisse: {
    debutant: [
      "Saluer : Grüezi, Sali, Ciao, et le vouvoiement",
      "Le présent des verbes courants (ich bi, du bisch, mir sind)",
      "Les articles (de, d, s) et le diminutif -li",
      "Les mots suisses face à l'allemand standard (Velo, Trottoir, Znüni)",
      "La négation (nöd, kei)",
      "Poser une question (Wie gaht's ? Wo isch… ?)",
    ],
    intermediaire: [
      "Le passé : seulement le Perfekt (ich bi gsi, ich ha gha)",
      "Pas de Präteritum ni de génitif : comment s'en passer",
      "Les pronoms indéfinis (öpper, öppis, nüt, niemer)",
      "Les verbes de modalité (chönne, müese, wele)",
      "Le datif en dialecte (em, de, ere)",
      "Le futur exprimé par le présent",
    ],
    avance: [
      "Le subjonctif (ich wär, ich hett)",
      "Les variantes régionales (Zurich, Berne, Bâle)",
      "La diglossie : quand passer au Hochdeutsch",
      "Les emprunts au français (merci vilmal, Glace, Coiffeur)",
      "Les expressions idiomatiques suisses",
      "Écrire en dialecte (messages, réseaux)",
    ],
  },
  ptpt: {
    debutant: [
      "Ser et estar",
      "Le présent des verbes réguliers (-ar, -er, -ir)",
      "Tu, você et o senhor au Portugal",
      "Les contractions (no, na, do, da, pelo)",
      "Gostar de",
      "Há, et estar a + infinitif (estou a falar)",
    ],
    intermediaire: [
      "Pretérito perfeito et imperfeito",
      "Le futur, le conditionnel et la mésoclise (dir-lhe-ei)",
      "La place des pronoms (chamo-me ; não me chamo)",
      "Le subjonctif présent",
      "L'infinitif personnel (para fazermos)",
      "Por et para",
    ],
    avance: [
      "Le futur du subjonctif (quando puderes, se fizeres)",
      "Le subjonctif imparfait et les hypothèses",
      "Le registre soutenu à l'écrit",
      "Le plus-que-parfait (tinha feito, fizera)",
      "Le discours rapporté",
      "Portugais européen et brésilien",
    ],
  },
  ptbr: {
    debutant: [
      "Ser et estar",
      "Le présent des verbes réguliers (-ar, -er, -ir)",
      "Você et a gente",
      "Les contractions (no, na, do, da, pelo)",
      "Gostar de",
      "Estar + gérondif (estou falando)",
    ],
    intermediaire: [
      "Pretérito perfeito et imperfeito",
      "La place des pronoms au Brésil (me chamo)",
      "Le futur avec ir + infinitif",
      "Le subjonctif présent",
      "L'infinitif personnel (para a gente fazer, para fazermos)",
      "Por et para",
    ],
    avance: [
      "Le futur du subjonctif (quando você puder)",
      "Le subjonctif imparfait et les hypothèses",
      "La langue parlée (tá, pra, cadê) et la norme écrite",
      "Le discours rapporté",
      "Les expressions idiomatiques brésiliennes",
      "Portugais brésilien et européen",
    ],
  },
  japonais: {
    debutant: [
      "Les hiragana et les katakana",
      "La phrase nominale : X は Y です",
      "Les particules は, が, を, に, で",
      "Le verbe poli (-ます, -ません, -ました)",
      "Les adjectifs en い et en な",
      "Compter : nombres et classificateurs (つ, 人, 枚)",
    ],
    intermediaire: [
      "La forme en て (demander, enchaîner, -ている)",
      "La forme neutre (dictionnaire, ない, た) et le registre familier",
      "L'envie et l'intention (-たい, つもり)",
      "La forme potentielle (食べられる)",
      "Les conditionnels (と, ば, たら, なら)",
      "Donner et recevoir (あげる, くれる, もらう)",
    ],
    avance: [
      "Le keigo : langage honorifique et de modestie",
      "Le passif et le causatif (-される, -させる)",
      "Le but et la concession (ために, ように, のに)",
      "Les modalités (はず, わけ, らしい, みたい)",
      "Les onomatopées (ドキドキ, ペラペラ)",
      "Lire les kanji : on'yomi et kun'yomi",
    ],
  },
  arabe: {
    debutant: [
      "L'alphabet et les voyelles brèves",
      "La phrase nominale, sans verbe être",
      "Le genre et le tā' marbūṭa (ة)",
      "L'article al- : lettres solaires et lunaires",
      "Les pronoms personnels et possessifs suffixés",
      "Le présent (inaccompli : yaktubu)",
    ],
    intermediaire: [
      "Le passé (accompli : kataba)",
      "La racine trilitère et les schèmes",
      "Le duel et les pluriels (sain et brisé)",
      "L'annexion, idāfa (kitābu ṭ-ṭālibi)",
      "Les nombres et l'accord du nom compté",
      "La négation (lā, lam, lan, laysa, mā)",
    ],
    avance: [
      "Les formes dérivées du verbe (II à X)",
      "Le subjonctif et l'apocopé (an yaktuba, lam yaktub)",
      "Les cas : nominatif, accusatif, génitif",
      "La voix passive (kutiba)",
      "Les subordonnées (anna, ḥattā, alladhī)",
      "L'arabe standard et les dialectes",
    ],
  },
  tunisien: {
    debutant: [
      "Saluer en derja (Aslema, Chniya a7walek ?)",
      "Le présent : la première personne en n- (nekteb, nemchi)",
      "Les pronoms personnels (ena, enti, howa, ahna)",
      "La possession avec mte3 (el ktab mte3i)",
      "La négation ma… ch (ma n7ebbech)",
      "Les nombres et les prix au marché",
    ],
    intermediaire: [
      "Le passé (ktebt, mchit)",
      "Le futur avec bech (bech nemchi)",
      "Les mots interrogatifs (chnowa, win, wa9tech, 3lech)",
      "Les emprunts au français, à l'italien et à l'espagnol",
      "Les pronoms compléments suffixés (chritou, n7ebbek)",
      "L'action en cours avec 9a3ed (9a3ed nekteb)",
    ],
    avance: [
      "Les expressions idiomatiques tunisiennes",
      "Les parlers régionaux (Tunis, Sfax, Sahel)",
      "L'alternance derja et français",
      "Les formules de politesse et de bénédiction (y3aychek, bessa7a, besslema)",
      "Le derja face à l'arabe standard",
      "Écrire le derja : écriture arabe et arabizi",
    ],
  },
};

// Sujets génériques pour une langue sans programme (ne devrait pas arriver : garde-fou).
export const SUJETS_GENERIQUES = [
  "Le présent de l'indicatif",
  "Le passé : raconter hier",
  "Poser une question",
  "La négation",
];

export function programmeGrammaire(langId, level) {
  return PROGRAMME_GRAMMAIRE[langId]?.[level] || SUJETS_GENERIQUES;
}

// Points étudiés : { [langId]: [sujet, …] } dans la clé `grammaire` du profil. Rend le même
// objet si rien ne change (identité testée par l'appelant avant d'enregistrer).
export function marqueEtudie(etudies, langId, sujet) {
  const base = etudies && typeof etudies === "object" && !Array.isArray(etudies) ? etudies : {};
  const s = typeof sujet === "string" ? sujet.trim() : "";
  if (!s || !langId) return etudies;
  const liste = Array.isArray(base[langId]) ? base[langId] : [];
  if (liste.includes(s)) return etudies;
  return { ...base, [langId]: [...liste, s] };
}

export function sujetsEtudies(etudies, langId) {
  const l = etudies && Array.isArray(etudies[langId]) ? etudies[langId] : [];
  return new Set(l.filter(x => typeof x === "string"));
}

// Avancement d'un niveau : { faits, total } — seuls les points du programme comptent.
export function avancementGrammaire(langId, level, etudies) {
  const prog = programmeGrammaire(langId, level);
  const vus = sujetsEtudies(etudies, langId);
  return { faits: prog.filter(p => vus.has(p)).length, total: prog.length };
}
