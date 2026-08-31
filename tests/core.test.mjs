// Tests unitaires du cœur partagé app/core — fonctions pures, node --test natif (#41).
import { test } from "node:test";
import assert from "node:assert/strict";

import { DAY_MS, addVocabulary, dueCards, gradeCard, computeStreak } from "../app/core/leitner.js";
import { normalizeTokens, lcsMatchedIndices, gradeAttempt } from "../app/core/diff.js";
import { LANGUAGES, BASE_SCENARIOS, langConfig } from "../app/core/languages.js";
import { LEVEL_INSTRUCTIONS, scenarioInstructions, buildTutorPrompt } from "../app/core/prompts.js";
import { extractJson, hasCredentials } from "../app/core/api.js";
import * as schemas from "../app/core/schemas.js";

const NOW = 1_756_600_000_000; // horodatage fixe pour des tests déterministes

// ---------- leitner.js ----------

test("addVocabulary : ajout en boîte 1, champs nettoyés", () => {
  const deck = addVocabulary([], "catalan", [{ term: "  gat ", translation: " chat " }], NOW);
  assert.equal(deck.length, 1);
  const c = deck[0];
  assert.equal(c.term, "gat");
  assert.equal(c.translation, "chat");
  assert.equal(c.box, 1);
  assert.equal(c.lang, "catalan");
  assert.equal(c.nextReview, NOW);
});

test("addVocabulary : dédoublonnage par terme+langue, insensible à la casse", () => {
  const deck = addVocabulary([], "catalan", [{ term: "Gat", translation: "chat" }], NOW);
  const deck2 = addVocabulary(deck, "catalan", [{ term: "  gat", translation: "chat" }], NOW);
  assert.equal(deck2.length, 1);
  // Même terme dans une autre langue : accepté.
  const deck3 = addVocabulary(deck2, "espagnol", [{ term: "gat", translation: "chat" }], NOW);
  assert.equal(deck3.length, 2);
});

test("addVocabulary : entrées invalides ignorées, deck jamais muté", () => {
  const deck = [];
  const out = addVocabulary(deck, "catalan", [null, { term: "x" }, { translation: "y" }], NOW);
  assert.equal(out.length, 0);
  assert.notEqual(out, deck); // nouveau tableau
  assert.equal(addVocabulary(deck, "catalan", [], NOW), deck); // liste vide → même référence
});

test("dueCards : ne retient que les cartes échues", () => {
  const deck = [
    { id: 1, nextReview: NOW - 1 },
    { id: 2, nextReview: NOW },
    { id: 3, nextReview: NOW + 1 },
  ];
  assert.deepEqual(dueCards(deck, NOW).map(c => c.id), [1, 2]);
});

test("gradeCard : réussite → boîte supérieure (plafond 5), échec → boîte 1", () => {
  const up = gradeCard({ box: 2 }, true, NOW);
  assert.equal(up.box, 3);
  assert.equal(up.nextReview, NOW + 4 * DAY_MS); // boîte 3 = 4 jours
  assert.equal(gradeCard({ box: 5 }, true, NOW).box, 5);
  const down = gradeCard({ box: 4 }, false, NOW);
  assert.equal(down.box, 1);
  assert.equal(down.nextReview, NOW + 1 * DAY_MS);
});

test("computeStreak : jours consécutifs, tolère l'absence d'aujourd'hui", () => {
  const today = new Date("2026-08-31T12:00:00");
  const jour = d => ({ date: new Date(`2026-08-${String(d).padStart(2, "0")}T10:00:00`).toISOString() });
  assert.equal(computeStreak([], today), 0);
  assert.equal(computeStreak([jour(31), jour(30), jour(29)], today), 3);
  // Pas encore pratiqué aujourd'hui : la série d'hier tient toujours.
  assert.equal(computeStreak([jour(30), jour(29)], today), 2);
  // Trou avant-hier : la série s'arrête.
  assert.equal(computeStreak([jour(31), jour(29)], today), 1);
});

// ---------- diff.js ----------

test("normalizeTokens : casse, ponctuation et apostrophes", () => {
  assert.deepEqual(normalizeTokens("Bonjour, ça va !", "catalan"), ["bonjour", "ça", "va"]);
  assert.deepEqual(normalizeTokens("L'amic d’en Pau.", "catalan"), ["l", "amic", "d", "en", "pau"]);
  assert.deepEqual(normalizeTokens("   ", "catalan"), []);
});

test("normalizeTokens : japonais caractère par caractère, sans espaces", () => {
  assert.deepEqual(normalizeTokens("こんに ちは。", "japonais"), ["こ", "ん", "に", "ち", "は"]);
});

test("normalizeTokens : diacritiques arabes (tachkil) retirés", () => {
  assert.deepEqual(normalizeTokens("مَرْحَبًا", "arabe"), ["مرحبا"]);
});

test("lcsMatchedIndices : alignement dans l'ordre", () => {
  assert.deepEqual([...lcsMatchedIndices(["a", "b", "c"], ["a", "b", "c"])].sort(), [0, 1, 2]);
  assert.deepEqual([...lcsMatchedIndices(["a", "b", "c"], [])], []);
  // « b » avant « a » dans la tentative : un seul des deux peut s'aligner.
  assert.equal(lcsMatchedIndices(["a", "b"], ["b", "a"]).size, 1);
});

test("gradeAttempt : score en pourcentage de jetons retrouvés", () => {
  const parfait = gradeAttempt("El gat menja peix.", "el gat menja peix", "catalan");
  assert.equal(parfait.score, 100);
  assert.equal(parfait.isCharBased, false);
  const partiel = gradeAttempt("el gat menja peix", "el gos menja", "catalan");
  assert.equal(partiel.score, 50); // el + menja retrouvés sur 4 jetons
  assert.equal(gradeAttempt("", "n'importe quoi", "catalan").score, 0);
  assert.equal(gradeAttempt("こんにちは", "こんにちは", "japonais").isCharBased, true);
});

// ---------- languages.js ----------

test("registre : 10 langues complètes et cohérentes", () => {
  const ids = Object.keys(LANGUAGES);
  assert.equal(ids.length, 10);
  for (const [id, cfg] of Object.entries(LANGUAGES)) {
    assert.ok(cfg.label, `${id} : label`);
    assert.ok(cfg.langFr, `${id} : langFr`);
    assert.ok(cfg.stt, `${id} : code de reconnaissance vocale`);
    assert.ok(Array.isArray(cfg.ttsPrefixes) && cfg.ttsPrefixes.length, `${id} : préfixes TTS`);
    assert.ok(cfg.tutor?.name && cfg.tutor?.city, `${id} : tuteur`);
    assert.ok(["full", "partial"].includes(cfg.support), `${id} : support`);
    if (cfg.support === "partial") assert.ok(cfg.supportNote, `${id} : supportNote requis si partiel`);
    assert.equal((cfg.scenarios || []).length, 3, `${id} : 3 scénarios culturels`);
  }
  assert.equal(BASE_SCENARIOS.length, 7);
});

test("langConfig : le tunisien suit l'écriture choisie", () => {
  const ar = langConfig("tunisien", "arabe");
  assert.equal(ar.rtl, true);
  assert.match(ar.reading, /arabizi/);
  assert.match(ar.promptExtra, /écriture arabe/);
  const latin = langConfig("tunisien", "latin");
  assert.equal(latin.rtl, false);
  assert.equal(latin.reading, null);
  assert.match(latin.promptExtra, /arabizi/);
  // Les autres langues sont renvoyées telles quelles.
  assert.equal(langConfig("catalan"), LANGUAGES.catalan);
});

// ---------- prompts.js ----------

test("scenarioInstructions : scénarios culturels et génériques", () => {
  const cfg = langConfig("catalan");
  assert.match(scenarioInstructions(cfg, "calcotada"), /calçots/i);
  const cafe = scenarioInstructions(cfg, "cafe");
  assert.match(cafe, /Barcelone/);
  assert.match(cafe, /serveuse/); // tutrice → accord féminin
  assert.match(scenarioInstructions(langConfig("anglais"), "cafe"), /serveur/);
});

test("buildTutorPrompt : niveaux, immersion et mode évaluation", () => {
  assert.deepEqual(Object.keys(LEVEL_INSTRUCTIONS).sort(), ["avance", "debutant", "intermediaire"]);
  const cfg = langConfig("catalan");
  const normal = buildTutorPrompt({ cfg, level: "debutant", scenarioId: "libre", immersion: false });
  assert.match(normal, /Núria/);
  assert.match(normal, /DÉBUTANT/);
  assert.match(normal, /"correction"/);
  const immersion = buildTutorPrompt({ cfg, level: "avance", scenarioId: "libre", immersion: true });
  assert.match(immersion, /IMMERSION TOTALE/);
  const evalMode = buildTutorPrompt({ cfg, mode: "eval", level: "debutant" });
  assert.match(evalMode, /CECRL/);
});

// ---------- api.js ----------

test("extractJson : fences, blocs <think> et texte parasite retirés", () => {
  assert.equal(extractJson('```json\n{"a": 1}\n```'), '{"a": 1}');
  assert.equal(extractJson('<think>blabla {pas ça}</think>Voici : {"a": {"b": 2}} merci'), '{"a": {"b": 2}}');
  assert.throws(() => extractJson("aucun objet ici"));
  assert.throws(() => extractJson('{"json": "invalide"')); // non fermé
});

test("hasCredentials : selon le fournisseur", () => {
  assert.equal(hasCredentials({ provider: "claude", apiKey: "sk-x" }), true);
  assert.equal(hasCredentials({ provider: "claude", apiKey: "" }), false);
  assert.equal(hasCredentials({ provider: "local", localUrl: "http://x", localModel: "m" }), true);
  assert.equal(hasCredentials({ provider: "local", localUrl: "http://x" }), false);
});

// ---------- schemas.js ----------

test("schémas : objets JSON Schema bien formés", () => {
  const attendus = ["RESPONSE_SCHEMA", "ASSESS_SCHEMA", "GRAMMAR_FICHE_SCHEMA", "GRAMMAR_MAP_SCHEMA", "EXO_SCHEMA"];
  for (const nom of attendus) {
    const s = schemas[nom];
    assert.equal(s?.type, "object", `${nom} : type object`);
    assert.ok(s.properties && Object.keys(s.properties).length, `${nom} : propriétés`);
  }
  for (const champ of ["reply", "translation", "suggestions", "correction", "vocabulary"]) {
    assert.ok(schemas.RESPONSE_SCHEMA.properties[champ], `RESPONSE_SCHEMA.${champ}`);
  }
});
