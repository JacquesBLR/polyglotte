// Tests de « Explique-moi » (#97).
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CECRL_PAR_NIVEAU, consigneExplication, expliqueRequete, expliqueValide, explicationConsignee,
} from "../app/core/explique.js";
import { ajouteErreur, cleErreur } from "../app/core/erreurs.js";
import { langConfig } from "../app/core/languages.js";
import { EXPLAIN_SCHEMA, GRAMMAR_FICHE_SCHEMA } from "../app/core/schemas.js";

const NOW = Date.UTC(2026, 9, 12, 9, 0, 0);
const cfg = langConfig("catalan");
const corr = { original: "jo veig vi", corrected: "jo bec vi", explanation: "verbe beure" };
const bonne = {
  title: "Le verbe beure",
  content: "Pour « boire », le catalan dit beure. Veure veut dire voir.",
  exemple: "Jo bec aigua. (Je bois de l'eau.)",
  contre_exemple: "Jo veig aigua : « je vois de l'eau », pas « je bois ».",
};

test("EXPLAIN_SCHEMA dérive de GRAMMAR_FICHE_SCHEMA : mêmes champs, plus exemple et contre-exemple", () => {
  for (const k of GRAMMAR_FICHE_SCHEMA.required) assert.ok(EXPLAIN_SCHEMA.required.includes(k));
  assert.deepEqual(EXPLAIN_SCHEMA.required, ["title", "content", "exemple", "contre_exemple"]);
  assert.equal(EXPLAIN_SCHEMA.properties.title, GRAMMAR_FICHE_SCHEMA.properties.title);
  assert.equal(EXPLAIN_SCHEMA.additionalProperties, false);
  // Le schéma d'origine n'est pas modifié par la dérivation.
  assert.deepEqual(Object.keys(GRAMMAR_FICHE_SCHEMA.properties), ["title", "content"]);
  // Sortie structurée stricte : chaque propriété est requise.
  assert.deepEqual(Object.keys(EXPLAIN_SCHEMA.properties).sort(), [...EXPLAIN_SCHEMA.required].sort());
});

test("expliqueRequete : niveau CECRL de l'élève, correction citée, langue cible nommée", () => {
  for (const [level, cecrl] of Object.entries(CECRL_PAR_NIVEAU)) {
    const { system, messages } = expliqueRequete({ cfg, level, correction: corr });
    assert.equal(messages.length, 1);
    assert.equal(messages[0].role, "user");
    assert.ok(messages[0].content.includes(`niveau ${cecrl}`), level);
    assert.ok(messages[0].content.includes("« jo veig vi »"));
    assert.ok(messages[0].content.includes("« jo bec vi »"));
    assert.ok(messages[0].content.includes(cfg.langFr));
    assert.ok(system.includes(cfg.langFr));
  }
});

test("expliqueRequete : niveau inconnu → débutant, jamais « undefined » dans le prompt", () => {
  const { system, messages } = expliqueRequete({ cfg, level: "expert", correction: { original: "a", corrected: "b" } });
  assert.ok(messages[0].content.includes("A1–A2"));
  assert.ok(!system.includes("undefined"));
  assert.ok(!messages[0].content.includes("undefined"));
  assert.ok(!messages[0].content.includes("Correction donnée"), "sans explication, pas de ligne vide");
});

test("expliqueValide : JSON conforme, objet, champs nettoyés", () => {
  assert.deepEqual(expliqueValide(JSON.stringify(bonne)), bonne);
  assert.deepEqual(expliqueValide({ ...bonne, title: "  Le verbe beure  " }), bonne);
});

test("expliqueValide : réponse inexploitable → null (la correction reste intacte côté appelant)", () => {
  for (const raw of [null, undefined, "", "pas du json", "[]", "42", JSON.stringify({ title: "x" }),
    JSON.stringify({ ...bonne, content: "   " }), JSON.stringify({ ...bonne, content: 12 })]) {
    assert.equal(expliqueValide(raw), null, String(raw));
  }
});

test("expliqueValide : contre-exemple manquant toléré, champs trop longs tronqués", () => {
  const v = expliqueValide({ title: "t", content: "c", exemple: null });
  assert.deepEqual(v, { title: "t", content: "c", exemple: "", contre_exemple: "" });
  const long = expliqueValide({ ...bonne, content: "x".repeat(5000) });
  assert.ok(long.content.length <= 600);
  assert.ok(long.content.endsWith("…"));
});

test("consigneExplication : rattachée à l'entrée du carnet, sans muter, et relue par explicationConsignee", () => {
  const carnet = ajouteErreur([], "catalan", corr, NOW);
  const next = consigneExplication(carnet, "catalan", { ...corr, corrected: "Jo  bec vi" }, bonne, "debutant", NOW + 5);
  assert.notEqual(next, carnet);
  assert.equal(next.length, 1);
  assert.equal(carnet[0].explique, undefined, "le carnet d'origine n'est pas muté");
  assert.deepEqual(next[0].explique, { ...bonne, level: "debutant", at: NOW + 5, original: cleErreur(corr.original) });
  assert.equal(next[0].nextReview, carnet[0].nextReview, "la planification FSRS n'est pas touchée");
  assert.deepEqual(explicationConsignee(next, "catalan", corr, "debutant"), next[0].explique);
  assert.equal(explicationConsignee(next, "catalan", corr, "avance"), null, "autre niveau : on redemande");
  assert.equal(explicationConsignee(next, "espagnol", corr, "debutant"), null, "autre langue : autre erreur");
});

test("consigneExplication : correction absente du carnet → ajoutée puis expliquée", () => {
  const next = consigneExplication([], "catalan", corr, bonne, "intermediaire", NOW);
  assert.equal(next.length, 1);
  assert.equal(next[0].corrected, "jo bec vi");
  assert.equal(next[0].explique.level, "intermediaire");
});

test("consigneExplication : explication ou correction inexploitable → carnet rendu tel quel", () => {
  const carnet = ajouteErreur([], "catalan", corr, NOW);
  assert.equal(consigneExplication(carnet, "catalan", corr, null, "debutant", NOW), carnet);
  assert.equal(consigneExplication(carnet, "catalan", { original: "x", corrected: "x" }, bonne, "debutant", NOW), carnet);
  assert.equal(consigneExplication(carnet, "catalan", null, bonne, "debutant", NOW), carnet);
});
