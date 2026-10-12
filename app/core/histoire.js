// Histoires à écouter (#113) — compréhension orale, fonctions pures.
//
// L'app entraînait à parler et à transcrire, pas à comprendre un texte suivi à l'oreille.
// Modèle : Duolingo Stories (une courte histoire au niveau, lue à voix haute, avec des
// questions de compréhension à choix multiple), les Podcasts de Babbel, et Pimsleur (l'oreille
// d'abord, l'écrit ensuite). Le tuteur raconte ; le texte reste masqué tant que l'élève ne
// le demande pas ; trois questions EN FRANÇAIS, corrigées localement, sans second appel.

export const NB_QUESTIONS = 3;

// Longueur de l'histoire par niveau de l'app (en phrases).
export const LONGUEUR = {
  debutant: "4 à 5 phrases très courtes, au présent, vocabulaire de base",
  intermediaire: "6 à 8 phrases, temps du passé inclus, quelques connecteurs",
  avance: "8 à 10 phrases riches : registres variés, sous-entendus, une expression idiomatique",
};

const READING = {
  anyOf: [{ type: "null" }, { type: "string", description: "Translittération latine de l'histoire." }],
};

// Schéma de l'histoire ; sans `reading` en alphabet latin (même règle que le tour, #103).
export function schemaHistoire({ lecture = true } = {}) {
  const properties = {
    titre: { type: "string", description: "Titre court de l'histoire, en français." },
    texte: { type: "string", description: "L'histoire en langue cible, texte prononçable (pas de listes ni d'emojis)." },
    ...(lecture ? { reading: READING } : {}),
    traduction: { type: "string", description: "Traduction française fidèle de l'histoire." },
    questions: {
      type: "array",
      description: `Exactement ${NB_QUESTIONS} questions de compréhension EN FRANÇAIS, dans l'ordre du récit.`,
      items: {
        type: "object",
        properties: {
          question: { type: "string", description: "La question, en français." },
          choix: { type: "array", items: { type: "string" }, description: "3 réponses possibles en français, une seule juste." },
          bonne: { type: "integer", description: "Indice (0, 1 ou 2) de la bonne réponse dans choix." },
        },
        required: ["question", "choix", "bonne"],
        additionalProperties: false,
      },
    },
  };
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

// Demande au modèle (message utilisateur ; le système est exoSystemPrompt).
export function demandeHistoire({ cfg, level }) {
  return `Raconte une courte histoire en ${cfg.langFr} pour un élève francophone, qui va l'ÉCOUTER sans la lire.
Longueur : ${LONGUEUR[level] || LONGUEUR.debutant}. Elle se passe à ${cfg.tutor.city}, dans la vie quotidienne, avec un
personnage, un petit problème et sa résolution. Puis pose ${NB_QUESTIONS} questions de compréhension EN FRANÇAIS, chacune
avec 3 réponses possibles en français dont une seule est juste (les deux autres plausibles mais contredites par
l'histoire) ; varie la place de la bonne réponse. Les questions portent sur le sens (qui, où, pourquoi, que se passe-t-il),
pas sur un mot isolé.`;
}

const chaine = (v) => (typeof v === "string" ? v.trim() : "");

// Normalise l'histoire rendue par le modèle ; null si elle n'est pas exploitable. Une
// question est gardée si elle a au moins 2 choix distincts et un indice de bonne réponse
// dans les bornes (après dédoublonnage des choix, l'indice suit la bonne réponse).
export function histoireValide(data) {
  if (!data || typeof data !== "object") return null;
  const texte = chaine(data.texte);
  if (!texte) return null;
  const questions = [];
  for (const q of Array.isArray(data.questions) ? data.questions : []) {
    if (!q || typeof q !== "object") continue;
    const question = chaine(q.question);
    const brut = Array.isArray(q.choix) ? q.choix.map(chaine) : [];
    if (!question || !Number.isInteger(q.bonne) || q.bonne < 0 || q.bonne >= brut.length || !brut[q.bonne]) continue;
    const juste = brut[q.bonne];
    const vus = new Set();
    const choix = brut.filter(c => c && !vus.has(c.toLowerCase()) && vus.add(c.toLowerCase()));
    if (choix.length < 2) continue;
    // Casse ignorée (le dédoublonnage aussi) : « Paris » / « paris » avec bonne = 1 rendait -1
    // (relecture du soir, #113).
    const bonne = choix.findIndex(c => c.toLowerCase() === juste.toLowerCase());
    if (bonne < 0) continue;
    questions.push({ question, choix, bonne });
  }
  if (!questions.length) return null;
  return {
    titre: chaine(data.titre) || "Histoire",
    texte,
    reading: chaine(data.reading) || null,
    traduction: chaine(data.traduction),
    questions: questions.slice(0, NB_QUESTIONS),
  };
}

// Score : { justes, total, pourcent }. `reponses[i]` = indice choisi pour la question i.
export function scoreHistoire(histoire, reponses) {
  const qs = histoire?.questions || [];
  const justes = qs.filter((q, i) => Array.isArray(reponses) && reponses[i] === q.bonne).length;
  return { justes, total: qs.length, pourcent: qs.length ? Math.round((100 * justes) / qs.length) : 0 };
}
