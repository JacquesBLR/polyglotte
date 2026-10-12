// Tests du personnage mystère (#105).
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  METIERS, NB_CHOIX, SCENARIO_MYSTERE, blocMystere, devine, entreeMystere, expurge, intitule, messageRevelation,
  nbMysteresTrouves, tireMystere, trahit,
} from "../app/core/mystere.js";
import { BASE_SCENARIOS, langConfig } from "../app/core/languages.js";
import { buildTutorPrompt } from "../app/core/prompts.js";
import { schemaTour } from "../app/core/schemas.js";

// Générateur pseudo-aléatoire déterministe (LCG).
const lcg = (graine) => () => ((graine = (graine * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);

test("tireMystere : 6 choix distincts du catalogue, le secret en fait partie", () => {
  for (let g = 1; g <= 300; g++) {
    const m = tireMystere(lcg(g));
    assert.equal(m.choix.length, NB_CHOIX);
    assert.equal(new Set(m.choix).size, NB_CHOIX);
    assert.ok(m.choix.includes(m.secret));
    for (const id of m.choix) assert.ok(METIERS.some(x => x.id === id));
    assert.equal(m.revele, null);
  }
});

test("tireMystere : tout le catalogue sort comme secret, à toutes les positions ; aléa aux bornes toléré", () => {
  const secrets = new Set();
  const positions = new Set();
  for (let g = 1; g <= 2000; g++) {
    const m = tireMystere(lcg(g));
    secrets.add(m.secret);
    positions.add(m.choix.indexOf(m.secret));
  }
  assert.equal(secrets.size, METIERS.length);
  assert.equal(positions.size, NB_CHOIX);
  for (const v of [0, 1, 1.5, -1, NaN]) {
    const m = tireMystere(() => v);
    assert.equal(new Set(m.choix).size, NB_CHOIX, `aléa ${v}`);
    assert.ok(m.choix.includes(m.secret), `aléa ${v}`);
  }
});

test("catalogue : identifiants uniques, intitulés au deux genres, racines sans accents", () => {
  assert.equal(new Set(METIERS.map(m => m.id)).size, METIERS.length);
  assert.ok(METIERS.length >= NB_CHOIX * 2);
  for (const m of METIERS) {
    assert.ok(m.m && m.f && m.racines.length);
    for (const r of m.racines) assert.equal(r, r.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase());
    // Chaque intitulé est reconnu par ses propres racines (sinon le filet ne voit rien).
    assert.ok(trahit(`je suis ${m.m}`, { secret: m.id, choix: [m.id], revele: null }), m.m);
    assert.ok(trahit(`je suis ${m.f}`, { secret: m.id, choix: [m.id], revele: null }), m.f);
  }
  assert.equal(intitule("boulanger", true), "boulangère");
  assert.equal(intitule("inconnu"), null);
});

test("devine : juste, faux, hors liste, deux fois", () => {
  const m = { secret: "pompier", choix: ["pompier", "facteur", "taxi", "coiffeur", "medecin", "musicien"], revele: null };
  const ok = devine(m, "pompier");
  assert.deepEqual(ok.revele, { propose: "pompier", trouve: true });
  const ko = devine(m, "taxi");
  assert.deepEqual(ko.revele, { propose: "taxi", trouve: false });
  assert.equal(devine(m, "boulanger"), null, "hors des choix proposés");
  assert.equal(devine(ok, "taxi"), null, "une seule devinette");
  assert.equal(devine(null, "taxi"), null);
  assert.equal(m.revele, null, "pas de mutation");
});

test("trahit : début de mot, accents, casse ; racine courte = mot entier", () => {
  const m = { secret: "enseignant", choix: [], revele: null };
  assert.ok(trahit("Je suis PROFESSEUR d'histoire", m));
  assert.ok(trahit("mes profs sont gentils", m));
  assert.ok(!trahit("Je veux profiter du soleil", m));
  assert.ok(trahit("J'enseigne… non : je suis enseignante.", m));
  const b = { secret: "boulanger", choix: [], revele: null };
  assert.ok(trahit("Je travaille dans une boulangerie", b));
  assert.ok(!trahit("Je me lève à quatre heures", b));
  const p = { secret: "pecheur", choix: [], revele: null };
  assert.ok(trahit("Je suis pêcheuse", p));
  assert.ok(!trahit("J'aime les pêches", p), "le fruit n'est pas le métier");
  assert.ok(!trahit("je suis pêcheur", { ...p, revele: { propose: "pecheur", trouve: true } }), "révélé : plus rien à cacher");
  assert.ok(!trahit(null, p));
});

test("expurge : traduction masquée, suggestion et mot de vocabulaire retirés, le reste intact", () => {
  const m = { secret: "medecin", choix: [], revele: null };
  const data = {
    reply: "Treballo en un hospital.",
    translation: "Je suis médecin à l'hôpital.",
    suggestions: ["Tu travailles la nuit ?", "Tu es docteur ?", "Tu aimes ton travail ?"],
    vocabulary: [{ term: "metge", translation: "médecin" }, { term: "hospital", translation: "hôpital" }],
    missions: [],
  };
  const { data: d, fuite } = expurge(data, m);
  assert.equal(fuite, true);
  assert.doesNotMatch(d.translation, /médecin/);
  assert.deepEqual(d.suggestions, ["Tu travailles la nuit ?", "Tu aimes ton travail ?"]);
  assert.deepEqual(d.vocabulary, [{ term: "hospital", translation: "hôpital" }]);
  assert.equal(d.reply, data.reply);
  assert.equal(data.translation, "Je suis médecin à l'hôpital.", "pas de mutation");
  const propre = expurge({ ...data, translation: "Je travaille la nuit.", suggestions: [], vocabulary: [] }, m);
  assert.equal(propre.fuite, false);
  // Champs absents (schéma allégé) ou mal typés : aucune casse.
  assert.equal(expurge({ reply: "x" }, m).fuite, false);
  assert.equal(expurge({ reply: "x", vocabulary: [null] }, m).fuite, false);
  assert.equal(expurge(null, m).data, null);
});

test("blocMystere : secret au genre du tuteur, gradué, sans missions ; révélé → parle librement", () => {
  const m = { secret: "coiffeur", choix: [], revele: null };
  assert.match(blocMystere("debutant", m, true), /« coiffeuse »/);
  assert.match(blocMystere("debutant", m, false), /« coiffeur »/);
  assert.match(blocMystere("debutant", m), /oui \/ non/);
  assert.match(blocMystere("avance", m), /subtil/);
  assert.match(blocMystere("inconnu", m), /oui \/ non/, "niveau inconnu : consigne débutant");
  assert.match(blocMystere("debutant", m), /Ne dis JAMAIS/);
  assert.equal(blocMystere("debutant", null), "");
  assert.equal(blocMystere("debutant", { secret: "astronaute" }), "");
  const fini = blocMystere("debutant", { ...m, revele: { propose: "taxi", trouve: false } });
  assert.match(fini, /TERMINÉ/);
  assert.match(fini, /chauffeur de taxi/);
  assert.doesNotMatch(fini, /Ne dis JAMAIS/);
});

test("buildTutorPrompt : le scénario mystère porte le secret et remplace les missions", () => {
  assert.ok(BASE_SCENARIOS.some(([id]) => id === SCENARIO_MYSTERE));
  const cfg = langConfig("japonais");
  const mystere = { secret: "photographe", choix: [], revele: null };
  const p = buildTutorPrompt({ cfg, level: "intermediaire", scenarioId: SCENARIO_MYSTERE, immersion: false, mode: "chat", mystere });
  assert.match(p, /deviner ton métier/);
  assert.match(p, /métier SECRET est « photographe »/);
  assert.doesNotMatch(p, /MISSIONS/);
  assert.doesNotMatch(p, /undefined/);
  // Un autre scénario ne voit ni le jeu ni le secret, même si un mystère traînait au contexte.
  const autre = buildTutorPrompt({ cfg, level: "intermediaire", scenarioId: "cafe", immersion: false, mode: "chat", mystere });
  assert.doesNotMatch(autre, /photographe/);
  assert.match(autre, /MISSIONS/);
});

test("schemaTour : missions: false retire missions et missions_accomplies, garde le reste", () => {
  const s = schemaTour({ lecture: true, missions: false });
  assert.ok(!("missions" in s.properties));
  assert.ok(!("missions_accomplies" in s.properties));
  assert.ok(!s.required.includes("missions"));
  assert.ok(!s.required.includes("missions_accomplies"));
  for (const k of ["reply", "translation", "reading", "correction", "suggestions", "vocabulary"]) assert.ok(k in s.properties, k);
  // Comportement par défaut inchangé.
  assert.ok("missions" in schemaTour({ lecture: false }).properties);
});

test("révélation, historique et comptage", () => {
  const m = { secret: "facteur", choix: ["facteur", "taxi"], revele: null };
  assert.equal(entreeMystere(m, 3), null, "rien à l'historique avant la devinette");
  assert.equal(messageRevelation(m, 3), "");
  const ok = devine(m, "facteur");
  assert.match(messageRevelation(ok, 3, true), /factrice.*3 questions/);
  assert.match(messageRevelation(ok, 1), /1 question\b/);
  const ko = devine(m, "taxi");
  assert.match(messageRevelation(ko, 4), /Raté.*facteur.*chauffeur de taxi/);
  assert.deepEqual(entreeMystere(ok, 3), { metier: "facteur", trouve: true, questions: 3 });
  assert.deepEqual(entreeMystere(ko, -2), { metier: "facteur", trouve: false, questions: 0 });
  assert.equal(nbMysteresTrouves([{ mystere: entreeMystere(ok, 3) }, { mystere: entreeMystere(ko, 2) }, {}, null]), 1);
  assert.equal(nbMysteresTrouves(null), 0);
});
