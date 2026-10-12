// Schéma allégé par tour et plafonds de jetons (#103).
import { test } from "node:test";
import assert from "node:assert/strict";

import { ASSESS_SCHEMA, MAX_TOKENS, RESPONSE_SCHEMA, schemaEvaluation, schemaTour } from "../app/core/schemas.js";
import { buildTutorPrompt } from "../app/core/prompts.js";
import { langConfig } from "../app/core/languages.js";

const cles = (s) => Object.keys(s.properties);
const coherent = (s) => {
  assert.deepEqual([...s.required].sort(), cles(s).sort(), "schéma strict : tout champ déclaré est requis");
  assert.equal(s.additionalProperties, false);
  assert.equal(cles(s)[0], "reply", "le streaming lit reply en tête");
};

test("schemaTour : premier tour d'une langue latine — missions demandées, rien à cocher, pas de reading", () => {
  const s = schemaTour({ lecture: false, nbMissions: 0 });
  coherent(s);
  assert.deepEqual(cles(s), ["reply", "translation", "correction", "suggestions", "cultural_note", "vocabulary", "missions"]);
  assert.deepEqual(Object.keys(s.properties.vocabulary.items.properties), ["term", "translation"]);
  assert.deepEqual(s.properties.vocabulary.items.required, ["term", "translation"]);
});

test("schemaTour : missions annoncées — on coche, on ne réannonce plus", () => {
  const s = schemaTour({ lecture: true, nbMissions: 3 });
  coherent(s);
  assert.ok(cles(s).includes("missions_accomplies"));
  assert.ok(!cles(s).includes("missions"));
  assert.ok(cles(s).includes("reading"));
  assert.equal(s.properties.vocabulary, RESPONSE_SCHEMA.properties.vocabulary, "écriture non latine : vocabulaire intact");
});

test("schemaTour : immersion — ni correction ni note culturelle (toujours null par consigne)", () => {
  const s = schemaTour({ lecture: false, immersion: true, nbMissions: 2 });
  coherent(s);
  assert.ok(!cles(s).includes("correction") && !cles(s).includes("cultural_note"));
  assert.ok(cles(s).includes("suggestions") && cles(s).includes("translation") && cles(s).includes("vocabulary"));
});

test("schemaTour : le schéma complet est inchangé (variante Claude et anciens appels)", () => {
  schemaTour({ lecture: false, immersion: true, nbMissions: 3 });
  assert.equal(cles(RESPONSE_SCHEMA).length, 9);
  assert.equal(Object.keys(RESPONSE_SCHEMA.properties.vocabulary.items.properties).length, 3);
  assert.equal(RESPONSE_SCHEMA.required.length, 9);
});

test("schemaEvaluation : reading retiré pour une langue latine seulement", () => {
  assert.equal(schemaEvaluation({ lecture: true }), ASSESS_SCHEMA);
  const s = schemaEvaluation({ lecture: false });
  coherent(s);
  assert.ok(!cles(s).includes("reading"));
  assert.ok(cles(s).includes("level") && cles(s).includes("done"));
});

test("MAX_TOKENS : plafonds bornés, au moins 3× le plus long mesuré le 12/10", () => {
  assert.ok(MAX_TOKENS.tour >= 3 * 210 && MAX_TOKENS.tour < 2048);
  assert.ok(MAX_TOKENS.resume >= 2 * 577 && MAX_TOKENS.resume < 2048);
  assert.ok(MAX_TOKENS.evaluation > 0 && MAX_TOKENS.explique > 0);
});

test("buildTutorPrompt : la consigne « reading » suit le schéma (absente pour une langue latine)", () => {
  const base = { level: "debutant", scenarioId: "cafe", immersion: false };
  const latin = buildTutorPrompt({ ...base, cfg: langConfig("catalan") });
  assert.doesNotMatch(latin, /"reading"/);
  assert.doesNotMatch(latin, /translittération/);
  const jp = buildTutorPrompt({ ...base, cfg: langConfig("japonais") });
  assert.match(jp, /"reading"/);
  assert.match(jp, /translittération latine/);
});

test("systemeJson : consigne de JSON minifié + schéma compact, système d'origine en tête", async () => {
  const { systemeJson, CONSIGNE_JSON } = await import("../app/core/api.js");
  const sys = systemeJson("Tu es Núria.", { type: "object", properties: { reply: { type: "string" } } });
  assert.ok(sys.startsWith("Tu es Núria.\n\nIMPORTANT : "));
  assert.ok(sys.includes(CONSIGNE_JSON));
  assert.match(sys, /MINIFIÉ/);
  assert.ok(sys.endsWith('{"type":"object","properties":{"reply":{"type":"string"}}}'));
});
