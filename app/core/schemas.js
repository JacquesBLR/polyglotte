// Schémas de sorties structurées — iso-fonctionnels avec l'app v1.

const READING_FIELD = {
  anyOf: [
    { type: "null" },
    { type: "string", description: "Translittération latine si écriture non latine." },
  ],
};

export const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "Réplique du tuteur dans la langue cible, 1 à 3 phrases prononçables." },
    translation: { type: "string", description: "Traduction française de reply." },
    reading: READING_FIELD,
    correction: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          properties: {
            original: { type: "string", description: "Ce que l'élève a dit, avec l'erreur." },
            corrected: { type: "string", description: "La version correcte dans la langue cible." },
            explanation: { type: "string", description: "Explication brève en français." },
          },
          required: ["original", "corrected", "explanation"],
          additionalProperties: false,
        },
      ],
    },
    suggestions: {
      type: "array",
      items: { type: "string" },
      description: "2 ou 3 réponses possibles dans la langue cible pour l'élève.",
    },
    cultural_note: {
      anyOf: [
        { type: "null" },
        { type: "string", description: "Brève note culturelle en français (1-2 phrases) liée à l'échange. Rare : au plus un tour sur trois." },
      ],
    },
    vocabulary: {
      type: "array",
      items: {
        type: "object",
        properties: {
          term: { type: "string", description: "Mot ou expression en langue cible." },
          translation: { type: "string", description: "Traduction française." },
          reading: READING_FIELD,
        },
        required: ["term", "translation", "reading"],
        additionalProperties: false,
      },
      description: "0 à 2 mots/expressions importants et nouveaux de cet échange, à mémoriser. Vide si rien de notable.",
    },
    // Missions de scénario (#91) — en fin de schéma : le streaming lit "reply" en tête.
    missions: {
      type: "array",
      items: { type: "string" },
      description: "Au message [START] uniquement : 3 missions EN FRANÇAIS, à l'infinitif (3 à 8 mots), que l'élève devra accomplir dans ce scénario. Tableau vide à tous les autres tours.",
    },
    missions_accomplies: {
      type: "array",
      items: { type: "integer" },
      description: "Numéros (1 à 3) des missions que l'élève vient d'accomplir dans son dernier message. Vide sinon.",
    },
  },
  required: ["reply", "translation", "reading", "correction", "suggestions", "cultural_note", "vocabulary", "missions", "missions_accomplies"],
  additionalProperties: false,
};

export const ASSESS_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "Question ou conclusion en langue cible, prononçable." },
    translation: { type: "string", description: "Traduction française de reply." },
    reading: READING_FIELD,
    done: { type: "boolean", description: "true quand le test est terminé." },
    level: {
      anyOf: [
        { type: "null" },
        { type: "string", enum: ["A1", "A2", "B1", "B2", "C1"] },
      ],
    },
    explanation: {
      anyOf: [{ type: "null" }, { type: "string", description: "Justification en français." }],
    },
  },
  required: ["reply", "translation", "reading", "done", "level", "explanation"],
  additionalProperties: false,
};

export const GRAMMAR_FICHE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Titre court de la fiche." },
    content: {
      type: "string",
      description: "Fiche en texte simple : explication en français, tableaux de conjugaison alignés en texte, exemples en langue cible avec traduction. Sauts de ligne pour la structure, pas de Markdown.",
    },
  },
  required: ["title", "content"],
  additionalProperties: false,
};

export const GRAMMAR_MAP_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Concept central de la carte mentale (court)." },
    nodes: {
      type: "array",
      description: "10 à 20 nœuds. parent = 0 pour les branches principales, sinon l'id d'un nœud déjà défini. Profondeur maximale : 3 niveaux.",
      items: {
        type: "object",
        properties: {
          id: { type: "integer", description: "Identifiant unique ≥ 1, croissant." },
          parent: { type: "integer", description: "0 pour la racine, sinon id du parent." },
          label: { type: "string", description: "Libellé très court (4 mots max)." },
          note: {
            anyOf: [{ type: "null" }, { type: "string", description: "Détail ou exemple (info-bulle)." }],
          },
        },
        required: ["id", "parent", "label", "note"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "nodes"],
  additionalProperties: false,
};

export const EXO_SCHEMA = {
  type: "object",
  properties: {
    sentences: {
      type: "array",
      description: "Exactement 5 phrases variées de la vie quotidienne, adaptées au niveau, prononçables.",
      items: {
        type: "object",
        properties: {
          text: { type: "string", description: "Phrase en langue cible." },
          reading: READING_FIELD,
        },
        required: ["text", "reading"],
        additionalProperties: false,
      },
    },
  },
  required: ["sentences"],
  additionalProperties: false,
};

// Résumé de séance structuré (#93) : le texte lisible reste affiché et lu ; les autres
// champs alimentent les carnets et l'historique.
export const SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    texte: { type: "string", description: "Le résumé pédagogique lisible, en français, en texte simple (sauts de ligne, pas de Markdown ni de tableau)." },
    points_forts: { type: "array", items: { type: "string" }, description: "2 ou 3 points forts de la séance, en français." },
    erreurs: {
      type: "array",
      description: "Les erreurs significatives de l'élève pendant la séance (0 à 5), les plus importantes d'abord.",
      items: {
        type: "object",
        properties: {
          original: { type: "string", description: "Ce que l'élève a dit, avec l'erreur." },
          corrected: { type: "string", description: "La version correcte dans la langue cible." },
          explanation: { type: "string", description: "Explication brève en français." },
        },
        required: ["original", "corrected", "explanation"],
        additionalProperties: false,
      },
    },
    vocabulaire: {
      type: "array",
      description: "Les mots et expressions importants de la séance (0 à 8).",
      items: {
        type: "object",
        properties: {
          term: { type: "string", description: "Mot ou expression en langue cible." },
          translation: { type: "string", description: "Traduction française." },
          reading: READING_FIELD,
        },
        required: ["term", "translation", "reading"],
        additionalProperties: false,
      },
    },
    phrases_a_reviser: { type: "array", items: { type: "string" }, description: "2 ou 3 phrases utiles à réviser, dans la langue cible." },
    conseil: { type: "string", description: "Un conseil concret pour la prochaine séance, en français, une phrase." },
    niveau_observe: {
      anyOf: [
        { type: "null" },
        { type: "string", enum: ["A1", "A2", "B1", "B2", "C1"] },
      ],
      description: "Le niveau CECRL effectivement montré par l'élève pendant cette séance (pas le niveau réglé). null si la séance est trop courte pour juger.",
    },
  },
  required: ["texte", "points_forts", "erreurs", "vocabulaire", "phrases_a_reviser", "conseil", "niveau_observe"],
  additionalProperties: false,
};
