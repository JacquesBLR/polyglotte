// Tests des histoires à écouter (#113).
import { test } from "node:test";
import assert from "node:assert/strict";

import { LONGUEUR, NB_QUESTIONS, demandeHistoire, histoireValide, schemaHistoire, scoreHistoire } from "../app/core/histoire.js";
import { langConfig } from "../app/core/languages.js";

const ok = {
  titre: "Le parapluie", texte: "La Marta surt de casa. Plou molt.", traduction: "Marta sort. Il pleut beaucoup.",
  questions: [
    { question: "Où est Marta ?", choix: ["Chez elle", "Au travail", "À la plage"], bonne: 0 },
    { question: "Quel temps fait-il ?", choix: ["Beau", "Il pleut", "Il neige"], bonne: 1 },
    { question: "Que fait-elle ?", choix: ["Elle dort", "Elle mange", "Elle sort"], bonne: 2 },
  ],
};

test("schemaHistoire : tous les champs requis ; reading seulement si translittération", () => {
  const latin = schemaHistoire({ lecture: false });
  assert.deepEqual(latin.required, Object.keys(latin.properties));
  assert.ok(!("reading" in latin.properties));
  const jp = schemaHistoire({ lecture: true });
  assert.ok("reading" in jp.properties && jp.required.includes("reading"));
  assert.deepEqual(Object.keys(jp.properties)[1], "texte", "le texte vient tôt, avant la traduction");
});

test("demandeHistoire : longueur au niveau, ville du tuteur, questions en français", () => {
  const cfg = langConfig("allemand");
  for (const lvl of Object.keys(LONGUEUR)) {
    const d = demandeHistoire({ cfg, level: lvl });
    assert.ok(d.includes(LONGUEUR[lvl]) && d.includes("Berlin") && d.includes(cfg.langFr));
    assert.match(d, new RegExp(`${NB_QUESTIONS} questions de compréhension EN FRANÇAIS`));
  }
  assert.ok(demandeHistoire({ cfg, level: "inconnu" }).includes(LONGUEUR.debutant));
});

test("histoireValide : histoire correcte conservée, champs nettoyés", () => {
  const h = histoireValide({ ...ok, texte: "  " + ok.texte + " " });
  assert.equal(h.texte, ok.texte);
  assert.equal(h.reading, null);
  assert.equal(h.questions.length, 3);
  assert.equal(h.questions[1].bonne, 1);
});

test("histoireValide : rejets et questions malformées écartées sans exception", () => {
  assert.equal(histoireValide(null), null);
  assert.equal(histoireValide([]), null);
  assert.equal(histoireValide({ ...ok, texte: "" }), null, "pas de texte");
  assert.equal(histoireValide({ ...ok, questions: [] }), null, "pas de question exploitable");
  const h = histoireValide({
    ...ok,
    questions: [
      { question: "Hors bornes", choix: ["a", "b", "c"], bonne: 3 },
      { question: "Indice non entier", choix: ["a", "b", "c"], bonne: "1" },
      { question: "", choix: ["a", "b"], bonne: 0 },
      { question: "Un seul choix distinct", choix: ["a", "A", " a "], bonne: 0 },
      { question: "Bonne réponse vide", choix: ["", "b", "c"], bonne: 0 },
      null,
      ok.questions[0],
    ],
  });
  assert.equal(h.questions.length, 1);
  assert.equal(h.questions[0].question, "Où est Marta ?");
});

test("histoireValide : l'indice suit la bonne réponse après dédoublonnage des choix", () => {
  const h = histoireValide({ ...ok, questions: [{ question: "Q", choix: ["Oui", "oui", "Non"], bonne: 2 }] });
  assert.deepEqual(h.questions[0].choix, ["Oui", "Non"]);
  assert.equal(h.questions[0].bonne, 1);
  assert.equal(h.questions[0].choix[h.questions[0].bonne], "Non");
});

test("histoireValide : au plus NB_QUESTIONS questions", () => {
  const h = histoireValide({ ...ok, questions: [...ok.questions, ...ok.questions] });
  assert.equal(h.questions.length, NB_QUESTIONS);
});

test("scoreHistoire : justes / total / pourcentage, réponses absentes = fausses", () => {
  const h = histoireValide(ok);
  assert.deepEqual(scoreHistoire(h, [0, 1, 2]), { justes: 3, total: 3, pourcent: 100 });
  assert.deepEqual(scoreHistoire(h, [0, 0]), { justes: 1, total: 3, pourcent: 33 });
  assert.deepEqual(scoreHistoire(h, null), { justes: 0, total: 3, pourcent: 0 });
  assert.deepEqual(scoreHistoire(null, [0]), { justes: 0, total: 0, pourcent: 0 });
});

test("histoireValide : bonne réponse doublon à la casse près (relecture du soir)", () => {
  const h = histoireValide({ texte: "x", questions: [{ question: "Où ?", choix: ["Paris", "paris", "Lyon"], bonne: 1 }] });
  assert.equal(h.questions[0].bonne, 0);
  assert.deepEqual(scoreHistoire(h, [0]), { justes: 1, total: 1, pourcent: 100 });
});
