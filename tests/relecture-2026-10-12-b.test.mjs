// Relecture adverse du 2026-10-12, 4e passe (#99, #100, #102, #104) : un test de
// reproduction par défaut confirmé, rouge sur l'ancien code.
import { test } from "node:test";
import assert from "node:assert/strict";

import { callClaude, callLocal, extractJson, MSG_TRONQUE } from "../app/core/api.js";
import { streamLocalChat } from "../app/core/stream.js";
import { ajouteErreur } from "../app/core/erreurs.js";
import { consigneExplication, explicationConsignee } from "../app/core/explique.js";
import { ajouteMesure, mesure, SEUILS, statsLatence } from "../app/core/latence.js";
import { schemaTour } from "../app/core/schemas.js";
import { scorePrononciation } from "../app/core/prononciation.js";

const SETTINGS = { provider: "local", localUrl: "http://moteur.test/v1", localModel: "m" };
const SCHEMA = { type: "object", properties: { reply: { type: "string" } }, required: ["reply"] };
const COUPE = '{"reply":"Hola! Com estàs? Avui parlarem de'; // JSON coupé net

const avecFetch = async (faux, f) => {
  const avant = globalThis.fetch;
  globalThis.fetch = faux;
  try { return await f(); } finally { globalThis.fetch = avant; }
};
const flux = (evenements) => {
  const enc = new TextEncoder();
  const morceaux = evenements.map(e => enc.encode(`data: ${typeof e === "string" ? e : JSON.stringify(e)}\n\n`));
  return {
    ok: true, status: 200,
    body: { getReader: () => ({ read: async () => (morceaux.length ? { done: false, value: morceaux.shift() } : { done: true }) }) },
  };
};
const json = (o) => ({ ok: true, status: 200, json: async () => o });

test("T1 : flux coupé par max_tokens → erreur « coupée », marquée, avec le texte reçu", async () => {
  const err = await avecFetch(async () => flux([
    { choices: [{ delta: { content: COUPE } }] },
    { choices: [{ delta: {}, finish_reason: "length" }] },
    "[DONE]",
  ]), () => streamLocalChat(SETTINGS, { messages: [], system: "s", schema: SCHEMA, maxTokens: 10 }).then(() => null, e => e));
  assert.ok(err, "doit lever");
  assert.equal(err.tronque, true);
  assert.equal(err.message, MSG_TRONQUE);
  assert.equal(err.partiel, COUPE);
});

test("T1 : flux coupé même quand le JSON reçu se referme par hasard → toujours « coupée »", async () => {
  const err = await avecFetch(async () => flux([
    { choices: [{ delta: { content: '{"reply":"a"}' }, finish_reason: "length" }] },
  ]), () => streamLocalChat(SETTINGS, { messages: [], system: "s", schema: SCHEMA }).then(() => null, e => e));
  assert.equal(err?.tronque, true);
});

test("T1 : appel non streamé coupé (finish_reason length) → erreur « coupée »", async () => {
  const err = await avecFetch(async () => json({ choices: [{ message: { content: COUPE }, finish_reason: "length" }] }),
    () => callLocal(SETTINGS, { messages: [], system: "s", schema: SCHEMA }).then(() => null, e => e));
  assert.equal(err?.tronque, true);
  // Sans schéma (texte libre), une réponse longue n'est pas une erreur.
  const texte = await avecFetch(async () => json({ choices: [{ message: { content: "long texte" }, finish_reason: "length" }] }),
    () => callLocal(SETTINGS, { messages: [], system: "s" }));
  assert.equal(texte, "long texte");
});

test("T1 : JSON invalide → message en français, plus le message du moteur JS", () => {
  assert.throws(() => extractJson('{"a":[1,2 "b"}'), /JSON invalide/);
});

test("T2 : Claude coupé par max_tokens avec un schéma → erreur « coupée », pas de JSON brut rendu", async () => {
  const err = await avecFetch(async () => json({ stop_reason: "max_tokens", content: [{ type: "text", text: '{"texte":"Bilan : tu as' }] }),
    () => callClaude({ apiKey: "k", model: "claude-haiku-4-5" }, { messages: [], system: "s", schema: SCHEMA }).then(() => null, e => e));
  assert.equal(err?.tronque, true);
});

test("X1 : deux erreurs de même forme corrigée ne partagent pas leur explication", () => {
  const conj = { original: "Jo vol un cafè", corrected: "Jo vull un cafè", explanation: "conjugaison" };
  const genre = { original: "Jo vull una cafè", corrected: "Jo vull un cafè", explanation: "genre" };
  const carnet = consigneExplication(ajouteErreur([], "catalan", conj, 1), "catalan", conj, { title: "Conjugaison de voler", content: "…" }, "debutant", 2);
  assert.equal(explicationConsignee(carnet, "catalan", conj, "debutant")?.title, "Conjugaison de voler");
  assert.equal(explicationConsignee(carnet, "catalan", genre, "debutant"), null, "autre faute : on redemande");
  // Explication consignée avant ce correctif (sans `original`) : vaut pour l'original de l'entrée.
  const ancien = [{ ...carnet[0], explique: { title: "x", content: "y", level: "debutant", at: 2 } }];
  assert.equal(explicationConsignee(ancien, "catalan", conj, "debutant")?.title, "x");
  assert.equal(explicationConsignee(ancien, "catalan", genre, "debutant"), null);
});

test("L1 : le test de niveau a sa nature ; le premier mot ne compte que les appels streamés", () => {
  assert.ok(SEUILS.evaluation);
  let j = [];
  for (let i = 0; i < 2; i++) j = ajouteMesure(j, mesure("tour", { premierJeton: 1000, total: 9000 }, { stream: true }));
  for (let i = 0; i < 3; i++) j = ajouteMesure(j, mesure("tour", { premierJeton: 9000, total: 9000 }, { stream: false }));
  assert.equal(statsLatence(j, "tour").premierJeton, 1000);
  assert.equal(statsLatence(j, "tour").n, 5);
  const ev = ajouteMesure([], mesure("evaluation", { premierJeton: 9000, total: 9000 }));
  assert.equal(ev.length, 1, "mesure d'évaluation journalisée");
  assert.equal(statsLatence(ev, "evaluation").premierJeton, null);
});

test("M5 : la description du champ missions n'interdit plus le rattrapage au tour suivant", () => {
  const d = schemaTour({ nbMissions: 0 }).properties.missions.description;
  assert.doesNotMatch(d, /uniquement/);
  assert.doesNotMatch(d, /vide à tous les autres tours/);
});

test("P6b : drapeaux et touches numérotées ne sont pas des mots à prononcer", () => {
  assert.equal(scorePrononciation("Visca Catalunya 🇪🇸!", "visca catalunya", "catalan").score, 100);
  assert.equal(scorePrononciation("Tinc 1️⃣ gat 😺", "tinc gat", "catalan").score, 100);
});

test("M5 : missions absentes après le [START] → le prompt les exige à ce tour-ci", async () => {
  const { blocMissionsPrompt } = await import("../app/core/mission.js");
  const { buildTutorPrompt } = await import("../app/core/prompts.js");
  const { langConfig } = await import("../app/core/languages.js");
  assert.match(blocMissionsPrompt("debutant", [], true), /pas encore annoncé.*À CE TOUR-CI/s);
  assert.doesNotMatch(blocMissionsPrompt("debutant", ["Saluer"], true), /pas encore annoncé/, "liste connue : réinjection");
  assert.equal(blocMissionsPrompt("inconnu", [], true), "");
  const p = buildTutorPrompt({ cfg: langConfig("catalan"), level: "debutant", scenarioId: "cafe", mode: "chat", missionsEnRetard: true });
  assert.match(p, /À CE TOUR-CI/);
  const q = buildTutorPrompt({ cfg: langConfig("catalan"), level: "debutant", scenarioId: "cafe", mode: "chat" });
  assert.doesNotMatch(q, /À CE TOUR-CI/);
});
