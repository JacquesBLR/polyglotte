// Tests de « Répète après moi » (#95).
import { test } from "node:test";
import assert from "node:assert/strict";

import { appreciation, integreScore, moyennePrononciation, scorePrononciation } from "../app/core/prononciation.js";

test("scorePrononciation : alignement mot à mot, mots manqués listés, entendu conservé", () => {
  const r = scorePrononciation("Bon dia! Vols un cafè amb llet?", " bon dia vols un café amb llet ", "catalan");
  assert.equal(r.tokens.length, 7);
  assert.deepEqual(r.reconnus, [true, true, true, true, false, true, true]);
  assert.deepEqual(r.manques, ["cafè"]);
  assert.equal(r.score, 86);
  assert.equal(r.entendu, "bon dia vols un café amb llet");
  assert.equal(r.isCharBased, false);
});

test("scorePrononciation : rien entendu → 0, tout → 100, japonais caractère par caractère", () => {
  assert.equal(scorePrononciation("Hola, què tal?", "", "catalan").score, 0);
  assert.equal(scorePrononciation("Hola, què tal?", "hola què tal", "catalan").score, 100);
  const ja = scorePrononciation("こんにちは。", "こんにちは", "japonais");
  assert.equal(ja.score, 100);
  assert.equal(ja.isCharBased, true);
  assert.equal(ja.tokens.length, 5);
});

test("appreciation : paliers", () => {
  assert.match(appreciation(100), /Parfait/);
  assert.match(appreciation(86), /Très bien/);
  assert.match(appreciation(50), /Pas mal/);
  assert.match(appreciation(20), /Encore un essai/);
});

test("integreScore : moyenne et meilleur cumulés, sans mutation ; entrée ou score invalides ignorés", () => {
  const e0 = { id: "s", date: 1, turns: 3 };
  const e1 = integreScore(e0, 60);
  assert.deepEqual(e1.prononciation, { n: 1, somme: 60, moyenne: 60, meilleur: 60 });
  assert.equal(e0.prononciation, undefined, "l'original n'est pas muté");
  const e2 = integreScore(e1, 100);
  assert.deepEqual(e2.prononciation, { n: 2, somme: 160, moyenne: 80, meilleur: 100 });
  const e3 = integreScore(e2, 71);
  assert.deepEqual(e3.prononciation, { n: 3, somme: 231, moyenne: 77, meilleur: 100 });
  assert.equal(integreScore(e3, "abc"), e3);
  assert.equal(integreScore(null, 50), null);
});

test("moyennePrononciation : pondérée par les essais, sur les dernières séances mesurées", () => {
  const history = [
    { id: 1, date: 10, prononciation: { n: 1, moyenne: 40, meilleur: 40 } }, // la plus ancienne, hors fenêtre de 2
    { id: 2, date: 20 }, // sans mesure
    { id: 3, date: 30, prononciation: { n: 3, moyenne: 90, meilleur: 100 } },
    { id: 4, date: 40, prononciation: { n: 1, moyenne: 50, meilleur: 50 } },
    null,
  ];
  assert.equal(moyennePrononciation(history, 2), 80, "(90×3 + 50×1) / 4");
  assert.equal(moyennePrononciation(history), 72, "(40×1 + 90×3 + 50×1) / 5");
  assert.equal(moyennePrononciation([{ id: 2, date: 20 }]), null);
  assert.equal(moyennePrononciation([]), null);
});
