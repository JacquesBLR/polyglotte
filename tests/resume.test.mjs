// Tests du résumé de séance structuré (#93).
import { test } from "node:test";
import assert from "node:assert/strict";

import { ajouteErreur } from "../app/core/erreurs.js";
import { addVocabulary } from "../app/core/leitner.js";
import { langConfig } from "../app/core/languages.js";
import { summaryRequest } from "../app/core/prompts.js";
import {
  NIVEAUX_CECRL, TEXTE_MAX, entreeResume, integreResume, niveauxObserves, resumeValide, tendanceNiveau,
} from "../app/core/resume.js";
import { SUMMARY_SCHEMA } from "../app/core/schemas.js";

const NOW = Date.UTC(2026, 9, 12, 8, 0, 0);
const brut = () => ({
  texte: "Belle séance. Tu as commandé un café et demandé le prix.",
  points_forts: ["Salutations naturelles", " Bonne prononciation "],
  erreurs: [
    { original: "jo veig vi", corrected: "jo bec vi", explanation: "veure = voir, beure = boire" },
    { original: "", corrected: "x", explanation: "" },
    null,
  ],
  vocabulaire: [{ term: "tallat", translation: "café noisette", reading: null }, { term: "", translation: "rien" }],
  phrases_a_reviser: ["Quant costa?", ""],
  conseil: "Travaille les nombres jusqu'à 100.",
  niveau_observe: "a2",
});

test("resumeValide : normalise, filtre les entrées vides, met le niveau en majuscules", () => {
  const r = resumeValide(brut());
  assert.equal(r.texte, "Belle séance. Tu as commandé un café et demandé le prix.");
  assert.deepEqual(r.points_forts, ["Salutations naturelles", "Bonne prononciation"]);
  assert.equal(r.erreurs.length, 1);
  assert.equal(r.vocabulaire.length, 1);
  assert.deepEqual(r.phrases_a_reviser, ["Quant costa?"]);
  assert.equal(r.niveau_observe, "A2");
});

test("resumeValide : sans texte ou hors format, null ; niveau inconnu → null, le reste survit", () => {
  assert.equal(resumeValide(null), null);
  assert.equal(resumeValide("du texte"), null);
  assert.equal(resumeValide({ texte: "   " }), null);
  const r = resumeValide({ texte: "ok", niveau_observe: "Z9" });
  assert.equal(r.niveau_observe, null);
  assert.deepEqual(r.erreurs, []);
  assert.deepEqual(r.vocabulaire, []);
  assert.equal(r.conseil, "");
});

test("integreResume : verse erreurs et vocabulaire aux carnets, sans doublon, sans mutation", () => {
  const r = resumeValide(brut());
  const deck0 = addVocabulary([], "catalan", [{ term: "tallat", translation: "café noisette", reading: null }], NOW - 1);
  const carnet0 = [];
  const { deck, carnet } = integreResume(deck0, carnet0, r, "catalan", NOW);
  assert.equal(deck, deck0, "le mot était déjà au carnet : même tableau rendu");
  assert.equal(carnet.length, 1);
  assert.equal(carnet[0].corrected, "jo bec vi");
  assert.equal(carnet0.length, 0, "jamais de mutation");
  // Deuxième intégration du même résumé : rien ne bouge.
  const encore = integreResume(deck, carnet, r, "catalan", NOW + 1);
  assert.equal(encore.deck, deck);
  assert.equal(encore.carnet, carnet);
  // Autre langue : l'erreur est une autre carte ; résumé nul : identité.
  assert.equal(integreResume(deck, carnet, r, "espagnol", NOW).carnet.length, 2);
  assert.equal(integreResume(deck, carnet, null, "catalan", NOW).carnet, carnet);
  // Une erreur déjà au carnet par la conversation (#87) n'est pas doublée par le résumé.
  const carnetConv = ajouteErreur([], "catalan", { original: "jo veig vi", corrected: "Jo bec vi", explanation: "" }, NOW);
  assert.equal(integreResume([], carnetConv, r, "catalan", NOW).carnet, carnetConv);
});

test("entreeResume : compact, texte borné", () => {
  const r = resumeValide(brut());
  const e = entreeResume(r);
  assert.equal(e.texte, r.texte);
  assert.equal(e.nbErreurs, 1);
  assert.equal(e.nbMots, 1);
  assert.equal(e.conseil, r.conseil);
  const long = resumeValide({ ...brut(), texte: "x".repeat(TEXTE_MAX + 500) });
  assert.equal(entreeResume(long).texte.length, TEXTE_MAX);
  assert.ok(entreeResume(long).texte.endsWith("…"));
  assert.equal(entreeResume(null), null);
});

test("niveauxObserves et tendanceNiveau : ordre chronologique, par langue, deux observations au moins", () => {
  const history = [
    { id: 1, date: NOW - 4e8, lang: "catalan", niveauObserve: "A1" },
    { id: 2, date: NOW - 3e8, lang: "catalan" }, // séance sans résumé
    { id: 3, date: NOW - 2e8, lang: "catalan", niveauObserve: "A2" },
    { id: 4, date: NOW - 1e8, lang: "espagnol", niveauObserve: "B2" },
    { id: 5, date: NOW, lang: "catalan", niveauObserve: "A2" },
    null,
  ];
  assert.deepEqual(niveauxObserves(history).map(o => o.niveau), ["A1", "A2", "B2", "A2"]);
  assert.deepEqual(tendanceNiveau(history, "catalan"), { de: "A1", a: "A2", n: 3, sens: 1 });
  assert.equal(tendanceNiveau(history, "espagnol"), null, "une seule observation");
  assert.deepEqual(tendanceNiveau(history), { de: "A1", a: "A2", n: 4, sens: 1 });
  assert.equal(tendanceNiveau(history, "catalan", 2).sens, 0, "sur les deux dernières : stable");
  assert.equal(tendanceNiveau([], null), null);
  assert.deepEqual(NIVEAUX_CECRL, ["A1", "A2", "B1", "B2", "C1"]);
});

test("SUMMARY_SCHEMA et summaryRequest : les champs attendus sont déclarés, requis et expliqués", () => {
  const champs = ["texte", "points_forts", "erreurs", "vocabulaire", "phrases_a_reviser", "conseil", "niveau_observe"];
  for (const c of champs) {
    assert.ok(SUMMARY_SCHEMA.properties[c], `SUMMARY_SCHEMA.${c}`);
    assert.ok(SUMMARY_SCHEMA.required.includes(c), `${c} requis (schéma strict)`);
  }
  assert.deepEqual(SUMMARY_SCHEMA.properties.niveau_observe.anyOf[1].enum, NIVEAUX_CECRL);
  const demande = summaryRequest({ cfg: langConfig("japonais") });
  for (const c of champs) assert.match(demande, new RegExp(`"${c}"`));
  assert.match(demande, /translittération/);
  assert.doesNotMatch(summaryRequest({ cfg: langConfig("catalan") }), /translittération/);
});
