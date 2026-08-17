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
  },
  required: ["reply", "translation", "reading", "correction", "suggestions", "cultural_note", "vocabulary"],
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
