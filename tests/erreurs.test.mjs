// Tests du carnet d'erreurs (#87).
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_REACTIVEES, ajouteErreur, blocErreursPrompt, erreursAReactiver, erreursDues, marqueReactivees,
} from "../app/core/erreurs.js";
import { RATINGS, reviewCard } from "../app/core/fsrs.js";
import { DAY_MS } from "../app/core/leitner.js";
import { langConfig } from "../app/core/languages.js";
import { buildTutorPrompt } from "../app/core/prompts.js";

const NOW = Date.UTC(2026, 9, 12, 8, 0, 0);
const correction = (original, corrected, explanation = "accord du verbe") => ({ original, corrected, explanation });

test("ajouteErreur : une carte due immédiatement, champs nettoyés", () => {
  const carnet = ajouteErreur([], "catalan", correction("  jo veig vi ", " jo bec vi "), NOW);
  assert.equal(carnet.length, 1);
  const e = carnet[0];
  assert.equal(e.lang, "catalan");
  assert.equal(e.original, "jo veig vi");
  assert.equal(e.corrected, "jo bec vi");
  assert.equal(e.explanation, "accord du verbe");
  assert.equal(e.nextReview, NOW);
  assert.equal(e.addedAt, NOW);
  assert.equal(erreursDues(carnet, NOW).length, 1);
});

test("ajouteErreur : dédoublonnage par langue + forme corrigée, insensible à la casse et aux espaces", () => {
  const un = ajouteErreur([], "catalan", correction("jo veig vi", "jo bec vi"), NOW);
  const deux = ajouteErreur(un, "catalan", correction("jo veig el vi", "Jo  bec vi"), NOW + 1);
  assert.equal(deux, un, "même forme corrigée : le carnet est rendu tel quel (identité testée par l'appelant)");
  // La même forme dans une autre langue est une autre erreur.
  const trois = ajouteErreur(un, "espagnol", correction("jo veig vi", "jo bec vi"), NOW + 2);
  assert.equal(trois.length, 2);
  assert.equal(un.length, 1, "le carnet d'origine n'est jamais muté");
});

test("ajouteErreur : corrections vides, nulles ou identiques ignorées", () => {
  assert.equal(ajouteErreur([], "catalan", null, NOW).length, 0);
  assert.equal(ajouteErreur([], "catalan", { original: "", corrected: "x" }, NOW).length, 0);
  assert.equal(ajouteErreur([], "catalan", correction("bon dia", "Bon dia"), NOW).length, 0);
});

test("les cartes d'erreur se révisent par FSRS : ratée → demain, réussie → plus tard", () => {
  const [e] = ajouteErreur([], "catalan", correction("jo veig vi", "jo bec vi"), NOW);
  const ratee = reviewCard(e, RATINGS.again, NOW);
  assert.equal(ratee.nextReview, NOW + DAY_MS);
  assert.equal(ratee.lapses, 1);
  const reussie = reviewCard(e, RATINGS.good, NOW);
  assert.ok(reussie.nextReview > NOW + DAY_MS);
  assert.equal(erreursDues([ratee, reussie], NOW).length, 0);
  assert.equal(erreursDues([ratee, reussie], NOW + DAY_MS).length, 1);
});

test("erreursAReactiver : filtre par langue, dues d'abord, puis les plus ratées, trois au plus", () => {
  let carnet = [];
  for (let i = 0; i < 5; i++) {
    carnet = ajouteErreur(carnet, "catalan", correction(`faute ${i}`, `forme ${i}`), NOW - (5 - i) * DAY_MS);
  }
  carnet = ajouteErreur(carnet, "espagnol", correction("falta", "forma"), NOW);
  // forme 0 et 1 : réussies hier (plus dues) ; forme 1 déjà ratée deux fois avant.
  carnet = carnet.map(e => {
    if (e.corrected === "forme 0") return reviewCard(e, RATINGS.good, NOW - DAY_MS);
    if (e.corrected === "forme 1") return { ...reviewCard(e, RATINGS.good, NOW - DAY_MS), lapses: 2 };
    return e;
  });
  const choisies = erreursAReactiver(carnet, "catalan", NOW);
  assert.equal(choisies.length, MAX_REACTIVEES);
  assert.ok(choisies.every(e => e.lang === "catalan"));
  // Les trois dues (formes 2, 3, 4), les plus récentes d'abord — avant toute non due.
  assert.deepEqual(choisies.map(e => e.corrected), ["forme 4", "forme 3", "forme 2"]);
  // Avec plus de place, la non due la plus ratée passe avant la non due jamais ratée.
  const cinq = erreursAReactiver(carnet, "catalan", NOW, 5);
  assert.deepEqual(cinq.slice(3).map(e => e.corrected), ["forme 1", "forme 0"]);
  assert.equal(erreursAReactiver(carnet, "japonais", NOW).length, 0);
});

test("marqueReactivees : une erreur non due réactivée hier n'est pas reproposée aujourd'hui", () => {
  let carnet = ajouteErreur([], "catalan", correction("faute", "forme"), NOW - 10 * DAY_MS);
  carnet = carnet.map(e => reviewCard(e, RATINGS.easy, NOW - 10 * DAY_MS)); // plus due avant longtemps
  const hier = NOW - 6 * 60 * 60 * 1000;
  const choisies = erreursAReactiver(carnet, "catalan", hier);
  assert.equal(choisies.length, 1);
  carnet = marqueReactivees(carnet, choisies, hier);
  assert.equal(carnet[0].reactivee, hier);
  assert.equal(erreursAReactiver(carnet, "catalan", NOW).length, 0, "réactivée il y a 6 h");
  assert.equal(erreursAReactiver(carnet, "catalan", NOW + 2 * DAY_MS).length, 1, "le délai est passé");
  assert.equal(marqueReactivees(carnet, [], NOW), carnet, "rien à marquer : identité conservée");
});

test("blocErreursPrompt : vide sans erreur, sinon les formes et la consigne de discrétion", () => {
  assert.equal(blocErreursPrompt([]), "");
  assert.equal(blocErreursPrompt(undefined), "");
  const bloc = blocErreursPrompt(ajouteErreur([], "catalan", correction("jo veig vi", "jo bec vi"), NOW));
  assert.match(bloc, /« jo veig vi » → « jo bec vi »/);
  assert.match(bloc, /accord du verbe/);
  assert.match(bloc, /Ne les annonce pas/);
});

test("buildTutorPrompt : sans erreur, prompt strictement identique ; avec, le bloc est présent", () => {
  const cfg = langConfig("catalan");
  const base = { cfg, level: "debutant", scenarioId: "libre", immersion: false };
  const sans = buildTutorPrompt(base);
  assert.equal(buildTutorPrompt({ ...base, erreurs: [] }), sans);
  assert.equal(buildTutorPrompt({ ...base, erreurs: undefined }), sans);
  const erreurs = ajouteErreur([], "catalan", correction("jo veig vi", "jo bec vi"), NOW);
  const avec = buildTutorPrompt({ ...base, erreurs });
  assert.notEqual(avec, sans);
  assert.match(avec, /RÉACTIVER/);
  assert.match(avec, /jo bec vi/);
  // En immersion aussi : rien n'est affiché, mais la conversation y revient.
  assert.match(buildTutorPrompt({ ...base, immersion: true, erreurs }), /jo bec vi/);
  // Jamais en test de niveau.
  assert.doesNotMatch(buildTutorPrompt({ cfg, mode: "eval", level: "debutant", erreurs }), /jo bec vi/);
});
